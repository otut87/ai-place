// T-229 — 쿠폰 할인 계산 + 검증 로직 단위 테스트.

import { describe, it, expect } from 'vitest'
import { calcDiscountedAmount, validateCouponForUse, type CouponDef } from '@/lib/billing/coupon'

describe('calcDiscountedAmount', () => {
  it('percent 20 % → floor(14900 * 0.8) = 11920', () => {
    expect(calcDiscountedAmount(14900, 'percent', 20)).toBe(11920)
  })

  it('percent 50 % on 29800 (업체 2개) → 14900', () => {
    expect(calcDiscountedAmount(29800, 'percent', 50)).toBe(14900)
  })

  it('percent 33 % floor 적용 — 14900 × 0.67 = 9983', () => {
    expect(calcDiscountedAmount(14900, 'percent', 33)).toBe(9983)
  })

  it('percent clamp: 0 이하 입력은 1%, 100 초과는 100%', () => {
    expect(calcDiscountedAmount(10000, 'percent', 0)).toBe(9900)   // clamp to 1 → 10000*0.99
    expect(calcDiscountedAmount(10000, 'percent', 101)).toBe(0)    // clamp to 100 → 0
  })

  it('fixed 5000 → amount - 5000', () => {
    expect(calcDiscountedAmount(14900, 'fixed', 5000)).toBe(9900)
  })

  it('fixed 가 amount 초과 → 0 (음수 금지)', () => {
    expect(calcDiscountedAmount(10000, 'fixed', 99999)).toBe(0)
  })

  it('amount 0 이면 항상 0 반환 (skip charge)', () => {
    expect(calcDiscountedAmount(0, 'percent', 50)).toBe(0)
    expect(calcDiscountedAmount(0, 'fixed', 1000)).toBe(0)
  })
})

describe('validateCouponForUse', () => {
  const now = new Date('2026-05-01T00:00:00Z').getTime()
  const valid: CouponDef = {
    id: 'c1', code: 'TEST',
    discountType: 'percent', discountValue: 20,
    validFrom: '2026-04-01T00:00:00Z',
    validUntil: '2026-12-31T23:59:59Z',
    maxUses: 100, usesCount: 5,
  }

  it('유효 범위 내 쿠폰 → null (pass)', () => {
    expect(validateCouponForUse(valid, now)).toBeNull()
  })

  it('validFrom 이전 → 에러', () => {
    const future = { ...valid, validFrom: '2026-07-01T00:00:00Z' }
    expect(validateCouponForUse(future, now)).toMatch(/사용 가능한 시점/)
  })

  it('validUntil 지남 → "만료" 에러', () => {
    const expired = { ...valid, validUntil: '2026-04-15T00:00:00Z' }
    expect(validateCouponForUse(expired, now)).toMatch(/만료/)
  })

  it('uses_count >= max_uses → "소진" 에러', () => {
    const depleted = { ...valid, maxUses: 100, usesCount: 100 }
    expect(validateCouponForUse(depleted, now)).toMatch(/소진/)
  })

  it('validUntil null + maxUses null → 무제한 쿠폰 pass', () => {
    const unlimited = { ...valid, validUntil: null, maxUses: null, usesCount: 999999 }
    expect(validateCouponForUse(unlimited, now)).toBeNull()
  })
})
