import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn()
const mockLimit = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockEq.mockReset()
  mockLimit.mockReset()
  mockFrom.mockReset()

  mockEq.mockResolvedValue({ count: 3, error: null })
  mockLimit.mockResolvedValue({
    data: [
      { id: 'a-1', actor_type: 'human', action: 'status', field: null, place_id: 'p-1', created_at: '2026-04-18T00:00:00Z' },
    ],
    error: null,
  })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: mockEq,
      order: vi.fn(() => ({ limit: mockLimit })),
    })),
  }))
})

describe('getDashboardMetrics', () => {
  it('admin null → 모두 0', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.pendingPlaces).toBe(0)
    expect(r.activePlaces).toBe(0)
  })

  it('정상 집계 — pending/active/rejected 각 쿼리 결과 매핑', async () => {
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.pendingPlaces).toBe(3)
    expect(r.activePlaces).toBe(3)
    expect(r.rejectedPlaces).toBe(3)
  })

  it('count null → 0', async () => {
    mockEq.mockResolvedValue({ count: null, error: null })
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.pendingPlaces).toBe(0)
  })

  it('T-073/074/076/078 이전 지표는 0', async () => {
    const { getDashboardMetrics } = await import('@/lib/admin/dashboard-metrics')
    const r = await getDashboardMetrics()
    expect(r.publishedToday).toBe(0)
    expect(r.pipelineFailures).toBe(0)
    expect(r.billingFailures).toBe(0)
    expect(r.billingExpiringSoon).toBe(0)
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
  it('4개 영역 합산', async () => {
    const { dashboardIssuesCount } = await import('@/lib/admin/dashboard-metrics')
    expect(dashboardIssuesCount({
      pendingPlaces: 3,
      activePlaces: 10,
      rejectedPlaces: 1,
      publishedToday: 0,
      pipelineFailures: 2,
      billingFailures: 1,
      billingExpiringSoon: 4,
    })).toBe(3 + 2 + 1 + 4)
  })
})
