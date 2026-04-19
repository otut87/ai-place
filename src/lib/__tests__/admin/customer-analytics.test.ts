import { describe, it, expect } from 'vitest'
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
    expect(c[1].cohortMonth).toBe('2026-04')
  })

  it('리텐션: m0 = 100%, m1 = 첫달 이상 결제한 비율', () => {
    const rows = [mk('2026-03', 3), mk('2026-03', 1)]
    const c = buildCohorts(rows, 6)
    const m = c[0].retentionByMonthOffset
    expect(m[0]).toBe(1)                 // 2명 모두 최소 1회
    expect(m[1]).toBe(0.5)              // 3회 결제 1명만 2회 이상
    expect(m[2]).toBe(0.5)
    expect(m[3]).toBe(0)
  })

  it('cohortMonth null 은 제외', () => {
    const rows = [mk(null, 3), mk('2026-04', 1)]
    const c = buildCohorts(rows)
    expect(c).toHaveLength(1)
    expect(c[0].cohortMonth).toBe('2026-04')
  })

  it('오름차순 정렬', () => {
    const rows = [mk('2026-06', 1), mk('2026-03', 1), mk('2026-05', 1)]
    const c = buildCohorts(rows)
    expect(c.map(x => x.cohortMonth)).toEqual(['2026-03', '2026-05', '2026-06'])
  })
})
