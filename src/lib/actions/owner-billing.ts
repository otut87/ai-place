'use server'

// Sprint O-1 / T-204 / T-223.5 — 오너 결제 서버 액션.
// 1) issueBillingKeyAction: Toss authKey → billingKey 교환 + billing_keys INSERT + subscription upsert
//    T-223.5: 다중 카드 허용. 첫 카드 = is_primary, 이후 is_primary=false 로 추가.
// 2) revokeBillingKeyAction(keyId?): 단일 카드 해지. 유일한 primary 카드는 삭제 불가.
// 3) setPrimaryBillingKeyAction(keyId): primary 전환 + subscription.billing_key_id 동기화.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { tossAdapter } from '@/lib/billing/toss'
import { STANDARD_PLAN_AMOUNT, STANDARD_PLAN_NAME } from '@/lib/billing/types'

export type IssueBillingKeyResult =
  | { success: true; billingKeyId: string; subscriptionId: string }
  | { success: false; error: string }

export async function issueBillingKeyAction(input: {
  authKey: string
  customerKey: string
}): Promise<IssueBillingKeyResult> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1. customer 확인 — customerKey 는 customer.id 로 약속.
  const { data: customer, error: custErr } = await admin
    .from('customers')
    .select('id, user_id, email, name, trial_ends_at')
    .eq('id', input.customerKey)
    .maybeSingle()
  if (custErr || !customer) return { success: false, error: 'customer 를 찾을 수 없습니다.' }
  const c = customer as {
    id: string; user_id: string | null; email: string; name: string | null; trial_ends_at: string | null
  }

  // customerKey 위조 방지 — 현재 로그인 사용자 소유여야 함.
  if (c.user_id !== user.id) {
    return { success: false, error: '본인 결제 정보만 수정할 수 있습니다.' }
  }

  // 2. Toss API 로 billingKey 발급
  const issued = await tossAdapter.issueBillingKey({
    authKey: input.authKey,
    customerKey: c.id,
  })
  if (!issued.success || !issued.billingKey) {
    return { success: false, error: issued.error?.message ?? '빌링키 발급 실패' }
  }

  // T-223.5: 다중 카드 허용 — 기존 active 카드 revoke 하지 않음.
  //   첫 카드는 is_primary=true 로 자동 설정, 2번째 이후는 false.
  //   partial unique index (migration 044) 가 동시 요청 race 방지.
  const { data: existingKeys } = await admin
    .from('billing_keys')
    .select('id, is_primary')
    .eq('customer_id', c.id)
    .eq('status', 'active')
  const existingActive = (existingKeys ?? []) as Array<{ id: string; is_primary: boolean }>
  const isFirstCard = existingActive.length === 0

  // 4. billing_keys INSERT
  const { data: bkRow, error: insErr } = await admin
    .from('billing_keys')
    .insert({
      customer_id: c.id,
      provider: 'toss',
      billing_key: issued.billingKey,
      method: issued.method ?? '카드',
      card_company: issued.cardCompany ?? null,
      card_number_masked: issued.cardNumberMasked ?? null,
      card_type: issued.cardType ?? null,
      expiry_year: issued.expiryYear ?? null,
      expiry_month: issued.expiryMonth ?? null,
      status: 'active',
      is_primary: isFirstCard,
    })
    .select('id')
    .single()
  if (insErr || !bkRow) {
    return { success: false, error: `카드 저장 실패: ${insErr?.message ?? 'unknown'}` }
  }
  const billingKeyId = (bkRow as { id: string }).id

  // 5. subscription upsert — 1 customer = 1 active subscription
  // T-220.5: `suspended` 도 포함 — 카드 재등록 시 재활성화 경로 보장.
  //   (기존 로직은 past_due → active 만 처리. suspended 는 영원히 suspended 남음)
  const { data: existingSub } = await admin
    .from('subscriptions')
    .select('id, status')
    .eq('customer_id', c.id)
    .in('status', ['pending', 'active', 'past_due', 'suspended', 'pending_cancellation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const existing = existingSub as { id: string; status: string } | null

  // next_charge_at — trial 남아있으면 trial_ends_at, 아니면 +1개월
  const nowMs = Date.now()
  const trialEndMs = c.trial_ends_at ? Date.parse(c.trial_ends_at) : NaN
  const nextChargeAt = Number.isFinite(trialEndMs) && trialEndMs > nowMs
    ? new Date(trialEndMs).toISOString()
    : new Date(nowMs + 30 * 86_400_000).toISOString()

  // T-220.5: 카드 재등록 시 status 재계산 — past_due/suspended 둘 다 active 로 복구.
  //   pending_cancellation 은 유지 (사용자 의도 존중).
  function reactivate(prev: string): string {
    if (prev === 'past_due' || prev === 'suspended') return 'active'
    return prev
  }

  // T-223.5: subscription.billing_key_id 는 primary 카드 id 를 가리킴.
  //   신규 카드가 primary 면 update, 아니면 기존 primary 유지.
  //   (existing 이 없고 첫 카드인 경우엔 billingKeyId 가 primary)
  const subBillingKeyId = isFirstCard ? billingKeyId : (existing?.id ? null : billingKeyId)

  let subscriptionId: string
  if (existing) {
    const { error: updErr } = await admin
      .from('subscriptions')
      .update({
        // 신규 카드가 primary 일 때만 billing_key_id 변경 (2번째 이후는 기존 유지).
        ...(isFirstCard ? { billing_key_id: billingKeyId } : {}),
        status: reactivate(existing.status),
        next_charge_at: nextChargeAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (updErr) console.error('[issueBillingKeyAction] subscription update 실패:', updErr.message)
    subscriptionId = existing.id
  } else {
    const { data: subRow, error: subErr } = await admin
      .from('subscriptions')
      .insert({
        customer_id: c.id,
        billing_key_id: subBillingKeyId,
        plan: STANDARD_PLAN_NAME,
        amount: STANDARD_PLAN_AMOUNT,
        status: 'pending',
        next_charge_at: nextChargeAt,
      })
      .select('id')
      .single()
    if (subErr || !subRow) {
      return { success: false, error: `구독 생성 실패: ${subErr?.message ?? 'unknown'}` }
    }
    subscriptionId = (subRow as { id: string }).id
  }

  return { success: true, billingKeyId, subscriptionId }
}

/**
 * 카드 해지 (T-223.5).
 *
 * @param keyId - 삭제할 카드 id. 생략 시 모든 active 카드 (legacy 동작, deprecated).
 *
 * 규칙:
 *   - 유일한 primary 카드는 삭제 불가 (다른 카드를 primary 로 먼저 설정)
 *   - primary 카드 삭제 시, 남은 카드 중 가장 최근 등록된 것이 자동 primary 승격
 */
export async function revokeBillingKeyAction(
  keyId?: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const c = customer as { id: string } | null
  if (!c) return { success: false, error: '고객 정보가 없습니다.' }

  // legacy: keyId 없으면 모든 카드 revoke (구 UI 호환)
  if (!keyId) {
    const { error } = await admin
      .from('billing_keys')
      .update({ status: 'revoked', revoked_at: new Date().toISOString() })
      .eq('customer_id', c.id)
      .eq('status', 'active')
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  // 단일 카드 삭제 — 소유권 + primary 검증
  const { data: target } = await admin
    .from('billing_keys')
    .select('id, customer_id, is_primary, status')
    .eq('id', keyId)
    .maybeSingle()
  const row = target as { id: string; customer_id: string; is_primary: boolean; status: string } | null
  if (!row) return { success: false, error: '카드를 찾을 수 없습니다.' }
  if (row.customer_id !== c.id) return { success: false, error: '본인 카드만 삭제할 수 있습니다.' }
  if (row.status !== 'active') return { success: false, error: '이미 해지된 카드입니다.' }

  // 유일한 primary 카드면 삭제 차단.
  if (row.is_primary) {
    const { count } = await admin
      .from('billing_keys')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', c.id)
      .eq('status', 'active')
    if ((count ?? 0) <= 1) {
      return { success: false, error: '유일한 결제 카드는 삭제할 수 없습니다. 다른 카드를 먼저 등록 후 삭제해 주세요.' }
    }
    // 다른 카드 중 가장 최근 것을 새 primary 로 승격
    const { data: others } = await admin
      .from('billing_keys')
      .select('id')
      .eq('customer_id', c.id)
      .eq('status', 'active')
      .neq('id', keyId)
      .order('authenticated_at', { ascending: false })
      .limit(1)
    const nextPrimary = (others ?? [])[0] as { id: string } | undefined
    if (nextPrimary) {
      // 기존 primary 해제 먼저 (partial unique 충돌 방지)
      await admin.from('billing_keys').update({ is_primary: false }).eq('id', row.id)
      await admin.from('billing_keys').update({ is_primary: true }).eq('id', nextPrimary.id)
      // subscription 도 동기화
      await admin
        .from('subscriptions')
        .update({ billing_key_id: nextPrimary.id, updated_at: new Date().toISOString() })
        .eq('customer_id', c.id)
        .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
    }
  }

  const { error } = await admin
    .from('billing_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString(), is_primary: false })
    .eq('id', keyId)
  if (error) return { success: false, error: error.message }

  return { success: true }
}

/**
 * T-223.5 — primary 카드 전환.
 *
 * 규칙:
 *   - 이미 primary 면 no-op
 *   - partial unique index 로 race 보호: 기존 primary 해제 후 신규 primary 설정
 *   - subscription.billing_key_id 도 동시 업데이트
 */
export async function setPrimaryBillingKeyAction(
  keyId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const c = customer as { id: string } | null
  if (!c) return { success: false, error: '고객 정보가 없습니다.' }

  const { data: target } = await admin
    .from('billing_keys')
    .select('id, customer_id, status, is_primary')
    .eq('id', keyId)
    .maybeSingle()
  const row = target as { id: string; customer_id: string; status: string; is_primary: boolean } | null
  if (!row) return { success: false, error: '카드를 찾을 수 없습니다.' }
  if (row.customer_id !== c.id) return { success: false, error: '본인 카드만 변경할 수 있습니다.' }
  if (row.status !== 'active') return { success: false, error: '해지된 카드는 기본으로 설정할 수 없습니다.' }
  if (row.is_primary) return { success: true }

  // 순서 중요: 기존 primary 해제 → 신규 primary 설정.
  //   partial unique index (migration 044) 가 반대 순서 실행 시 충돌.
  const { error: e1 } = await admin
    .from('billing_keys')
    .update({ is_primary: false })
    .eq('customer_id', c.id)
    .eq('is_primary', true)
  if (e1) return { success: false, error: e1.message }

  const { error: e2 } = await admin
    .from('billing_keys')
    .update({ is_primary: true })
    .eq('id', keyId)
  if (e2) return { success: false, error: e2.message }

  // subscription.billing_key_id 동기화
  const { error: e3 } = await admin
    .from('subscriptions')
    .update({ billing_key_id: keyId, updated_at: new Date().toISOString() })
    .eq('customer_id', c.id)
    .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
  if (e3) console.error('[setPrimaryBillingKeyAction] subscription sync 실패:', e3.message)

  return { success: true }
}

/**
 * T-223.5 — 카드 선등록 게이트 헬퍼.
 *
 * customer 에 active billing_key 가 1개 이상 있는지 확인.
 * /owner/places/new 접근 차단, registerOwnerPlaceAction 서버 검증에 사용.
 */
export async function hasActiveBillingKey(userId: string): Promise<boolean> {
  const admin = getAdminClient()
  if (!admin) return false

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  const c = customer as { id: string } | null
  if (!c) return false

  const { count } = await admin
    .from('billing_keys')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', c.id)
    .eq('status', 'active')
  return (count ?? 0) > 0
}
