'use server'

// T-174 — 구독 취소 (즉시 해지 or 기간 만료 후 해지).
import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export interface CancelInput {
  subscriptionId: string
  mode: 'immediate' | 'end_of_period'
  reason?: string               // 해지 사유 (학습 데이터)
  feedback?: string
}

export type CancelOutcome =
  | { success: true; effectiveDate: string; mode: 'immediate' | 'end_of_period' }
  | { success: false; error: string }

export async function cancelSubscriptionAction(input: CancelInput): Promise<CancelOutcome> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1) 구독 조회 + 소유권 검증
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, customer_id, status, next_charge_at, customers:customer_id(user_id)')
    .eq('id', input.subscriptionId)
    .maybeSingle()
  if (!sub) return { success: false, error: '구독 정보를 찾을 수 없습니다' }

  const subRow = sub as unknown as {
    id: string; customer_id: string; status: string; next_charge_at: string | null;
    customers: { user_id: string | null } | Array<{ user_id: string | null }> | null;
  }
  const customer = Array.isArray(subRow.customers) ? subRow.customers[0] : subRow.customers
  if (!customer || customer.user_id !== user.id) {
    return { success: false, error: '본인 소유 구독이 아닙니다' }
  }

  if (subRow.status === 'cancelled') {
    return { success: false, error: '이미 해지된 구독입니다' }
  }

  // 2) 해지 처리
  const now = new Date()
  const effectiveDate = input.mode === 'immediate'
    ? now.toISOString()
    : subRow.next_charge_at ?? now.toISOString()

  const updates: Record<string, unknown> = {
    updated_at: now.toISOString(),
  }
  if (input.mode === 'immediate') {
    updates.status = 'cancelled'
    updates.cancelled_at = now.toISOString()
    updates.next_charge_at = null
  } else {
    updates.status = 'pending_cancellation'
    updates.pending_cancel_at = effectiveDate
  }

  const { error: updateError } = await admin
    .from('subscriptions')
    .update(updates)
    .eq('id', subRow.id)
  if (updateError) return { success: false, error: updateError.message }

  // 3) 해지 사유 로깅 (별도 테이블 있으면 기록, 없으면 subscription_events)
  if (input.reason || input.feedback) {
    await admin.from('subscription_events').insert({
      subscription_id: subRow.id,
      event_type: 'cancellation_requested',
      metadata: { reason: input.reason, feedback: input.feedback, mode: input.mode },
    }).then(r => r).catch(() => {
      // subscription_events 테이블 없어도 무시
    })
  }

  revalidatePath('/owner/billing')
  return { success: true, effectiveDate, mode: input.mode }
}
