// T-073 — 구독 1건 결제 실행 + 실패/성공 기록 + 재시도 스케줄.
// 호출 시점: 최초 승인 / Vercel Cron 일일 스캔 / 실패 재시도.
// 핵심 규칙:
//   - succeeded  → subscriptions.status='active', failed_retry_count=0, next_charge_at=+30d
//   - failed + 재시도 가능 + retry<3 → status='past_due', retry+1, next_charge_at=+1d/+3d/+7d
//   - failed + 재시도 소진 → status='suspended', retry_exhausted 알림
//   - failed + 재등록 필요 (invalid_card/expired) → status='suspended' (즉시)

import type { PgAdapter } from './adapter'
import {
  classifyFailure,
  isRetryableFailure,
  nextRetryAt,
  RETRY_SCHEDULE_DAYS,
} from './adapter'
import { STANDARD_PLAN_AMOUNT } from './types'

export interface ChargeSubscriptionInput {
  subscriptionId: string
  billingKey: string
  customerKey: string
  customerName: string
  customerEmail?: string
  amount?: number                          // 기본 33000
  retriedCount: number                     // 현재까지 몇 번 재시도했는지 (0 = 첫 시도)
  now?: Date
}

export interface ChargeSubscriptionOutcome {
  paymentRow: {
    subscription_id: string
    billing_key_id: null                   // 호출 측에서 바인딩 (여기는 키 자체로 충분)
    amount: number
    status: 'succeeded' | 'failed'
    pg_payment_key: string | null
    pg_order_id: string
    pg_response_code: string | null
    pg_response_message: string | null
    retried_count: number
    attempted_at: string
    succeeded_at: string | null
  }
  subscriptionPatch: {
    status: 'active' | 'past_due' | 'suspended'
    failed_retry_count: number
    next_charge_at: string | null
    canceled_at?: string
  }
  notify:
    | { type: 'none' }
    | { type: 'payment.failed'; nextRetryAt: string | null; failureMessage: string }
    | { type: 'payment.retry_exhausted' }
}

const MONTH_DAYS = 30

/** 멱등키 orderId 생성: `<subId>-<YYYYMM>-<retry>`. */
export function buildOrderId(subscriptionId: string, now: Date, retriedCount: number): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${subscriptionId}-${y}${m}-r${retriedCount}`
}

export async function chargeSubscriptionOnce(
  adapter: PgAdapter,
  input: ChargeSubscriptionInput,
): Promise<ChargeSubscriptionOutcome> {
  const now = input.now ?? new Date()
  const amount = input.amount ?? STANDARD_PLAN_AMOUNT
  const orderId = buildOrderId(input.subscriptionId, now, input.retriedCount)

  const result = await adapter.chargeOnce({
    billingKey: input.billingKey,
    customerKey: input.customerKey,
    orderId,
    orderName: formatOrderName(now),
    amount,
    customerEmail: input.customerEmail,
    customerName: input.customerName,
  })

  if (result.success) {
    const nextCharge = new Date(now)
    nextCharge.setDate(nextCharge.getDate() + MONTH_DAYS)
    return {
      paymentRow: {
        subscription_id: input.subscriptionId,
        billing_key_id: null,
        amount,
        status: 'succeeded',
        pg_payment_key: result.paymentKey ?? null,
        pg_order_id: orderId,
        pg_response_code: null,
        pg_response_message: null,
        retried_count: input.retriedCount,
        attempted_at: now.toISOString(),
        succeeded_at: (result.approvedAt ?? now.toISOString()),
      },
      subscriptionPatch: {
        status: 'active',
        failed_retry_count: 0,
        next_charge_at: nextCharge.toISOString(),
      },
      notify: { type: 'none' },
    }
  }

  // 실패 분기
  const category = result.error?.category ?? classifyFailure(result.error?.code ?? null)
  const message = result.error?.message ?? '결제 실패'
  const nextRetryCount = input.retriedCount + 1
  const retryable = isRetryableFailure(category) && nextRetryCount < RETRY_SCHEDULE_DAYS.length
  const retryDate = retryable ? nextRetryAt(input.retriedCount, now) : null

  const base = {
    paymentRow: {
      subscription_id: input.subscriptionId,
      billing_key_id: null,
      amount,
      status: 'failed' as const,
      pg_payment_key: null,
      pg_order_id: orderId,
      pg_response_code: result.error?.code ?? null,
      pg_response_message: message,
      retried_count: input.retriedCount,
      attempted_at: now.toISOString(),
      succeeded_at: null,
    },
  }

  if (retryable && retryDate) {
    return {
      ...base,
      subscriptionPatch: {
        status: 'past_due',
        failed_retry_count: nextRetryCount,
        next_charge_at: retryDate.toISOString(),
      },
      notify: {
        type: 'payment.failed',
        nextRetryAt: retryDate.toISOString(),
        failureMessage: message,
      },
    }
  }

  // 재시도 소진 or 재등록 필요 → suspended
  return {
    ...base,
    subscriptionPatch: {
      status: 'suspended',
      failed_retry_count: nextRetryCount,
      next_charge_at: null,
    },
    notify: { type: 'payment.retry_exhausted' },
  }
}

function formatOrderName(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m} AI Place 월 구독`
}
