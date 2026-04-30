// T-259 R6 (2B) — 파일럿(trial_ends_at) 만료 + 카드 미등록 customer 의 places 를
//   status='inactive' 로 전환하는 daily cron.
//
// register-first 흐름에서 카드 미등록인 owner 의 무료 페이지가 영구히 노출되지 않도록
// 파일럿 만료 시점에 자동 비활성화. 카드 등록 시 issueBillingKeyAction 의 reactivation
// 이 같은 places 를 다시 active 로 복구.
//
// 실행: 매일 03:00 KST (vercel.json crons).
// 동작:
//   1) trial_ends_at < now 인 customer 조회 (limit 1000).
//   2) 각 customer 별로 active billing_key 가 0 개인지 확인.
//   3) 카드 0 → places.status IN ('active','pending') 을 'inactive' 로 update.
//   4) 응답 JSON 에 결과 카운트.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { verifyCronAuth } from '@/lib/cron/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const unauthorized = verifyCronAuth(req)
  if (unauthorized) return unauthorized

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const nowIso = new Date().toISOString()

  // 1) 파일럿 만료 customer 들 조회
  const { data: customers, error: custErr } = await admin
    .from('customers')
    .select('id, email, name, trial_ends_at')
    .lt('trial_ends_at', nowIso)
    .limit(1000)

  if (custErr || !customers) {
    return NextResponse.json({ error: custErr?.message ?? 'query_failed' }, { status: 500 })
  }

  let processedCustomers = 0
  let deactivatedPlaces = 0

  for (const c of customers as Array<{
    id: string; email: string | null; name: string | null; trial_ends_at: string | null
  }>) {
    // 2) 카드 0개 확인
    const { count } = await admin
      .from('billing_keys')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', c.id)
      .eq('status', 'active')
    if ((count ?? 0) > 0) continue
    processedCustomers += 1

    // 3) places.status active|pending → inactive 전환
    //    'inactive' 는 places.status check 제약에 포함돼 있어야 함.
    //    포함 안 돼 있다면 마이그레이션 필요 — 현재 정책상 'active'|'pending'|'rejected' 외
    //    'inactive' 가 새로 추가되어야 하면 별도 PR.
    const { data: deactivated, error: updErr } = await admin
      .from('places')
      .update({ status: 'inactive', updated_at: nowIso })
      .eq('customer_id', c.id)
      .in('status', ['active', 'pending'])
      .select('id, name')

    if (updErr) {
      console.error(`[pilot-expiry] places update failed for customer ${c.id}:`, updErr.message)
      continue
    }

    const rows = (deactivated as Array<{ id: string; name: string }> | null) ?? []
    deactivatedPlaces += rows.length
  }

  return NextResponse.json({
    ok: true,
    customersScanned: customers.length,
    processedCustomers,
    deactivatedPlaces,
  })
}
