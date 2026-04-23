// T-070 — 결제 도메인 타입.
// DB 스키마(020_billing.sql) 와 1:1 매핑되는 snake_case Db* 타입 + 앱 레벨 타입.

export type BillingProvider = 'toss' | 'mock'

export type SubscriptionStatus =
  | 'pending'
  | 'active'
  | 'past_due'     // 결제 실패, 재시도 대기
  | 'suspended'    // 재시도 소진
  | 'canceled'

export type BillingKeyStatus = 'active' | 'revoked' | 'expired'

export type PaymentStatus = 'succeeded' | 'failed' | 'canceled'

// T-206 — 단일 요금제 14,900원 (2026-04-22 확정, 9,900원 → 14,900원 상향).
// T-210 — 업체당 요금제로 변경 (2026-04-23). 월 14,900원 × 활성 업체 수.
// 월 블로그 5편/업체 · 월간 이메일 알림 · AEO 점검 · AI 인용 대시보드 포함.
// 가격 책정 근거: 수수료 포함 변동 마진율 92% · BEP 5.5명 · 소상공인 심리 안전 구간.
export const PLAN_AMOUNT_PER_PLACE = 14900 as const
/** @deprecated T-210 이전의 고정 단가. 신규 코드는 PLAN_AMOUNT_PER_PLACE · calculatePlanAmount 사용. */
export const STANDARD_PLAN_AMOUNT = 14900 as const
export const STANDARD_PLAN_NAME = 'standard' as const
export const MONTHLY_BLOG_QUOTA_PER_PLACE = 5 as const

/**
 * T-210: 활성 업체 수 기반 월 청구액.
 * 파일럿(trial) 중이거나 활성 업체 0곳이면 0 — 구독 있어도 과금 대상 아님.
 */
export function calculatePlanAmount(activePlaceCount: number): number {
  if (!Number.isFinite(activePlaceCount) || activePlaceCount <= 0) return 0
  return Math.floor(activePlaceCount) * PLAN_AMOUNT_PER_PLACE
}

export interface DbCustomer {
  id: string
  email: string
  name: string | null
  phone: string | null
  user_id: string | null
  created_at: string
  updated_at: string
}

export interface DbBillingKey {
  id: string
  customer_id: string
  provider: BillingProvider
  billing_key: string
  method: string | null
  card_company: string | null
  card_number_masked: string | null
  card_type: string | null
  expiry_year: number | null
  expiry_month: number | null
  status: BillingKeyStatus
  authenticated_at: string
  revoked_at: string | null
  created_at: string
}

export interface DbSubscription {
  id: string
  customer_id: string
  billing_key_id: string | null
  plan: string
  amount: number
  status: SubscriptionStatus
  started_at: string | null
  next_charge_at: string | null
  canceled_at: string | null
  cancel_reason: string | null
  failed_retry_count: number
  created_at: string
  updated_at: string
}

export interface DbPayment {
  id: string
  subscription_id: string
  billing_key_id: string | null
  amount: number
  status: PaymentStatus
  pg_payment_key: string | null
  pg_order_id: string
  pg_response_code: string | null
  pg_response_message: string | null
  retried_count: number
  attempted_at: string
  succeeded_at: string | null
}
