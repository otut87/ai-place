'use server'

// Sprint O-1 / T-204 — 오너 결제 서버 액션.
// 1) issueBillingKeyAction: Toss authKey → billingKey 교환 + billing_keys INSERT + subscription upsert
// 2) revokeBillingKeyAction: 카드 논리 해지 (재등록 유도)

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

  // 3. 기존 active billing_keys 를 revoked 로 전환 (1 customer = 1 active).
  const { error: revokeErr } = await admin
    .from('billing_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('customer_id', c.id)
    .eq('status', 'active')
  if (revokeErr) console.error('[issueBillingKeyAction] 기존 카드 해지 실패:', revokeErr.message)

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

  let subscriptionId: string
  if (existing) {
    const { error: updErr } = await admin
      .from('subscriptions')
      .update({
        billing_key_id: billingKeyId,
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
        billing_key_id: billingKeyId,
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

/** 카드 해지 — billing_keys.status='revoked', subscription 은 그대로 유지 (사용자가 재등록). */
export async function revokeBillingKeyAction(): Promise<{ success: boolean; error?: string }> {
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

  const { error } = await admin
    .from('billing_keys')
    .update({ status: 'revoked', revoked_at: new Date().toISOString() })
    .eq('customer_id', c.id)
    .eq('status', 'active')
  if (error) return { success: false, error: error.message }

  return { success: true }
}
