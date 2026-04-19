import { describe, it, expect } from 'vitest'
import {
  daysUntilCardExpiry,
  warningDayForToday,
  EXPIRY_WARNING_DAYS,
} from '@/lib/billing/expiry'

describe('daysUntilCardExpiry', () => {
  it('2026-12 만료 카드, 오늘 2026-04-20 → 약 254일', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    // 2026-12-31 23:59:59.999 까지
    const r = daysUntilCardExpiry({ expiry_year: 2026, expiry_month: 12 }, now)
    expect(r).toBeGreaterThan(250)
    expect(r).toBeLessThan(260)
  })

  it('오늘이 만료월 + 1일 후 → 음수', () => {
    const now = new Date('2027-01-01T00:00:00Z')
    const r = daysUntilCardExpiry({ expiry_year: 2026, expiry_month: 12 }, now)
    expect(r).toBeLessThanOrEqual(0)
  })

  it('연/월 누락 → null', () => {
    expect(daysUntilCardExpiry({ expiry_year: null, expiry_month: 12 })).toBeNull()
    expect(daysUntilCardExpiry({ expiry_year: 2026, expiry_month: null })).toBeNull()
  })

  it('30일 전 시점 정확도', () => {
    // 2026-04-30 만료 가정, 오늘 2026-03-31 → 30일
    const now = new Date('2026-03-31T23:59:59.999Z')
    const r = daysUntilCardExpiry({ expiry_year: 2026, expiry_month: 4 }, now)
    expect(r).toBe(30)
  })
})

describe('warningDayForToday', () => {
  it('30 또는 7 일 때만 경고', () => {
    expect(warningDayForToday(30)).toBe(30)
    expect(warningDayForToday(7)).toBe(7)
  })

  it('다른 값은 null', () => {
    expect(warningDayForToday(31)).toBeNull()
    expect(warningDayForToday(29)).toBeNull()
    expect(warningDayForToday(8)).toBeNull()
    expect(warningDayForToday(6)).toBeNull()
    expect(warningDayForToday(0)).toBeNull()
  })

  it('EXPIRY_WARNING_DAYS 스냅샷', () => {
    expect(EXPIRY_WARNING_DAYS).toEqual([30, 7])
  })
})
