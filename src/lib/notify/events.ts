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
  }
}

/** 이벤트에 맞는 슬랙 메시지. 사장님 전용 이벤트는 null. */
export function buildSlackPayload(ev: NotifyEvent): SlackPayload | null {
  switch (ev.type) {
    case 'place.registered':
      return { text: `:inbox_tray: 신규 업체 등록 — *${ev.placeName}* · ${ev.placeUrl}` }
    case 'pending.backlog':
      return { text: `:alarm_clock: pending 업체 ${ev.count}건이 대기 중입니다.` }
    case 'place.approved':
    case 'place.rejected':
      return null
  }
}
