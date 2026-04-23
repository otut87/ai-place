#!/usr/bin/env tsx
/**
 * T-220.6 — /owner/billing rework 이전 baseline 측정.
 *
 * 리포트:
 * 1. signup → paid 전환율 (최근 90일)
 * 2. past_due → active 회복률 (최근 90일)
 * 3. pending_cancellation → canceled 완료 / 번복 비율
 * 4. 평균 pilot 경과 일수 × 활성 업체 수 분포
 *
 * 사용법: npx tsx scripts/billing-conversion-baseline.ts [--days=90]
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

const DAYS = Number(process.argv.find((a) => a.startsWith('--days='))?.split('=')[1] ?? 90)
const WINDOW_MS = DAYS * 86_400_000

function pct(n: number, d: number): string {
  if (d === 0) return 'n/a'
  return `${((n / d) * 100).toFixed(1)}%`
}

async function main() {
  const admin = getAdminClient()
  if (!admin) throw new Error('admin client unavailable (SUPABASE_SERVICE_ROLE_KEY 확인)')

  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()
  console.log(`\n=== T-220.6 billing conversion baseline (지난 ${DAYS}일) ===\n`)

  // 1) signup → paid 전환율
  // 지난 N일 내 생성된 customers + 해당 customer 의 subscription.status
  const { data: customers } = await admin
    .from('customers')
    .select('id, created_at, trial_ends_at')
    .gte('created_at', windowStart)

  const customerList = (customers ?? []) as Array<{ id: string; created_at: string; trial_ends_at: string | null }>
  const customerIds = customerList.map((c) => c.id)

  let activeOrPaying = 0
  let stillPilot = 0
  let churned = 0
  let suspended = 0
  if (customerIds.length > 0) {
    const { data: subs } = await admin
      .from('subscriptions')
      .select('customer_id, status')
      .in('customer_id', customerIds)

    const latestByCustomer = new Map<string, string>()
    for (const r of (subs ?? []) as Array<{ customer_id: string; status: string }>) {
      latestByCustomer.set(r.customer_id, r.status)
    }

    for (const c of customerList) {
      const status = latestByCustomer.get(c.id) ?? 'no_subscription'
      if (status === 'active' || status === 'past_due') activeOrPaying += 1
      else if (status === 'pending' || status === 'no_subscription') stillPilot += 1
      else if (status === 'canceled' || status === 'pending_cancellation') churned += 1
      else if (status === 'suspended') suspended += 1
    }
  }

  console.log('1) signup → paid 전환율')
  console.log(`   신규 가입: ${customerList.length}`)
  console.log(`   active/past_due: ${activeOrPaying} (${pct(activeOrPaying, customerList.length)})`)
  console.log(`   pending/no_sub: ${stillPilot}`)
  console.log(`   canceled/pending_cancel: ${churned}`)
  console.log(`   suspended: ${suspended}`)
  console.log(`   ⭐ 전환율 baseline: ${pct(activeOrPaying, customerList.length)}\n`)

  // 2) past_due → active 회복률 (recent payments 로 추정)
  // 지난 N일간 past_due 로 전환된 subscription 중 이후 active 로 복귀한 비율
  const { data: pastDuePayments } = await admin
    .from('payments')
    .select('subscription_id, status, attempted_at')
    .eq('status', 'failed')
    .gte('attempted_at', windowStart)

  const pdSubs = new Set<string>()
  for (const p of (pastDuePayments ?? []) as Array<{ subscription_id: string }>) {
    pdSubs.add(p.subscription_id)
  }

  let recovered = 0
  if (pdSubs.size > 0) {
    const { data: currentStatus } = await admin
      .from('subscriptions')
      .select('id, status')
      .in('id', Array.from(pdSubs))
    for (const s of (currentStatus ?? []) as Array<{ id: string; status: string }>) {
      if (s.status === 'active') recovered += 1
    }
  }

  console.log('2) past_due → active 회복률')
  console.log(`   past_due 진입: ${pdSubs.size}`)
  console.log(`   현재 active 복귀: ${recovered}`)
  console.log(`   ⭐ 회복률 baseline: ${pct(recovered, pdSubs.size)}\n`)

  // 3) pending_cancellation 번복 비율
  const { data: cancelRequests } = await admin
    .from('subscriptions')
    .select('id, status, pending_cancel_at, canceled_at')
    .or('status.eq.pending_cancellation,status.eq.canceled')
    .gte('updated_at', windowStart)

  const cancelList = (cancelRequests ?? []) as Array<{
    id: string; status: string; pending_cancel_at: string | null; canceled_at: string | null
  }>
  const pending = cancelList.filter((c) => c.status === 'pending_cancellation').length
  const finalized = cancelList.filter((c) => c.status === 'canceled').length

  console.log('3) 해지 flow')
  console.log(`   pending_cancellation 중: ${pending}`)
  console.log(`   canceled 완료: ${finalized}`)
  console.log(`   (번복율은 timeline 이벤트 있어야 측정 — 현재는 snapshot 기준 disallow)\n`)

  // 4) pilot 경과 × place 수 분포
  const { data: activeSubs } = await admin
    .from('subscriptions')
    .select('customer_id, amount, status')
    .eq('status', 'active')

  const activeCount = (activeSubs ?? []).length
  const totalMrr = ((activeSubs ?? []) as Array<{ amount: number }>).reduce((s, r) => s + r.amount, 0)

  console.log('4) 현재 MRR snapshot')
  console.log(`   active subscriptions: ${activeCount}`)
  console.log(`   총 MRR: ₩${totalMrr.toLocaleString('ko-KR')}`)
  console.log(`   평균 amount/customer: ₩${activeCount > 0 ? Math.round(totalMrr / activeCount).toLocaleString('ko-KR') : 0}\n`)

  console.log('=== 리포트 종료 ===')
  console.log('\n💡 rework 목표 (T-220.6 → T-230 후 재측정):')
  console.log(`   - 전환율: ${pct(activeOrPaying, customerList.length)} → +5~10%pt`)
  console.log(`   - 회복률: ${pct(recovered, pdSubs.size)} → +10~20%pt`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
