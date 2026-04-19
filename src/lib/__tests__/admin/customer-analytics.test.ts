import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCohorts, type CustomerRow } from '@/lib/admin/customer-analytics'

function mk(cohort: string | null, payments: number): CustomerRow {
  return {
    id: crypto.randomUUID(),
    name: null,
    email: 'x@example.com',
    subscriptionStatus: 'active',
    amount: 33000,
    paidTotal: 33000 * payments,
    paymentCount: payments,
    startedAt: null,
    cohortMonth: cohort,
  }
}

describe('buildCohorts', () => {
  it('같은 코호트 그룹핑', () => {
    const rows = [mk('2026-03', 3), mk('2026-03', 2), mk('2026-04', 1)]
    const c = buildCohorts(rows, 6)
    expect(c).toHaveLength(2)
    expect(c[0].cohortMonth).toBe('2026-03')
    expect(c[0].cohortSize).toBe(2)
  })

  it('리텐션 계산', () => {
    const rows = [mk('2026-03', 3), mk('2026-03', 1)]
    const c = buildCohorts(rows, 6)
    const m = c[0].retentionByMonthOffset
    expect(m[0]).toBe(1)
    expect(m[1]).toBe(0.5)
    expect(m[2]).toBe(0.5)
    expect(m[3]).toBe(0)
  })

  it('cohortMonth null 제외', () => {
    const rows = [mk(null, 3), mk('2026-04', 1)]
    const c = buildCohorts(rows)
    expect(c).toHaveLength(1)
  })

  it('오름차순 정렬', () => {
    const rows = [mk('2026-06', 1), mk('2026-03', 1), mk('2026-05', 1)]
    const c = buildCohorts(rows)
    expect(c.map(x => x.cohortMonth)).toEqual(['2026-03', '2026-05', '2026-06'])
  })
})

// ── listCustomersWithAnalytics ─────────────────────────────
const mockCustomersLimit = vi.fn()
const mockSubsIn = vi.fn()
const mockPaysIn = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockCustomersLimit.mockReset()
  mockSubsIn.mockReset()
  mockPaysIn.mockReset()
  mockFrom.mockReset()

  mockCustomersLimit.mockResolvedValue({
    data: [
      { id: 'c1', name: '홍길동', email: 'hong@example.com' },
    ],
    error: null,
  })
  mockSubsIn.mockResolvedValue({
    data: [
      { id: 's1', customer_id: 'c1', status: 'active', amount: 33000, started_at: '2026-03-01T00:00:00Z' },
    ],
    error: null,
  })
  mockPaysIn.mockResolvedValue({
    data: [
      { subscription_id: 's1', amount: 33000, status: 'succeeded', succeeded_at: '2026-03-05T00:00:00Z' },
      { subscription_id: 's1', amount: 33000, status: 'succeeded', succeeded_at: '2026-04-05T00:00:00Z' },
    ],
    error: null,
  })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'customers') {
      return {
        select: vi.fn(() => ({ order: vi.fn(() => ({ limit: mockCustomersLimit })) })),
      }
    }
    if (table === 'subscriptions') {
      return { select: vi.fn(() => ({ in: mockSubsIn })) }
    }
    if (table === 'payments') {
      return { select: vi.fn(() => ({ in: mockPaysIn })) }
    }
    return {}
  })
})

describe('listCustomersWithAnalytics', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listCustomersWithAnalytics } = await import('@/lib/admin/customer-analytics')
    expect(await listCustomersWithAnalytics()).toEqual([])
  })

  it('고객 없음 → []', async () => {
    mockCustomersLimit.mockResolvedValueOnce({ data: [], error: null })
    const { listCustomersWithAnalytics } = await import('@/lib/admin/customer-analytics')
    expect(await listCustomersWithAnalytics()).toEqual([])
  })

  it('LTV·paymentCount·cohortMonth 집계', async () => {
    const { listCustomersWithAnalytics } = await import('@/lib/admin/customer-analytics')
    const r = await listCustomersWithAnalytics()
    expect(r).toHaveLength(1)
    expect(r[0].paidTotal).toBe(66000)
    expect(r[0].paymentCount).toBe(2)
    expect(r[0].cohortMonth).toBe('2026-03')
  })
})
