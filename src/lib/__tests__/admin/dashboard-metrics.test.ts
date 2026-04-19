import { describe, it, expect, vi, beforeEach } from 'vitest'

// T-087 — 새 지표(MRR·봇·해지·404) 포함. 체이너빌 mock 으로 통일.

const mockLimit = vi.fn()
const mockFrom = vi.fn()

let mrrData: Array<{ amount: number | null }> = []
let botRows: Array<{ status: number | null }> = []

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/admin/billing-queries', () => ({
  listExpiringCards: vi.fn(async () => []),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockFrom.mockReset()
  mrrData = [{ amount: 33000 }, { amount: 33000 }]
  botRows = [
    { status: 200 }, { status: 200 }, { status: 200 }, { status: 404 },
  ]

  mockLimit.mockResolvedValue({
    data: [
      { id: 'a-1', actor_type: 'human', action: 'status', field: null, place_id: 'p-1', created_at: '2026-04-18T00:00:00Z' },
    ],
    error: null,
  })

  mockFrom.mockImplementation((table: string) => {
    const builder: Record<string, unknown> = {}
    // 모든 체인 메서드가 자기 자신을 반환하고, 최종 await 시 Promise 해결.
    const result: { count?: number; data?: unknown; error: null } = { error: null }
    if (table === 'places' || table === 'blog_posts' || table === 'pipeline_jobs' || table === 'payments' || table === 'subscriptions') {
      result.count = 3
    }
    if (table === 'subscriptions' && !result.count) {
      result.data = mrrData
    }
    // subscriptions MRR select amount eq — data 필요
    const mrrResult = { data: mrrData, error: null }
    const botResult = { data: botRows, error: null }

    builder.eq = vi.fn(() => builder)
    builder.gte = vi.fn(() => builder)
    builder.lt = vi.fn(() => builder)
    builder.not = vi.fn(() => builder)
    builder.order = vi.fn(() => ({ limit: mockLimit }))
    builder.limit = vi.fn(() => builder)

    // 최종 Promise resolution — context 에 따라 달라야 함
    builder.then = (cb: (v: unknown) => unknown) => {
      // MRR: subscriptions + eq('status','active') + select('amount')
      if (table === 'subscriptions' && (builder.eq as unknown as { mock?: { calls: unknown[] } }).mock?.calls.length && !(builder.not as unknown as { mock?: { calls: unknown[] } }).mock?.calls.length) {
        // MRR select — but also used for cancellations (with .not)
        return Promise.resolve(mrrResult).then(cb)
      }
      if (table === 'bot_visits') return Promise.resolve(botResult).then(cb)
      return Promise.resolve(result).then(cb)
    }

    return { select: vi.fn(() => builder) }
  })
})

describe('getDashboardMetrics', () => {
  it('admin null → 모든 0', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.pendingPlaces).toBe(0)
    expect(r.mrrKrw).toBe(0)
    expect(r.botVisits7d).toBe(0)
    expect(r.bot404Rate7d).toBe(0)
  })

  it('기본 3 count 매핑', async () => {
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.pendingPlaces).toBe(3)
    expect(r.activePlaces).toBe(3)
    expect(r.rejectedPlaces).toBe(3)
  })

  it('billingExpiringSoon 은 listExpiringCards 결과 길이', async () => {
    const { listExpiringCards } = await import('@/lib/admin/billing-queries')
    vi.mocked(listExpiringCards).mockResolvedValueOnce([
      { id: 'bk1', customerId: 'c1', customerName: null, customerEmail: null, cardCompany: null, cardNumberMasked: null, daysLeft: 5, expiryYear: 2026, expiryMonth: 5 },
      { id: 'bk2', customerId: 'c2', customerName: null, customerEmail: null, cardCompany: null, cardNumberMasked: null, daysLeft: 20, expiryYear: 2026, expiryMonth: 5 },
    ])
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.billingExpiringSoon).toBe(2)
  })
})

describe('getRecentActivity', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getRecentActivity } = await import('@/lib/admin/dashboard-metrics')
    expect(await getRecentActivity()).toEqual([])
  })

  it('DB 에러 → []', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { getRecentActivity } = await import('@/lib/admin/dashboard-metrics')
    expect(await getRecentActivity()).toEqual([])
  })

  it('정상 반환', async () => {
    const { getRecentActivity } = await import('@/lib/admin/dashboard-metrics')
    const r = await getRecentActivity(5)
    expect(r).toHaveLength(1)
    expect(r[0].actor_type).toBe('human')
  })
})

describe('dashboardIssuesCount', () => {
  it('5개 영역 합산 (pendingCancellations 포함)', async () => {
    const { dashboardIssuesCount } = await import('@/lib/admin/dashboard-metrics')
    expect(dashboardIssuesCount({
      pendingPlaces: 3, activePlaces: 10, rejectedPlaces: 1,
      publishedToday: 0, pipelineFailures: 2,
      billingFailures: 1, billingExpiringSoon: 4,
      mrrKrw: 0, botVisits7d: 0, bot404Rate7d: 0,
      pendingCancellationsThisMonth: 2,
    })).toBe(3 + 2 + 1 + 4 + 2)
  })
})
