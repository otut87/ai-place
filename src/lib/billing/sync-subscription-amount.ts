// T-210 — 활성 업체 수에 따라 subscriptions.amount 자동 동기화.
//
// 호출 시점:
//   - 업체 등록 성공 직후 (owner-register-place)
//   - 업체 archive/restore (archiveOwnerPlace / restoreOwnerPlace)
//   - 관리자가 admin 에서 status 를 바꾸는 경우 (updatePlaceStatus)
//
// 정책:
//   - 활성(status='active') 업체만 카운트. archived/rejected 는 제외.
//   - subscription 이 없으면 아무 작업 안 함 (파일럿 전용 고객).
//   - canceled/suspended 구독은 건너뜀 (이미 결제 중단됨).

import type { SupabaseClient } from '@supabase/supabase-js'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { calculatePlanAmount } from './types'

export interface SyncSubscriptionAmountResult {
  ok: boolean
  customerId: string
  activePlaceCount: number
  newAmount: number
  previousAmount: number | null
  updated: boolean
  skipped?: 'no_subscription' | 'canceled' | 'no_admin' | 'no_change'
  error?: string
}

/**
 * 고객의 활성 업체 수를 세서 subscriptions.amount 를 업데이트.
 * 테스트 편의를 위해 admin 클라이언트 주입 가능.
 */
export async function syncSubscriptionAmount(
  customerId: string,
  adminOverride?: SupabaseClient,
): Promise<SyncSubscriptionAmountResult> {
  const admin = adminOverride ?? getAdminClient()
  if (!admin) {
    return {
      ok: false, customerId, activePlaceCount: 0, newAmount: 0, previousAmount: null,
      updated: false, skipped: 'no_admin',
    }
  }

  // 1. 활성 업체 수 카운트
  const { count, error: countErr } = await admin
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('status', 'active')
  if (countErr) {
    return {
      ok: false, customerId, activePlaceCount: 0, newAmount: 0, previousAmount: null,
      updated: false, error: countErr.message,
    }
  }
  const activePlaceCount = count ?? 0
  const newAmount = calculatePlanAmount(activePlaceCount)

  // 2. 해당 고객의 유효 subscription 조회 (canceled 제외)
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select('id, amount, status')
    .eq('customer_id', customerId)
    .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
    .maybeSingle()
  if (subErr) {
    return {
      ok: false, customerId, activePlaceCount, newAmount, previousAmount: null,
      updated: false, error: subErr.message,
    }
  }
  if (!sub) {
    return {
      ok: true, customerId, activePlaceCount, newAmount, previousAmount: null,
      updated: false, skipped: 'no_subscription',
    }
  }
  const subTyped = sub as { id: string; amount: number; status: string }

  // 3. 동일하면 skip
  if (subTyped.amount === newAmount) {
    return {
      ok: true, customerId, activePlaceCount, newAmount,
      previousAmount: subTyped.amount, updated: false, skipped: 'no_change',
    }
  }

  // 4. UPDATE
  const { error: updateErr } = await admin
    .from('subscriptions')
    .update({ amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', subTyped.id)
  if (updateErr) {
    return {
      ok: false, customerId, activePlaceCount, newAmount,
      previousAmount: subTyped.amount, updated: false, error: updateErr.message,
    }
  }

  return {
    ok: true, customerId, activePlaceCount, newAmount,
    previousAmount: subTyped.amount, updated: true,
  }
}
