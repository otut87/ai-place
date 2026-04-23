// T-229 — redeemCouponAction 테스트.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const state: {
  user: { id: string; email: string } | null
  customer: { id: string } | null
  coupon: {
    id: string; code: string; discount_type: 'percent' | 'fixed'; discount_value: number
    valid_from: string; valid_until: string | null; max_uses: number | null; uses_count: number
  } | null
  existingRedemption: { id: string; applied_payment_id: string | null } | null
  pendingRedemption: { id: string } | null
  insertError: { code?: string; message: string } | null
} = {
  user: null,
  customer: null,
  coupon: null,
  existingRedemption: null,
  pendingRedemption: null,
  insertError: null,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'customers') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.customer }) }) }),
      }
      if (table === 'coupons') return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.coupon }) }) }),
      }
      if (table === 'coupon_redemptions') return {
        select: () => ({
          // existing coupon check → .eq('coupon_id').eq('customer_id').maybeSingle()
          eq: (_k: string, _v: string) => ({
            eq: () => ({ maybeSingle: async () => ({ data: state.existingRedemption }) }),
            // pending check → .eq('customer_id').is('applied_payment_id', null).maybeSingle()
            is: () => ({ maybeSingle: async () => ({ data: state.pendingRedemption }) }),
          }),
        }),
        insert: async () => state.insertError ? { error: state.insertError } : { error: null },
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as Record<string, unknown>
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))
vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: vi.fn(async () => state.user),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  state.user = { id: 'u1', email: 'o@x.com' }
  state.customer = { id: 'c1' }
  state.coupon = {
    id: 'cp1', code: 'LAUNCH20',
    discount_type: 'percent', discount_value: 20,
    valid_from: '2020-01-01T00:00:00Z', valid_until: null,
    max_uses: 100, uses_count: 5,
  }
  state.existingRedemption = null
  state.pendingRedemption = null
  state.insertError = null
})

describe('redeemCouponAction', () => {
  it('정상 등록 → success + discountType/Value 반환', async () => {
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('launch20')   // 소문자 입력도 대문자 정규화
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.couponCode).toBe('LAUNCH20')
      expect(r.discountType).toBe('percent')
      expect(r.discountValue).toBe(20)
    }
  })

  it('빈 코드 → 입력 에러', async () => {
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/입력/)
  })

  it('형식 오류 (공백 포함) → 에러', async () => {
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('BAD CODE!')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/형식/)
  })

  it('존재하지 않는 쿠폰 → 에러', async () => {
    state.coupon = null
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('NOTEXIST')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/존재하지/)
  })

  it('만료된 쿠폰 → 에러', async () => {
    state.coupon = { ...state.coupon!, valid_until: '2020-01-02T00:00:00Z' }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/만료/)
  })

  it('uses_count >= max_uses → 소진 에러', async () => {
    state.coupon = { ...state.coupon!, uses_count: 100 }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/소진/)
  })

  it('이미 사용한 쿠폰 (applied_payment_id 있음) → 에러', async () => {
    state.existingRedemption = { id: 'r1', applied_payment_id: 'p-old' }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/이미 사용/)
  })

  it('미적용 상태로 이미 등록된 같은 쿠폰 → 중복 안내', async () => {
    state.existingRedemption = { id: 'r1', applied_payment_id: null }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/이미 등록/)
  })

  it('스태킹 금지 — 다른 쿠폰의 미적용 redemption 이 이미 있음 → 에러', async () => {
    state.pendingRedemption = { id: 'r-other' }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/미적용 쿠폰/)
  })

  it('INSERT 23505 (race duplicate) → 이미 등록됨 에러', async () => {
    state.insertError = { code: '23505', message: 'dup key' }
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/이미 등록/)
  })

  it('customer row 없음 → 카드 등록 요구', async () => {
    state.customer = null
    const { redeemCouponAction } = await import('@/lib/actions/owner-coupon')
    const r = await redeemCouponAction('LAUNCH20')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/카드/)
  })
})
