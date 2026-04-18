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
    const p = buildEmailPayload(ev)
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
    const p = buildEmailPayload(ev)
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
    const p = buildEmailPayload(ev)
    expect(p.to).toBe('admin@example.com')
  })

  it('pending.backlog — count 반영', () => {
    const ev: NotifyEvent = {
      type: 'pending.backlog',
      count: 12,
      adminEmail: 'admin@example.com',
    }
    const p = buildEmailPayload(ev)
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
    const p = buildSlackPayload(ev)
    expect(p.text).toContain('신규업체')
    expect(p.text).toContain('aiplace.kr')
  })

  it('pending.backlog — count + 이모지 포함', () => {
    const ev: NotifyEvent = { type: 'pending.backlog', count: 24 }
    const p = buildSlackPayload(ev)
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
})
