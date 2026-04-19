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
})
