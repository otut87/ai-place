import { describe, it, expect } from 'vitest'
import {
  buildEmailPayload,
  buildSlackPayload,
  type NotifyEvent,
} from '@/lib/notify/events'

describe('buildEmailPayload', () => {
  it('place.approved 이벤트 — 업체명·URL 포함', () => {
    const ev: NotifyEvent = {
      type: 'place.approved',
      placeName: '닥터에버스',
      placeUrl: 'https://aiplace.kr/cheonan/dermatology/dr-evers',
      ownerEmail: 'owner@example.com',
    }
    const p = buildEmailPayload(ev)!
    expect(p.to).toBe('owner@example.com')
    expect(p.subject).toContain('닥터에버스')
    expect(p.body).toContain('승인')
    expect(p.body).toContain('https://aiplace.kr/cheonan/dermatology/dr-evers')
  })

  it('place.rejected — 거절 사유 포함', () => {
    const ev: NotifyEvent = {
      type: 'place.rejected',
      placeName: '테스트',
      placeUrl: 'https://aiplace.kr/x/y/z',
      ownerEmail: 'owner@example.com',
      reason: '주소 불일치',
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('거절')
    expect(p.body).toContain('주소 불일치')
  })

  it('place.registered — to 는 어드민', () => {
    const ev: NotifyEvent = {
      type: 'place.registered',
      placeName: '신규업체',
      placeUrl: 'https://aiplace.kr/admin/places',
      adminEmail: 'admin@example.com',
    }
    const p = buildEmailPayload(ev)!
    expect(p.to).toBe('admin@example.com')
  })

  it('pending.backlog — count 반영', () => {
    const ev: NotifyEvent = {
      type: 'pending.backlog',
      count: 12,
      adminEmail: 'admin@example.com',
    }
    const p = buildEmailPayload(ev)!
    expect(p.body).toContain('12')
  })

  it('ownerEmail 없는 place.approved → null 반환', () => {
    const ev: NotifyEvent = {
      type: 'place.approved',
      placeName: 'X',
      placeUrl: 'https://x',
    }
    expect(buildEmailPayload(ev)).toBeNull()
  })
})

describe('buildSlackPayload', () => {
  it('place.registered — 제목·링크 포함', () => {
    const ev: NotifyEvent = {
      type: 'place.registered',
      placeName: '신규업체',
      placeUrl: 'https://aiplace.kr/admin/places',
    }
    const p = buildSlackPayload(ev)!
    expect(p.text).toContain('신규업체')
    expect(p.text).toContain('aiplace.kr')
  })

  it('pending.backlog — count + 이모지 포함', () => {
    const ev: NotifyEvent = { type: 'pending.backlog', count: 24 }
    const p = buildSlackPayload(ev)!
    expect(p.text).toMatch(/24/)
  })

  it('place.approved 는 슬랙 알림 안 보냄 (사장님 전용)', () => {
    const ev: NotifyEvent = {
      type: 'place.approved',
      placeName: '닥터에버스',
      placeUrl: 'https://x',
      ownerEmail: 'o@x.com',
    }
    expect(buildSlackPayload(ev)).toBeNull()
  })

  it('payment.failed — 카드 이모지 + 재시도 일자', () => {
    const ev: NotifyEvent = {
      type: 'payment.failed',
      customerName: '홍길동', amount: 33000, failureMessage: '잔액 부족',
      retriedCount: 0, nextRetryAt: '2026-04-21T00:00:00Z',
    }
    const p = buildSlackPayload(ev)!
    expect(p.text).toContain('홍길동')
    expect(p.text).toContain('잔액 부족')
    expect(p.text).toContain('2026-04-21')
  })

  it('payment.retry_exhausted — 경고 이모지', () => {
    const ev: NotifyEvent = {
      type: 'payment.retry_exhausted',
      customerName: '홍', amount: 33000,
    }
    const p = buildSlackPayload(ev)!
    expect(p.text).toContain('3회')
  })

  it('billing.expiry_warning → null (사장님 전용 이메일)', () => {
    const ev: NotifyEvent = {
      type: 'billing.expiry_warning',
      customerName: '홍', customerEmail: 'h@x.com',
      cardCompany: null, cardNumberMasked: null,
      daysUntilExpiry: 30,
    }
    expect(buildSlackPayload(ev)).toBeNull()
  })
})

describe('buildEmailPayload — 결제 이벤트', () => {
  it('payment.failed + customerEmail + nextRetryAt', () => {
    const ev: NotifyEvent = {
      type: 'payment.failed',
      customerName: '홍길동', customerEmail: 'h@x.com',
      amount: 33000, failureMessage: '잔액 부족',
      retriedCount: 0, nextRetryAt: '2026-04-21T00:00:00Z',
    }
    const p = buildEmailPayload(ev)!
    expect(p.to).toBe('h@x.com')
    expect(p.body).toContain('2026-04-21')
    expect(p.body).toContain('잔액 부족')
  })

  it('payment.failed + nextRetryAt null → 재시도 소진 문구', () => {
    const ev: NotifyEvent = {
      type: 'payment.failed',
      customerName: '홍', customerEmail: 'h@x.com',
      amount: 33000, failureMessage: 'x', retriedCount: 2, nextRetryAt: null,
    }
    const p = buildEmailPayload(ev)!
    expect(p.body).toContain('소진')
  })

  it('payment.failed + customerEmail 없음 + adminEmail → adminEmail 발송', () => {
    const ev: NotifyEvent = {
      type: 'payment.failed',
      customerName: '홍', amount: 33000, failureMessage: 'x',
      retriedCount: 0, nextRetryAt: null, adminEmail: 'admin@x.com',
    }
    const p = buildEmailPayload(ev)!
    expect(p.to).toBe('admin@x.com')
  })

  it('payment.failed + 양쪽 이메일 모두 없음 → null', () => {
    const ev: NotifyEvent = {
      type: 'payment.failed',
      customerName: '홍', amount: 33000, failureMessage: 'x',
      retriedCount: 0, nextRetryAt: null,
    }
    expect(buildEmailPayload(ev)).toBeNull()
  })

  it('payment.retry_exhausted — 일시 중단 제목', () => {
    const ev: NotifyEvent = {
      type: 'payment.retry_exhausted',
      customerName: '홍', customerEmail: 'h@x.com', amount: 33000,
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('일시 중단')
  })

  it('payment.retry_exhausted — 양쪽 없음 → null', () => {
    const ev: NotifyEvent = {
      type: 'payment.retry_exhausted',
      customerName: '홍', amount: 33000,
    }
    expect(buildEmailPayload(ev)).toBeNull()
  })

  it('billing.expiry_warning — 30일 안내', () => {
    const ev: NotifyEvent = {
      type: 'billing.expiry_warning',
      customerName: '홍', customerEmail: 'h@x.com',
      cardCompany: '삼성', cardNumberMasked: '1234-****-****-5678',
      daysUntilExpiry: 30,
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('30일')
    expect(p.body).toContain('삼성')
    expect(p.body).toContain('1234')
  })

  it('billing.expiry_warning — 카드정보 없음도 처리', () => {
    const ev: NotifyEvent = {
      type: 'billing.expiry_warning',
      customerName: '홍', customerEmail: 'h@x.com',
      cardCompany: null, cardNumberMasked: null,
      daysUntilExpiry: 7,
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('7일')
  })

  // T-230 — 결제 성공 이벤트
  it('payment.succeeded — 영수증 URL + 다음 결제일 + 업체수 포함', () => {
    const ev: NotifyEvent = {
      type: 'payment.succeeded',
      customerName: '홍길동',
      customerEmail: 'h@x.com',
      amount: 14900,
      chargedAt: '2026-05-15T12:00:00Z',
      nextChargeAt: '2026-06-14T12:00:00Z',
      receiptUrl: 'https://dashboard.tosspayments.com/receipt/abc',
      activePlaceCount: 1,
    }
    const p = buildEmailPayload(ev)!
    expect(p.to).toBe('h@x.com')
    expect(p.subject).toContain('2026-05-15')
    expect(p.subject).toContain('14,900')
    expect(p.body).toContain('https://dashboard.tosspayments.com/receipt/abc')
    expect(p.body).toContain('2026-06-14')
    expect(p.body).toContain('업체 1개')
  })

  it('payment.succeeded — 영수증 URL 없으면 카드사 안내 fallback', () => {
    const ev: NotifyEvent = {
      type: 'payment.succeeded',
      customerName: '홍', customerEmail: 'h@x.com',
      amount: 29800, chargedAt: '2026-05-01T00:00:00Z',
      nextChargeAt: '2026-05-31T00:00:00Z', activePlaceCount: 2,
    }
    const p = buildEmailPayload(ev)!
    expect(p.body).toContain('카드사 앱')
    expect(p.body).toContain('29,800')
  })

  it('payment.succeeded — customerEmail 없으면 null', () => {
    const ev: NotifyEvent = {
      type: 'payment.succeeded',
      customerName: '홍', amount: 14900,
      chargedAt: '2026-05-01T00:00:00Z', nextChargeAt: null, activePlaceCount: 1,
    }
    expect(buildEmailPayload(ev)).toBeNull()
  })

  // T-230 — 파일럿 종료 예고 (카드 선등록 모델)
  it('billing.trial_ending — D-3 예고 (금액 + 업체수 + 종료일)', () => {
    const ev: NotifyEvent = {
      type: 'billing.trial_ending',
      customerName: '홍', customerEmail: 'h@x.com',
      daysLeft: 3, trialEndsAt: '2026-05-04T00:00:00Z',
      amount: 14900, activePlaceCount: 1,
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('D-3')
    expect(p.subject).toContain('14,900')
    expect(p.body).toContain('3일 후')
    expect(p.body).toContain('활성 업체 1개')
    expect(p.body).toContain('/owner/billing/cancel')
  })

  it('billing.trial_ending — D-0 (당일) 제목 다름', () => {
    const ev: NotifyEvent = {
      type: 'billing.trial_ending',
      customerName: '홍', customerEmail: 'h@x.com',
      daysLeft: 0, trialEndsAt: '2026-05-01T00:00:00Z',
      amount: 29800, activePlaceCount: 2,
    }
    const p = buildEmailPayload(ev)!
    expect(p.subject).toContain('오늘')
    expect(p.body).toContain('오늘 등록된 카드로')
  })

  // T-230 — Slack 페이로드
  it('payment.succeeded → slack 메시지', () => {
    const ev: NotifyEvent = {
      type: 'payment.succeeded',
      customerName: '홍', customerEmail: 'h@x.com',
      amount: 14900, chargedAt: '2026-05-01T00:00:00Z',
      nextChargeAt: '2026-05-31T00:00:00Z', activePlaceCount: 1,
    }
    const s = buildSlackPayload(ev)!
    expect(s.text).toContain('결제 성공')
    expect(s.text).toContain('홍')
    expect(s.text).toContain('14,900')
  })

  it('billing.trial_ending → slack 메시지 없음 (사장님 전용)', () => {
    const ev: NotifyEvent = {
      type: 'billing.trial_ending',
      customerName: '홍', customerEmail: 'h@x.com',
      daysLeft: 1, trialEndsAt: '2026-05-02T00:00:00Z',
      amount: 14900, activePlaceCount: 1,
    }
    expect(buildSlackPayload(ev)).toBeNull()
  })
})
