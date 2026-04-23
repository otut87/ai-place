// T-224 — ownerRetryBillingAction 테스트.
// 외부 의존성 전부 mock — 소유권·상태·rate limit·advisory lock 분기 검증.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: vi.fn(async () => ({ id: 'user-1', email: 'o@test.com' })),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// billing / notify / coupon 전부 mock
vi.mock('@/lib/billing', () => ({ getPgAdapter: vi.fn(() => ({})) }))
vi.mock('@/lib/billing/charge-subscription', () => ({
  chargeSubscriptionOnce: vi.fn(),
}))
vi.mock('@/lib/actions/notify', () => ({
  dispatchNotify: vi.fn(async () => undefined),
}))
vi.mock('@/lib/billing/coupon', () => ({
  loadUnappliedRedemption: vi.fn(async () => null),
  calcDiscountedAmount: vi.fn((amount: number) => amount),
  markRedemptionApplied: vi.fn(async () => undefined),
}))

const mockSubLoad = vi.fn()
const mockLockUpdate = vi.fn()
const mockPaymentInsert = vi.fn()
const mockSubPatch = vi.fn()
const mockPlacesCount = vi.fn()
const mockErrorUnlock = vi.fn()

function makeAdmin() {
  return {
    from: (table: string) => {
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => mockSubLoad() }),
          }),
          update: (patch: Record<string, unknown>) => ({
            eq: (_col: string, _val: string) => ({
              or: () => ({ select: () => mockLockUpdate(patch) }),
            }),
            // error recovery path: update({charging_started_at: null}).eq(id,row.id)
            // — .or 없이 .eq 만 체이닝되면 mockErrorUnlock 호출
            ...(Object.keys(patch).length === 1 && patch.charging_started_at === null
              ? { then: (cb: (r: unknown) => void) => cb(mockErrorUnlock(patch)) }
              : {}),
          }),
        }
      }
      if (table === 'payments') {
        return {
          insert: () => ({
            select: () => ({ single: () => mockPaymentInsert() }),
          }),
        }
      }
      if (table === 'places') {
        return {
          select: () => ({
            eq: () => ({ eq: () => mockPlacesCount() }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  mockSubLoad.mockReset()
  mockLockUpdate.mockReset().mockResolvedValue({ data: [{ id: 's-1' }], error: null })
  mockPaymentInsert.mockReset().mockResolvedValue({ data: { id: 'p-1' }, error: null })
  mockSubPatch.mockReset()
  mockPlacesCount.mockReset().mockResolvedValue({ count: 1, error: null })
  mockErrorUnlock.mockReset().mockResolvedValue({ error: null })
})

describe('ownerRetryBillingAction', () => {
  it('subscriptionId 누락 → 에러', async () => {
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('')
    expect(r.success).toBe(false)
  })

  it('admin null → admin_unavailable', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
  })

  it('구독 없음 → 에러', async () => {
    mockSubLoad.mockResolvedValueOnce({ data: null, error: null })
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
  })

  it('다른 오너 구독 → 에러', async () => {
    mockSubLoad.mockResolvedValueOnce({
      data: {
        id: 's-1', customer_id: 'c-1', billing_key_id: 'bk-1',
        failed_retry_count: 0, status: 'past_due', amount: 14900,
        charging_started_at: null,
        billing_keys: { billing_key: 'bk', status: 'active' },
        customers: { name: 'X', email: 'x@x', user_id: 'other-user' },
      },
      error: null,
    })
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('본인')
  })

  it('status != past_due → 재시도 불가', async () => {
    mockSubLoad.mockResolvedValueOnce({
      data: {
        id: 's-1', customer_id: 'c-1', billing_key_id: 'bk-1',
        failed_retry_count: 0, status: 'active', amount: 14900,
        charging_started_at: null,
        billing_keys: { billing_key: 'bk', status: 'active' },
        customers: { name: 'X', email: 'x@x', user_id: 'user-1' },
      },
      error: null,
    })
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('재시도할 수 없습니다')
  })

  it('active 카드 없음 → 에러', async () => {
    mockSubLoad.mockResolvedValueOnce({
      data: {
        id: 's-1', customer_id: 'c-1', billing_key_id: 'bk-1',
        failed_retry_count: 0, status: 'past_due', amount: 14900,
        charging_started_at: null,
        billing_keys: { billing_key: 'bk', status: 'inactive' },
        customers: { name: 'X', email: 'x@x', user_id: 'user-1' },
      },
      error: null,
    })
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('활성 카드')
  })

  it('rate limit 5분 이내 → 대기 안내', async () => {
    const recent = new Date(Date.now() - 60_000).toISOString() // 1분 전
    mockSubLoad.mockResolvedValueOnce({
      data: {
        id: 's-1', customer_id: 'c-1', billing_key_id: 'bk-1',
        failed_retry_count: 0, status: 'past_due', amount: 14900,
        charging_started_at: recent,
        billing_keys: { billing_key: 'bk', status: 'active' },
        customers: { name: 'X', email: 'x@x', user_id: 'user-1' },
      },
      error: null,
    })
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('재시도해 주세요')
  })

  it('advisory lock 획득 실패 → 이미 진행 중', async () => {
    mockSubLoad.mockResolvedValueOnce({
      data: {
        id: 's-1', customer_id: 'c-1', billing_key_id: 'bk-1',
        failed_retry_count: 0, status: 'past_due', amount: 14900,
        charging_started_at: null,
        billing_keys: { billing_key: 'bk', status: 'active' },
        customers: { name: 'X', email: 'x@x', user_id: 'user-1' },
      },
      error: null,
    })
    mockLockUpdate.mockResolvedValueOnce({ data: [], error: null })  // lock 미획득
    const { ownerRetryBillingAction } = await import('@/lib/actions/owner-billing-retry')
    const r = await ownerRetryBillingAction('s-1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('이미 결제 시도')
  })
})
