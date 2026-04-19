// T-082 — 고객 라이프사이클·LTV·코호트.
// 원칙: 기존 테이블만 사용 (customers/subscriptions/payments). 신규 테이블 금지.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface CustomerRow {
  id: string
  name: string | null
  email: string
  subscriptionStatus: string | null
  amount: number | null
  paidTotal: number         // payments succeeded 합계
  paymentCount: number
  startedAt: string | null
  cohortMonth: string | null   // 'YYYY-MM' (첫 결제월)
}

interface SubRow { customer_id: string; status: string; amount: number | null; started_at: string | null }
interface PayRow { subscription_id: string; amount: number; status: string; succeeded_at: string | null }

export async function listCustomersWithAnalytics(limit = 200): Promise<CustomerRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const { data: customers } = await admin
    .from('customers')
    .select('id, name, email')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (!customers) return []
  const custArr = customers as Array<{ id: string; name: string | null; email: string }>
  const custIds = custArr.map(c => c.id)
  if (custIds.length === 0) return []

  const { data: subs } = await admin
    .from('subscriptions')
    .select('id, customer_id, status, amount, started_at')
    .in('customer_id', custIds)
  const subRows = (subs ?? []) as Array<SubRow & { id: string }>

  const { data: pays } = await admin
    .from('payments')
    .select('subscription_id, amount, status, succeeded_at')
    .in('subscription_id', subRows.map(s => s.id))
  const payRows = (pays ?? []) as PayRow[]

  // 집계
  const subByCustomer = new Map<string, SubRow & { id: string }>()
  for (const s of subRows) if (!subByCustomer.has(s.customer_id)) subByCustomer.set(s.customer_id, s)

  const payBySub = new Map<string, PayRow[]>()
  for (const p of payRows) {
    const arr = payBySub.get(p.subscription_id) ?? []
    arr.push(p)
    payBySub.set(p.subscription_id, arr)
  }

  return custArr.map<CustomerRow>((c) => {
    const sub = subByCustomer.get(c.id) ?? null
    const subPays = sub ? (payBySub.get(sub.id) ?? []) : []
    const succeeded = subPays.filter(p => p.status === 'succeeded')
    const paidTotal = succeeded.reduce((sum, p) => sum + (p.amount ?? 0), 0)
    const cohortMonth = firstSucceededMonth(succeeded)

    return {
      id: c.id,
      name: c.name,
      email: c.email,
      subscriptionStatus: sub?.status ?? null,
      amount: sub?.amount ?? null,
      paidTotal,
      paymentCount: succeeded.length,
      startedAt: sub?.started_at ?? null,
      cohortMonth,
    }
  })
}

function firstSucceededMonth(pays: PayRow[]): string | null {
  const firstDate = pays
    .map(p => p.succeeded_at)
    .filter((s): s is string => !!s)
    .sort()[0]
  return firstDate ? firstDate.slice(0, 7) : null
}

/** 월별 코호트 리텐션: 첫 결제월 별 신규 고객 수 + 이후 N개월 생존 비율. */
export interface CohortCell {
  cohortMonth: string
  cohortSize: number
  retentionByMonthOffset: number[]     // [m0, m1, m2, ...] — 1.0 = 전원 유지
}

export function buildCohorts(rows: CustomerRow[], monthsWindow = 6): CohortCell[] {
  const byCohort = new Map<string, CustomerRow[]>()
  for (const r of rows) {
    if (!r.cohortMonth) continue
    const list = byCohort.get(r.cohortMonth) ?? []
    list.push(r)
    byCohort.set(r.cohortMonth, list)
  }

  const cohorts: CohortCell[] = []
  for (const [month, members] of byCohort) {
    const size = members.length
    const retention: number[] = []
    // 간이 리텐션: paymentCount >= (offset+1) 인 고객 비율
    for (let offset = 0; offset < monthsWindow; offset++) {
      const alive = members.filter(m => m.paymentCount >= offset + 1).length
      retention.push(size === 0 ? 0 : alive / size)
    }
    cohorts.push({ cohortMonth: month, cohortSize: size, retentionByMonthOffset: retention })
  }
  return cohorts.sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
}
