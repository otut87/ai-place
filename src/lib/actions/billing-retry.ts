'use server'

// T-073 — 결제 실패 건 수동 재시도.
// 어드민 한정. 성공 시 payments insert + subscription patch.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { getPgAdapter } from '@/lib/billing'
import { chargeSubscriptionOnce } from '@/lib/billing/charge-subscription'
import { dispatchNotify } from '@/lib/actions/notify'

export interface BillingRetryResult {
  success: boolean
  error?: string
}

export async function retryBillingFailure(subscriptionId: string): Promise<BillingRetryResult> {
  await requireAuthForAction()
  if (!subscriptionId) return { success: false, error: 'subscriptionId 누락' }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 1) 구독 + 빌링키 + 고객 로드
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select(`
      id, customer_id, billing_key_id, failed_retry_count, status,
      billing_keys:billing_key_id ( billing_key, status ),
      customers:customer_id ( name, email )
    `)
    .eq('id', subscriptionId)
    .single()

  if (subErr || !sub) return { success: false, error: '구독을 찾을 수 없습니다.' }

  const typed = sub as unknown as {
    id: string
    customer_id: string
    billing_key_id: string | null
    failed_retry_count: number
    status: string
    billing_keys: { billing_key: string; status: string } | null
    customers: { name: string | null; email: string | null } | null
  }

  if (!typed.billing_keys || typed.billing_keys.status !== 'active') {
    return { success: false, error: '활성 빌링키가 없습니다. 고객이 카드를 재등록해야 합니다.' }
  }

  // 2) PG charge
  const adapter = getPgAdapter()
  const outcome = await chargeSubscriptionOnce(adapter, {
    subscriptionId: typed.id,
    billingKey: typed.billing_keys.billing_key,
    customerKey: typed.customer_id,
    customerName: typed.customers?.name ?? '(이름 없음)',
    customerEmail: typed.customers?.email ?? undefined,
    retriedCount: typed.failed_retry_count,
  })

  // 3) payments insert (billing_key_id 바인딩)
  const paymentPayload = { ...outcome.paymentRow, billing_key_id: typed.billing_key_id }
  const { error: payErr } = await admin.from('payments').insert(paymentPayload)
  if (payErr) {
    console.error('[billing-retry] payments insert 실패:', payErr)
    return { success: false, error: '결제 로그 저장 실패' }
  }

  // 4) subscription patch
  const { error: updErr } = await admin
    .from('subscriptions')
    .update({ ...outcome.subscriptionPatch, updated_at: new Date().toISOString() })
    .eq('id', subscriptionId)
  if (updErr) {
    console.error('[billing-retry] subscription update 실패:', updErr)
    return { success: false, error: '구독 상태 업데이트 실패' }
  }

  // 5) notify
  if (outcome.notify.type === 'payment.failed') {
    await dispatchNotify({
      type: 'payment.failed',
      customerName: typed.customers?.name ?? '(이름 없음)',
      customerEmail: typed.customers?.email ?? undefined,
      amount: outcome.paymentRow.amount,
      failureMessage: outcome.notify.failureMessage,
      retriedCount: outcome.paymentRow.retried_count,
      nextRetryAt: outcome.notify.nextRetryAt,
      adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
    })
  } else if (outcome.notify.type === 'payment.retry_exhausted') {
    await dispatchNotify({
      type: 'payment.retry_exhausted',
      customerName: typed.customers?.name ?? '(이름 없음)',
      customerEmail: typed.customers?.email ?? undefined,
      amount: outcome.paymentRow.amount,
      adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
    })
  }

  revalidatePath('/admin/billing/failures')
  revalidatePath('/admin')
  return { success: true }
}
