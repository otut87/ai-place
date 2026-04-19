// T-057 — 알림 이벤트 → 이메일/슬랙 페이로드 빌더.
// 순수 함수. 실제 전송은 notify/email.ts · notify/slack.ts 가 담당.

export type NotifyEvent =
  | {
      type: 'place.registered'
      placeName: string
      placeUrl: string
      adminEmail?: string
    }
  | {
      type: 'place.approved'
      placeName: string
      placeUrl: string
      ownerEmail?: string
    }
  | {
      type: 'place.rejected'
      placeName: string
      placeUrl: string
      ownerEmail?: string
      reason?: string
    }
  | {
      type: 'pending.backlog'
      count: number
      adminEmail?: string
    }
  | {
      type: 'payment.failed'
      customerName: string
      customerEmail?: string
      amount: number
      failureMessage: string
      retriedCount: number           // 0 → 첫 실패
      nextRetryAt: string | null     // ISO, null 이면 재시도 소진
      adminEmail?: string
    }
  | {
      type: 'payment.retry_exhausted'
      customerName: string
      customerEmail?: string
      amount: number
      adminEmail?: string
    }
  | {
      type: 'billing.expiry_warning'
      customerName: string
      customerEmail: string
      cardCompany: string | null
      cardNumberMasked: string | null
      daysUntilExpiry: number        // 30 or 7
    }

export interface EmailPayload {
  to: string
  subject: string
  body: string
}

export interface SlackPayload {
  text: string
}

/** 이벤트에 맞는 이메일 페이로드 생성. 수신자 없는 경우 null. */
export function buildEmailPayload(ev: NotifyEvent): EmailPayload | null {
  switch (ev.type) {
    case 'place.approved': {
      if (!ev.ownerEmail) return null
      return {
        to: ev.ownerEmail,
        subject: `[aiplace] ${ev.placeName} 등록이 승인되었습니다`,
        body: [
          `안녕하세요, ${ev.placeName} 담당자님.`,
          '',
          '요청하신 업체 등록이 승인되었습니다.',
          `공개 페이지: ${ev.placeUrl}`,
          '',
          '문의 사항은 이 메일 회신으로 부탁드립니다.',
        ].join('\n'),
      }
    }
    case 'place.rejected': {
      if (!ev.ownerEmail) return null
      return {
        to: ev.ownerEmail,
        subject: `[aiplace] ${ev.placeName} 등록이 거절되었습니다`,
        body: [
          `안녕하세요, ${ev.placeName} 담당자님.`,
          '',
          '요청하신 업체 등록이 다음 사유로 거절되었습니다.',
          `사유: ${ev.reason ?? '(사유 미기재)'}`,
          `참조 URL: ${ev.placeUrl}`,
        ].join('\n'),
      }
    }
    case 'place.registered': {
      if (!ev.adminEmail) return null
      return {
        to: ev.adminEmail,
        subject: `[aiplace] 신규 업체 등록 요청: ${ev.placeName}`,
        body: `신규 pending 업체 등록 요청이 도착했습니다.\n\n업체: ${ev.placeName}\n어드민 URL: ${ev.placeUrl}`,
      }
    }
    case 'pending.backlog': {
      if (!ev.adminEmail) return null
      return {
        to: ev.adminEmail,
        subject: `[aiplace] pending 업체 ${ev.count}건 대기 중`,
        body: `현재 ${ev.count}건의 업체가 pending 상태로 대기 중입니다. 어드민에서 검토해 주세요.`,
      }
    }
    case 'payment.failed': {
      const to = ev.customerEmail ?? ev.adminEmail
      if (!to) return null
      const retryLine = ev.nextRetryAt
        ? `다음 자동 재시도 예정: ${ev.nextRetryAt.slice(0, 10)} (${ev.retriedCount + 1}회차)`
        : '자동 재시도가 모두 소진되었습니다. 카드 정보 갱신이 필요합니다.'
      return {
        to,
        subject: `[aiplace] 결제 실패 안내 — ${ev.customerName}`,
        body: [
          `${ev.customerName}님의 월 구독 결제(${ev.amount.toLocaleString('ko-KR')}원)가 실패했습니다.`,
          `사유: ${ev.failureMessage}`,
          '',
          retryLine,
        ].join('\n'),
      }
    }
    case 'payment.retry_exhausted': {
      const to = ev.customerEmail ?? ev.adminEmail
      if (!to) return null
      return {
        to,
        subject: `[aiplace] 결제가 3회 연속 실패하여 구독이 일시 중단됩니다`,
        body: [
          `${ev.customerName}님의 월 구독 결제(${ev.amount.toLocaleString('ko-KR')}원)가 3회 연속 실패하였습니다.`,
          '서비스가 일시 중단됩니다. 카드 정보를 갱신한 뒤 결제 페이지에서 재개해 주세요.',
        ].join('\n'),
      }
    }
    case 'billing.expiry_warning': {
      const cardLine = [ev.cardCompany, ev.cardNumberMasked].filter(Boolean).join(' ')
      return {
        to: ev.customerEmail,
        subject: `[aiplace] 카드 만료 ${ev.daysUntilExpiry}일 전 안내`,
        body: [
          `${ev.customerName}님, 등록된 결제 카드(${cardLine || '—'})가 ${ev.daysUntilExpiry}일 안에 만료됩니다.`,
          '만료 전 새 카드로 교체하지 않으면 결제에 실패할 수 있습니다.',
        ].join('\n'),
      }
    }
  }
}

/** 이벤트에 맞는 슬랙 메시지. 사장님 전용 이벤트는 null. */
export function buildSlackPayload(ev: NotifyEvent): SlackPayload | null {
  switch (ev.type) {
    case 'place.registered':
      return { text: `:inbox_tray: 신규 업체 등록 — *${ev.placeName}* · ${ev.placeUrl}` }
    case 'pending.backlog':
      return { text: `:alarm_clock: pending 업체 ${ev.count}건이 대기 중입니다.` }
    case 'payment.failed':
      return {
        text: `:credit_card: 결제 실패 — *${ev.customerName}* · ${ev.amount.toLocaleString('ko-KR')}원 · ${ev.failureMessage}${ev.nextRetryAt ? ` · 다음 재시도 ${ev.nextRetryAt.slice(0, 10)}` : ' · 재시도 소진'}`,
      }
    case 'payment.retry_exhausted':
      return {
        text: `:rotating_light: 결제 3회 실패 → 일시 중단 — *${ev.customerName}* · ${ev.amount.toLocaleString('ko-KR')}원`,
      }
    case 'place.approved':
    case 'place.rejected':
    case 'billing.expiry_warning':
      return null
  }
}
