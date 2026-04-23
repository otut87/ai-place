import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock ────────────────────────────────────────────────
interface State {
  customer: Record<string, unknown> | null
  billingKey: Record<string, unknown> | null
  subscription: Record<string, unknown> | null
  payments: Array<Record<string, unknown>>
  activePlaceCount: number   // T-210
}

const state: State = {
  customer: null,
  billingKey: null,
  subscription: null,
  payments: [],
  activePlaceCount: 0,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.customer, error: null }),
            }),
          }),
        }
      }
      if (table === 'billing_keys') {
        // T-223.5 다중카드 — .select().eq().eq().order().order() 체인 후 배열 awaitable.
        const rows = state.billingKey ? [state.billingKey] : []
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  order: () => Promise.resolve({ data: rows, error: null }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: state.subscription, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }
      }
      if (table === 'payments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: state.payments, error: null }),
              }),
            }),
          }),
        }
      }
      if (table === 'places') {
        // T-210: activePlaceCount 조회 (head + count)
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ count: state.activePlaceCount, error: null }),
            }),
          }),
        }
      }
      if (table === 'coupon_redemptions') {
        // T-229: 미적용 쿠폰 조회 (없으면 빈 배열).
        return {
          select: () => ({
            eq: () => ({
              is: () => ({
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table: ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  state.customer = null
  state.billingKey = null
  state.subscription = null
  state.payments = []
})

describe('loadOwnerBillingState', () => {
  it('admin null → 빈 state', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null as never)
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.customer).toBeNull()
    expect(s.billingKey).toBeNull()
    expect(s.subscription).toBeNull()
    expect(s.recentPayments).toEqual([])
    expect(s.pilotRemainingDays).toBe(30)
  })

  it('customer 없음 → 빈 state 반환', async () => {
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.customer).toBeNull()
    expect(s.pilotRemainingDays).toBe(30)
  })

  it('customer 만 있음 → customer 반환 · billingKey/subscription null', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: '홍길동', phone: '010-1111-2222',
      trial_started_at: null, trial_ends_at: null,
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.customer?.id).toBe('c-1')
    expect(s.customer?.email).toBe('a@b.com')
    expect(s.customer?.name).toBe('홍길동')
    expect(s.billingKey).toBeNull()
    expect(s.subscription).toBeNull()
    expect(s.recentPayments).toEqual([])
  })

  it('trial_ends_at 기반 pilotRemainingDays 계산', async () => {
    const now = new Date('2026-04-22T00:00:00Z')
    const future = new Date(now.getTime() + 10 * 86_400_000).toISOString()
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: '2026-04-10T00:00:00Z',
      trial_ends_at: future,
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1', now)
    expect(s.pilotRemainingDays).toBe(10)
  })

  it('trial_ends_at 이 과거면 음수로도 반환', async () => {
    const now = new Date('2026-04-22T00:00:00Z')
    const past = new Date(now.getTime() - 5 * 86_400_000).toISOString()
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: '2026-03-01T00:00:00Z',
      trial_ends_at: past,
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1', now)
    expect(s.pilotRemainingDays).toBeLessThan(0)
  })

  it('trial_ends_at 비어있으면 기본 30일', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: null, trial_ends_at: null,
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.pilotRemainingDays).toBe(30)
  })

  it('billingKey 존재 → 매핑 필드 확인', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: null, trial_ends_at: null,
    }
    state.billingKey = {
      id: 'bk-1', billing_key: 'BKXYZ', method: '카드',
      card_company: 'SHINHAN', card_number_masked: '****1234', card_type: '신용',
      expiry_year: 2030, expiry_month: 12, status: 'active',
      authenticated_at: '2026-04-20T10:00:00Z',
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.billingKey?.billingKey).toBe('BKXYZ')
    expect(s.billingKey?.cardCompany).toBe('SHINHAN')
    expect(s.billingKey?.expiryYear).toBe(2030)
    expect(s.billingKey?.cardNumberMasked).toBe('****1234')
    expect(s.billingKey?.authenticatedAt).toBe('2026-04-20T10:00:00Z')
  })

  it('subscription 존재 + 결제 이력 → 매핑된 필드 전달', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: null, trial_ends_at: null,
    }
    state.subscription = {
      id: 'sub-1', plan: 'STD', amount: 14900, status: 'active',
      started_at: '2026-04-01T00:00:00Z',
      next_charge_at: '2026-05-01T00:00:00Z',
      canceled_at: null,
      failed_retry_count: 0,
      billing_key_id: 'bk-1',
    }
    state.payments = [
      {
        id: 'p-1', amount: 14900, status: 'succeeded',
        pg_response_message: null, retried_count: 0,
        attempted_at: '2026-04-01T00:00:00Z', succeeded_at: '2026-04-01T00:00:05Z',
      },
      {
        id: 'p-2', amount: 14900, status: 'failed',
        pg_response_message: '카드한도 초과', retried_count: 1,
        attempted_at: '2026-03-01T00:00:00Z', succeeded_at: null,
      },
    ]
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.subscription?.id).toBe('sub-1')
    expect(s.subscription?.amount).toBe(14900)
    expect(s.subscription?.billingKeyId).toBe('bk-1')
    expect(s.recentPayments).toHaveLength(2)
    expect(s.recentPayments[0].status).toBe('succeeded')
    expect(s.recentPayments[1].pgResponseMessage).toBe('카드한도 초과')
    expect(s.recentPayments[1].retriedCount).toBe(1)
  })

  it('subscription 있으나 payments 비어있음', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: null, trial_ends_at: null,
    }
    state.subscription = {
      id: 'sub-1', plan: 'STD', amount: 14900, status: 'pending',
      started_at: null, next_charge_at: null, canceled_at: null,
      failed_retry_count: 0, billing_key_id: null,
    }
    state.payments = []
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.subscription?.status).toBe('pending')
    expect(s.recentPayments).toEqual([])
  })

  it('비정상 ISO (NaN) trial → 기본 30일', async () => {
    state.customer = {
      id: 'c-1', email: 'a@b.com', name: null, phone: null,
      trial_started_at: null, trial_ends_at: 'not-a-date',
    }
    const { loadOwnerBillingState } = await import('@/lib/owner/billing-state')
    const s = await loadOwnerBillingState('user-1')
    expect(s.pilotRemainingDays).toBe(30)
  })
})
