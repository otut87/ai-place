// T-073 — 결제 실패 큐 조회/재시도.
// 원칙: payments.status='failed' + 같은 subscription 에 성공이 아직 없는 건만 표시.

import { getAdminClient } from '@/lib/supabase/admin-client'
import type { FailureCategory } from '@/lib/billing/adapter'
import { classifyFailure } from '@/lib/billing/adapter'

export interface BillingFailureRow {
  id: string                            // payment id
  subscriptionId: string
  customerId: string
  customerName: string | null
  customerEmail: string | null
  amount: number
  responseCode: string | null
  responseMessage: string | null
  category: FailureCategory
  retriedCount: number                  // 해당 payment 의 retried_count (0 = 첫 실패)
  attemptedAt: string
  subscriptionStatus: 'past_due' | 'suspended' | string
  nextChargeAt: string | null           // subscription.next_charge_at
  failedRetryCount: number              // subscription.failed_retry_count (누적)
}

interface JoinedRow {
  id: string
  amount: number
  pg_response_code: string | null
  pg_response_message: string | null
  retried_count: number
  attempted_at: string
  subscription_id: string
  subscriptions: {
    status: string
    next_charge_at: string | null
    failed_retry_count: number
    customer_id: string
    customers: {
      name: string | null
      email: string | null
    } | null
  } | null
}

export async function listBillingFailures(limit = 50): Promise<BillingFailureRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const { data, error } = await admin
    .from('payments')
    .select(`
      id, amount, pg_response_code, pg_response_message, retried_count, attempted_at, subscription_id,
      subscriptions:subscription_id ( status, next_charge_at, failed_retry_count, customer_id,
        customers:customer_id ( name, email )
      )
    `)
    .eq('status', 'failed')
    .order('attempted_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  const rows = data as unknown as JoinedRow[]
  return rows
    .filter(r => r.subscriptions !== null)
    .map<BillingFailureRow>((r) => ({
      id: r.id,
      subscriptionId: r.subscription_id,
      customerId: r.subscriptions!.customer_id,
      customerName: r.subscriptions!.customers?.name ?? null,
      customerEmail: r.subscriptions!.customers?.email ?? null,
      amount: r.amount,
      responseCode: r.pg_response_code,
      responseMessage: r.pg_response_message,
      category: classifyFailure(r.pg_response_code),
      retriedCount: r.retried_count,
      attemptedAt: r.attempted_at,
      subscriptionStatus: r.subscriptions!.status,
      nextChargeAt: r.subscriptions!.next_charge_at,
      failedRetryCount: r.subscriptions!.failed_retry_count,
    }))
}

export const FAILURE_CATEGORY_LABEL: Record<FailureCategory, string> = {
  insufficient_balance: '잔액 부족',
  card_expired: '카드 만료',
  limit_exceeded: '한도 초과',
  invalid_card: '카드 오류',
  do_not_honor: '카드사 승인 거절',
  stolen_or_lost: '도난/분실',
  other: '기타',
}

/** "구독 상태" 배지 색상 토큰 (tailwind class 로 변환은 UI 층에서). */
export function badgeToneForSubscription(status: string): 'warn' | 'danger' | 'ok' {
  if (status === 'past_due') return 'warn'
  if (status === 'suspended' || status === 'canceled') return 'danger'
  return 'ok'
}
