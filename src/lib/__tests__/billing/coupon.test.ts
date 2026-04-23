// T-229 — 쿠폰 할인 계산 + 검증 로직 단위 테스트.

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calcDiscountedAmount,
  validateCouponForUse,
  loadUnappliedRedemption,
  markRedemptionApplied,
  type CouponDef,
} from '@/lib/billing/coupon'

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

// ─── Supabase admin 기반 헬퍼 테스트 ────────────────────────────
// loadUnappliedRedemption / markRedemptionApplied 는 체이닝 mock 필요.

function makeAdmin(options: {
  redemptionRow?: unknown
  couponRow?: unknown
}) {
  const updateEq1 = vi.fn().mockReturnThis()
  const updateIs = vi.fn().mockResolvedValue({ error: null })
  const updateCouponEq = vi.fn().mockResolvedValue({ error: null })
  const selectCouponEq = vi.fn(() => ({
    maybeSingle: async () => ({ data: options.couponRow ?? null, error: null }),
  }))

  return {
    admin: {
      from: (table: string) => {
        if (table === 'coupon_redemptions') {
          return {
            select: () => ({
              eq: () => ({
                is: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: options.redemptionRow ?? null, error: null }),
                    }),
                  }),
                }),
              }),
            }),
            update: () => ({
              eq: updateEq1,
              is: updateIs,
            }),
          }
        }
        if (table === 'coupons') {
          return {
            select: () => ({ eq: selectCouponEq }),
            update: () => ({ eq: updateCouponEq }),
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    } as unknown as SupabaseClient,
    updateEq1, updateIs, updateCouponEq, selectCouponEq,
  }
}

describe('loadUnappliedRedemption', () => {
  it('redemption 없음 → null', async () => {
    const { admin } = makeAdmin({ redemptionRow: null })
    const r = await loadUnappliedRedemption(admin, 'c-1')
    expect(r).toBeNull()
  })

  it('coupon 조인 누락(deleted) → null', async () => {
    const { admin } = makeAdmin({ redemptionRow: { id: 'r-1', coupon_id: 'cp-1', coupons: null } })
    const r = await loadUnappliedRedemption(admin, 'c-1')
    expect(r).toBeNull()
  })

  it('만료된 쿠폰 → null (validate 탈락)', async () => {
    const expired = {
      id: 'r-1', coupon_id: 'cp-1',
      coupons: {
        id: 'cp-1', code: 'EXP',
        discount_type: 'percent', discount_value: 20,
        valid_from: '2020-01-01T00:00:00Z',
        valid_until: '2020-12-31T00:00:00Z',  // 이미 만료
        max_uses: null, uses_count: 0,
      },
    }
    const { admin } = makeAdmin({ redemptionRow: expired })
    const r = await loadUnappliedRedemption(admin, 'c-1')
    expect(r).toBeNull()
  })

  it('유효한 쿠폰 → redemption 반환', async () => {
    const valid = {
      id: 'r-1', coupon_id: 'cp-1',
      coupons: {
        id: 'cp-1', code: 'VALID',
        discount_type: 'percent', discount_value: 20,
        valid_from: '2020-01-01T00:00:00Z',
        valid_until: null, max_uses: null, uses_count: 0,
      },
    }
    const { admin } = makeAdmin({ redemptionRow: valid })
    const r = await loadUnappliedRedemption(admin, 'c-1')
    expect(r).not.toBeNull()
    expect(r?.id).toBe('r-1')
    expect(r?.couponId).toBe('cp-1')
    expect(r?.discountType).toBe('percent')
    expect(r?.discountValue).toBe(20)
  })
})

describe('markRedemptionApplied', () => {
  it('redemption 업데이트 + coupon.uses_count 증가', async () => {
    const { admin, updateCouponEq, selectCouponEq, updateIs } = makeAdmin({
      couponRow: { uses_count: 3 },
    })
    await markRedemptionApplied(admin, 'r-1', 'cp-1', 'p-1')
    // coupon_redemptions update.is 호출 확인
    expect(updateIs).toHaveBeenCalled()
    // coupon.select + update 호출 확인
    expect(selectCouponEq).toHaveBeenCalled()
    expect(updateCouponEq).toHaveBeenCalled()
  })

  it('coupon row 없어도 graceful — uses_count 0 에서 1 로', async () => {
    const { admin, updateCouponEq } = makeAdmin({ couponRow: null })
    await markRedemptionApplied(admin, 'r-1', 'cp-1', 'p-1')
    expect(updateCouponEq).toHaveBeenCalled()
  })
})
