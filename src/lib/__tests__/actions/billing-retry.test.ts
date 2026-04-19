import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockEq = vi.fn()
const mockUpdate = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(async () => ({ id: 'admin-1' })),
}))

vi.mock('@/lib/billing', () => ({
  getPgAdapter: vi.fn(() => ({
    provider: 'mock',
    chargeOnce: vi.fn(async () => ({
      success: true,
      orderId: 'o1',
      paymentKey: 'pk1',
      approvedAt: '2026-04-20T00:00:00Z',
    })),
    issueBillingKey: vi.fn(),
    revoke: vi.fn(),
    verifyWebhook: vi.fn(),
  })),
}))

vi.mock('@/lib/actions/notify', () => ({
  dispatchNotify: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockInsert.mockReset()
  mockEq.mockReset()
  mockUpdate.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockSingle.mockResolvedValue({
    data: {
      id: 'sub-1',
      customer_id: 'cus-1',
      billing_key_id: 'bk-1',
      failed_retry_count: 0,
      status: 'past_due',
      billing_keys: { billing_key: 'bk_x', status: 'active' },
      customers: { name: '홍길동', email: 'hong@example.com' },
    },
    error: null,
  })
  mockInsert.mockResolvedValue({ error: null })
  mockEq.mockResolvedValue({ error: null })
  mockUpdate.mockReturnValue({ eq: mockEq })
  mockSelect.mockReturnValue({ eq: vi.fn(() => ({ single: mockSingle })) })

  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  }))
})

describe('retryBillingFailure', () => {
  it('빈 subscriptionId → 에러', async () => {
    const { retryBillingFailure } = await import('@/lib/actions/billing-retry')
    const r = await retryBillingFailure('')
    expect(r.success).toBe(false)
  })

  it('admin null → 에러', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { retryBillingFailure } = await import('@/lib/actions/billing-retry')
    const r = await retryBillingFailure('sub-1')
    expect(r.success).toBe(false)
  })

  it('구독 조회 실패 → 에러', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { retryBillingFailure } = await import('@/lib/actions/billing-retry')
    const r = await retryBillingFailure('sub-x')
    expect(r.success).toBe(false)
    expect(r.error).toContain('구독')
  })

  it('빌링키 없음 → 재등록 필요 에러', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'sub-1', customer_id: 'cus-1', billing_key_id: null,
        failed_retry_count: 0, status: 'past_due',
        billing_keys: null,
        customers: { name: '홍', email: 'h@x.com' },
      },
      error: null,
    })
    const { retryBillingFailure } = await import('@/lib/actions/billing-retry')
    const r = await retryBillingFailure('sub-1')
    expect(r.success).toBe(false)
    expect(r.error).toContain('카드')
  })

  it('성공 → payments insert + subscriptions update', async () => {
    const { retryBillingFailure } = await import('@/lib/actions/billing-retry')
    const r = await retryBillingFailure('sub-1')
    expect(r.success).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalled()
  })
})
