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

export const STANDARD_PLAN_AMOUNT = 33000 as const
export const STANDARD_PLAN_NAME = 'standard' as const

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
