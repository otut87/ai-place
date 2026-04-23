#!/usr/bin/env tsx
// 구독/트라이얼 상태 기준으로 "블로그 발행 대상" 업체 진단
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

async function main() {
  const admin = getAdminClient()
  if (!admin) { console.error('admin unavailable'); process.exit(1) }

  // 1) 전체 active 업체
  const { data: places, count: placeCount } = await admin
    .from('places')
    .select('id, name, slug, city, category, customer_id, owner_id, status', { count: 'exact' })
    .eq('status', 'active')
  console.log(`[places] status=active 전체: ${placeCount}개`)

  const withCustomer = (places ?? []).filter(p => p.customer_id)
  const withoutCustomer = (places ?? []).filter(p => !p.customer_id)
  console.log(`  ├─ customer_id 있음: ${withCustomer.length}개`)
  console.log(`  └─ customer_id 없음 (시드 등): ${withoutCustomer.length}개`)

  console.log(`\n[customer_id 있는 업체 상세]`)
  for (const p of withCustomer) {
    console.log(`  - ${p.name} (${p.slug}) | customer_id=${p.customer_id}`)
  }

  // 2) customers 전체
  const { data: customers } = await admin
    .from('customers')
    .select('id, email, trial_ends_at, created_at')
  console.log(`\n[customers] 전체: ${customers?.length ?? 0}명`)
  const now = Date.now()
  for (const c of customers ?? []) {
    const trialActive = c.trial_ends_at && Date.parse(c.trial_ends_at) > now - 86400_000
    console.log(`  - ${c.email} | trial_ends_at=${c.trial_ends_at ?? '-'}${trialActive ? ' ✅ 트라이얼 유효' : ''}`)
  }

  // 3) subscriptions
  const { data: subs } = await admin
    .from('subscriptions')
    .select('customer_id, status, created_at')
  console.log(`\n[subscriptions] 전체: ${subs?.length ?? 0}건`)
  for (const s of subs ?? []) {
    console.log(`  - customer=${s.customer_id} | status=${s.status}`)
  }

  // 4) 발행 대상 최종 집합
  const eligibleIds = new Set<string>()
  for (const s of subs ?? []) {
    if (['pending', 'active', 'past_due', 'pending_cancellation'].includes(s.status)) {
      eligibleIds.add(s.customer_id)
    }
  }
  for (const c of customers ?? []) {
    if (c.trial_ends_at && Date.parse(c.trial_ends_at) > now - 86400_000) {
      eligibleIds.add(c.id)
    }
  }
  const eligiblePlaces = withCustomer.filter(p => eligibleIds.has(p.customer_id!))
  console.log(`\n🎯 [발행 대상 업체] ${eligiblePlaces.length}개`)
  for (const p of eligiblePlaces) {
    console.log(`  - ${p.name} (${p.slug}) | city=${p.city} | category=${p.category}`)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
