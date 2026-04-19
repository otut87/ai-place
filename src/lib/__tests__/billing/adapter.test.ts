import { describe, it, expect } from 'vitest'
import {
  classifyFailure,
  isRetryableFailure,
  nextRetryAt,
  RETRY_SCHEDULE_DAYS,
} from '@/lib/billing/adapter'

describe('classifyFailure', () => {
  it('잔액부족 계열', () => {
    expect(classifyFailure('NOT_ENOUGH_BALANCE')).toBe('insufficient_balance')
    expect(classifyFailure('INSUFFICIENT_FUND')).toBe('insufficient_balance')
  })

  it('카드 만료', () => {
    expect(classifyFailure('EXPIRED_CARD')).toBe('card_expired')
    expect(classifyFailure('CARD_EXPIRE_DATE')).toBe('card_expired')
  })

  it('한도초과', () => {
    expect(classifyFailure('EXCEED_MAX_AMOUNT')).toBe('limit_exceeded')
    expect(classifyFailure('LIMIT_OVER')).toBe('limit_exceeded')
  })

  it('도난/분실', () => {
    expect(classifyFailure('STOLEN_CARD')).toBe('stolen_or_lost')
    expect(classifyFailure('LOST_CARD')).toBe('stolen_or_lost')
  })

  it('카드 오류', () => {
    expect(classifyFailure('INVALID_CARD')).toBe('invalid_card')
    expect(classifyFailure('NOT_REGISTERED_CARD')).toBe('invalid_card')
    expect(classifyFailure('NOT_SUPPORTED_CARD')).toBe('invalid_card')
  })

  it('카드사 승인 거절', () => {
    expect(classifyFailure('REJECT_CARD_COMPANY')).toBe('do_not_honor')
    expect(classifyFailure('DO_NOT_HONOR')).toBe('do_not_honor')
  })

  it('알 수 없음 / null', () => {
    expect(classifyFailure('SOMETHING_NEW')).toBe('other')
    expect(classifyFailure(null)).toBe('other')
    expect(classifyFailure(undefined)).toBe('other')
  })
})

describe('isRetryableFailure', () => {
  it('재시도 가능', () => {
    expect(isRetryableFailure('insufficient_balance')).toBe(true)
    expect(isRetryableFailure('limit_exceeded')).toBe(true)
    expect(isRetryableFailure('do_not_honor')).toBe(true)
    expect(isRetryableFailure('other')).toBe(true)
  })

  it('재등록 필요 (재시도 무의미)', () => {
    expect(isRetryableFailure('card_expired')).toBe(false)
    expect(isRetryableFailure('invalid_card')).toBe(false)
    expect(isRetryableFailure('stolen_or_lost')).toBe(false)
  })
})

describe('nextRetryAt', () => {
  const base = new Date('2026-04-20T00:00:00Z')

  it('0회 재시도 → +1d', () => {
    const r = nextRetryAt(0, base)
    expect(r?.toISOString()).toBe('2026-04-21T00:00:00.000Z')
  })

  it('1회 → +3d', () => {
    const r = nextRetryAt(1, base)
    expect(r?.toISOString()).toBe('2026-04-23T00:00:00.000Z')
  })

  it('2회 → +7d', () => {
    const r = nextRetryAt(2, base)
    expect(r?.toISOString()).toBe('2026-04-27T00:00:00.000Z')
  })

  it('3회 이상 → null (재시도 소진)', () => {
    expect(nextRetryAt(3, base)).toBeNull()
    expect(nextRetryAt(99, base)).toBeNull()
  })

  it('RETRY_SCHEDULE_DAYS 스냅샷', () => {
    expect(RETRY_SCHEDULE_DAYS).toEqual([1, 3, 7])
  })
})
