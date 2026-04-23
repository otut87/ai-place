// T-229 — admin-coupon 액션 테스트 (createCouponAction / deactivateCouponAction).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(async () => ({ id: 'admin-1', email: 'a@test.com' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockInsertSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn((table: string) => {
  if (table === 'coupons') {
    return {
      insert: () => ({
        select: () => ({ single: () => mockInsertSingle() }),
      }),
      update: () => ({ eq: mockUpdateEq }),
    }
  }
  throw new Error(`unexpected table ${table}`)
})
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockInsertSingle.mockReset()
  mockUpdateEq.mockReset().mockResolvedValue({ error: null })
})

describe('createCouponAction', () => {
  it('admin null → admin_unavailable', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'TEST', discountType: 'percent', discountValue: 10 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('admin_unavailable')
  })

  it('코드 형식 오류 → 에러', async () => {
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'ab', discountType: 'percent', discountValue: 10 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('코드 형식')
  })

  it('percent 할인 범위 1~100', async () => {
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const over = await createCouponAction({ code: 'OVER', discountType: 'percent', discountValue: 150 })
    expect(over.success).toBe(false)
    const zero = await createCouponAction({ code: 'ZERO', discountType: 'percent', discountValue: 0 })
    expect(zero.success).toBe(false)
  })

  it('fixed 할인 1원 이상', async () => {
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'FIX0', discountType: 'fixed', discountValue: 0 })
    expect(r.success).toBe(false)
  })

  it('정상 생성 → couponId 반환', async () => {
    mockInsertSingle.mockResolvedValueOnce({ data: { id: 'c-1' }, error: null })
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'LAUNCH20', discountType: 'percent', discountValue: 20 })
    expect(r.success).toBe(true)
    if (r.success) expect(r.couponId).toBe('c-1')
  })

  it('UNIQUE 위반(23505) → 중복 에러', async () => {
    mockInsertSingle.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'dup' } })
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'DUP', discountType: 'percent', discountValue: 10 })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('이미 존재')
  })

  it('코드 자동 대문자화', async () => {
    mockInsertSingle.mockResolvedValueOnce({ data: { id: 'c-2' }, error: null })
    const { createCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await createCouponAction({ code: 'lower20', discountType: 'percent', discountValue: 20 })
    expect(r.success).toBe(true)
  })
})

describe('deactivateCouponAction', () => {
  it('admin null → admin_unavailable', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { deactivateCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await deactivateCouponAction('c-1')
    expect(r.success).toBe(false)
  })

  it('update 성공 → success', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: null })
    const { deactivateCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await deactivateCouponAction('c-1')
    expect(r.success).toBe(true)
  })

  it('update 에러 → 실패 + message 전달', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'db error' } })
    const { deactivateCouponAction } = await import('@/lib/actions/admin-coupon')
    const r = await deactivateCouponAction('c-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('db error')
  })
})
