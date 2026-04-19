import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBillingKeysEq = vi.fn()
const mockPaymentsLimit = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

const now = new Date('2026-04-20T00:00:00Z')
vi.useFakeTimers().setSystemTime(now)

beforeEach(() => {
  mockBillingKeysEq.mockReset()
  mockPaymentsLimit.mockReset()
  mockFrom.mockReset()

  // 만료 2026-05 (약 11일 남음), 2027-04 (약 1년 남음)
  mockBillingKeysEq.mockResolvedValue({
    data: [
      { id: 'bk1', customer_id: 'c1', card_company: '삼성', card_number_masked: '1234-****-****-5678', expiry_year: 2026, expiry_month: 5, customers: { name: '홍', email: 'h@x.com' } },
      { id: 'bk2', customer_id: 'c2', card_company: '신한', card_number_masked: '9999-****-****-0000', expiry_year: 2027, expiry_month: 4, customers: null },
      { id: 'bk3', customer_id: 'c3', card_company: null, card_number_masked: null, expiry_year: null, expiry_month: null, customers: null },
    ],
    error: null,
  })

  mockPaymentsLimit.mockResolvedValue({
    data: [
      {
        id: 'p1', subscription_id: 's1', amount: 33000, status: 'succeeded',
        pg_order_id: 'ord_1', pg_response_code: null, pg_response_message: null,
        retried_count: 0, attempted_at: '2026-04-20T00:00:00Z', succeeded_at: '2026-04-20T00:00:00Z',
        subscriptions: { customer_id: 'c1', customers: { name: '홍', email: 'h@x.com' } },
      },
    ],
    error: null,
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'billing_keys') {
      return { select: vi.fn(() => ({ eq: mockBillingKeysEq })) }
    }
    if (table === 'payments') {
      // payments 체인: select().order().limit() 후에도 .eq() 필터 가능해야 함.
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.order = vi.fn(() => chain)
      chain.limit = vi.fn(() => chain)
      chain.then = (cb: (v: unknown) => unknown) => mockPaymentsLimit().then(cb)
      return { select: vi.fn(() => chain) }
    }
    return {}
  })
})

describe('listExpiringCards', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listExpiringCards } = await import('@/lib/admin/billing-queries')
    expect(await listExpiringCards()).toEqual([])
  })

  it('withinDays 필터 + 만료일 없는 카드 제외', async () => {
    const { listExpiringCards } = await import('@/lib/admin/billing-queries')
    const r = await listExpiringCards(60)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('bk1')
  })

  it('daysLeft 오름차순', async () => {
    const { listExpiringCards } = await import('@/lib/admin/billing-queries')
    const r = await listExpiringCards(400)  // 1년까지 포함
    expect(r[0].daysLeft).toBeLessThanOrEqual(r[1]?.daysLeft ?? Infinity)
  })
})

describe('listPaymentHistory', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listPaymentHistory } = await import('@/lib/admin/billing-queries')
    expect(await listPaymentHistory()).toEqual([])
  })

  it('정상 조회', async () => {
    const { listPaymentHistory } = await import('@/lib/admin/billing-queries')
    const r = await listPaymentHistory({ status: 'succeeded' })
    expect(r).toHaveLength(1)
    expect(r[0].pgOrderId).toBe('ord_1')
    expect(r[0].customerEmail).toBe('h@x.com')
  })

  it('ord_ 검색', async () => {
    const { listPaymentHistory } = await import('@/lib/admin/billing-queries')
    const r = await listPaymentHistory({ search: 'ord_1' })
    expect(r).toHaveLength(1)
  })
})
