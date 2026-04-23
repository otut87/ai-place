// Sprint O-1 / T-204 — 오너 결제 상태 로더.
// /owner/billing 페이지와 success 콜백이 공통으로 쓰는 조회 함수.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface CustomerRow {
  id: string
  email: string
  name: string | null
  phone: string | null
  trialStartedAt: string | null
  trialEndsAt: string | null
}

export interface BillingKeyRow {
  id: string
  billingKey: string
  method: string | null
  cardCompany: string | null
  cardNumberMasked: string | null
  cardType: string | null
  expiryYear: number | null
  expiryMonth: number | null
  status: 'active' | 'revoked' | 'expired' | string
  authenticatedAt: string
  /** T-223.5: charging 대상 primary 카드 여부. */
  isPrimary: boolean
}

export interface SubscriptionRow {
  id: string
  plan: string
  amount: number
  status: string                    // 'pending' | 'active' | 'past_due' | 'suspended' | 'canceled' | 'pending_cancellation'
  startedAt: string | null
  nextChargeAt: string | null
  canceledAt: string | null
  failedRetryCount: number
  billingKeyId: string | null
}

export interface PaymentRow {
  id: string
  amount: number
  status: 'succeeded' | 'failed' | 'canceled' | string
  pgResponseMessage: string | null
  retriedCount: number
  attemptedAt: string
  succeededAt: string | null
  /** T-223: Toss 영수증 URL. null 이면 표시 안 함. */
  receiptUrl: string | null
}

export interface OwnerBillingState {
  customer: CustomerRow | null
  /** @deprecated T-223.5 다중카드 — primary 카드 (billingKeys 에서 is_primary=true). */
  billingKey: BillingKeyRow | null
  /** T-223.5 — 등록된 모든 active 카드. primary 는 is_primary=true 인 1건. */
  billingKeys: BillingKeyRow[]
  subscription: SubscriptionRow | null // 활성 또는 해지 예정 1건
  recentPayments: PaymentRow[]         // 최근 5건
  pilotRemainingDays: number
  /** T-210: 활성 업체 수 — 요금 브레이크다운 "N곳 × ₩14,900" 에 사용. */
  activePlaceCount: number
}

function daysUntilIso(iso: string | null, now: Date): number | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return null
  return Math.floor((ts - now.getTime()) / 86_400_000)
}

export async function loadOwnerBillingState(userId: string, now: Date = new Date()): Promise<OwnerBillingState> {
  const empty: OwnerBillingState = {
    customer: null,
    billingKey: null,
    billingKeys: [],
    subscription: null,
    recentPayments: [],
    pilotRemainingDays: 30,
    activePlaceCount: 0,
  }

  const admin = getAdminClient()
  if (!admin) return empty

  const { data: cRow } = await admin
    .from('customers')
    .select('id, email, name, phone, trial_started_at, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()
  const c = cRow as {
    id: string; email: string; name: string | null; phone: string | null
    trial_started_at: string | null; trial_ends_at: string | null
  } | null
  if (!c) return empty

  const customer: CustomerRow = {
    id: c.id,
    email: c.email,
    name: c.name,
    phone: c.phone,
    trialStartedAt: c.trial_started_at,
    trialEndsAt: c.trial_ends_at,
  }

  const pilotRemainingDays = daysUntilIso(c.trial_ends_at, now) ?? 30

  // 활성 카드 전부 (T-223.5 다중카드). primary = is_primary=true.
  const { data: bRows } = await admin
    .from('billing_keys')
    .select('id, billing_key, method, card_company, card_number_masked, card_type, expiry_year, expiry_month, status, authenticated_at, is_primary')
    .eq('customer_id', c.id)
    .eq('status', 'active')
    .order('is_primary', { ascending: false })      // primary 먼저
    .order('authenticated_at', { ascending: false })

  const billingKeys: BillingKeyRow[] = ((bRows ?? []) as Array<{
    id: string; billing_key: string; method: string | null; card_company: string | null
    card_number_masked: string | null; card_type: string | null
    expiry_year: number | null; expiry_month: number | null
    status: string; authenticated_at: string; is_primary: boolean
  }>).map((r) => ({
    id: r.id,
    billingKey: r.billing_key,
    method: r.method,
    cardCompany: r.card_company,
    cardNumberMasked: r.card_number_masked,
    cardType: r.card_type,
    expiryYear: r.expiry_year,
    expiryMonth: r.expiry_month,
    status: r.status,
    authenticatedAt: r.authenticated_at,
    isPrimary: !!r.is_primary,
  }))
  // 구 UI 호환 — primary (없으면 첫번째) 를 billingKey 로 노출.
  const billingKey: BillingKeyRow | null = billingKeys.find((k) => k.isPrimary) ?? billingKeys[0] ?? null

  // 구독 — active 우선, 없으면 pending/past_due/pending_cancellation
  const { data: sRow } = await admin
    .from('subscriptions')
    .select('id, plan, amount, status, started_at, next_charge_at, canceled_at, failed_retry_count, billing_key_id')
    .eq('customer_id', c.id)
    .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const s = sRow as {
    id: string; plan: string; amount: number; status: string
    started_at: string | null; next_charge_at: string | null; canceled_at: string | null
    failed_retry_count: number; billing_key_id: string | null
  } | null

  const subscription: SubscriptionRow | null = s ? {
    id: s.id,
    plan: s.plan,
    amount: s.amount,
    status: s.status,
    startedAt: s.started_at,
    nextChargeAt: s.next_charge_at,
    canceledAt: s.canceled_at,
    failedRetryCount: s.failed_retry_count,
    billingKeyId: s.billing_key_id,
  } : null

  // 최근 결제 5건
  let recentPayments: PaymentRow[] = []
  if (subscription) {
    const { data: pRows } = await admin
      .from('payments')
      .select('id, amount, status, pg_response_message, retried_count, attempted_at, succeeded_at, receipt_url')
      .eq('subscription_id', subscription.id)
      .order('attempted_at', { ascending: false })
      .limit(5)
    recentPayments = ((pRows ?? []) as Array<{
      id: string; amount: number; status: string
      pg_response_message: string | null; retried_count: number
      attempted_at: string; succeeded_at: string | null
      receipt_url: string | null
    }>).map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      pgResponseMessage: r.pg_response_message,
      retriedCount: r.retried_count,
      attemptedAt: r.attempted_at,
      succeededAt: r.succeeded_at,
      receiptUrl: r.receipt_url,
    }))
  }

  // T-210: 현재 활성 업체 수 (요금 브레이크다운용)
  const { count: activePlaceCount } = await admin
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', c.id)
    .eq('status', 'active')

  return {
    customer, billingKey, billingKeys, subscription, recentPayments, pilotRemainingDays,
    activePlaceCount: activePlaceCount ?? 0,
  }
}
