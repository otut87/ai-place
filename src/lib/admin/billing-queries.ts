// T-073/074 보조 — 설계안 §3.10 만료임박/결제이력/해지예정 조회.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { daysUntilCardExpiry } from '@/lib/billing/expiry'

export interface ExpiringCardRow {
  id: string
  customerId: string
  customerName: string | null
  customerEmail: string | null
  cardCompany: string | null
  cardNumberMasked: string | null
  daysLeft: number
  expiryYear: number | null
  expiryMonth: number | null
}

export async function listExpiringCards(withinDays = 60): Promise<ExpiringCardRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const { data } = await admin
    .from('billing_keys')
    .select(`
      id, customer_id, card_company, card_number_masked, expiry_year, expiry_month,
      customers:customer_id ( name, email )
    `)
    .eq('status', 'active')

  if (!data) return []

  const now = new Date()
  const rows = data as unknown as Array<{
    id: string
    customer_id: string
    card_company: string | null
    card_number_masked: string | null
    expiry_year: number | null
    expiry_month: number | null
    customers: { name: string | null; email: string | null } | null
  }>

  return rows
    .map<ExpiringCardRow | null>((r) => {
      const daysLeft = daysUntilCardExpiry(r, now)
      if (daysLeft === null) return null
      if (daysLeft > withinDays) return null
      return {
        id: r.id,
        customerId: r.customer_id,
        customerName: r.customers?.name ?? null,
        customerEmail: r.customers?.email ?? null,
        cardCompany: r.card_company,
        cardNumberMasked: r.card_number_masked,
        daysLeft,
        expiryYear: r.expiry_year,
        expiryMonth: r.expiry_month,
      }
    })
    .filter((x): x is ExpiringCardRow => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}

export interface PaymentHistoryRow {
  id: string
  subscriptionId: string
  customerName: string | null
  customerEmail: string | null
  amount: number
  status: 'succeeded' | 'failed' | 'canceled' | string
  pgOrderId: string
  pgResponseCode: string | null
  pgResponseMessage: string | null
  retriedCount: number
  attemptedAt: string
  succeededAt: string | null
}

export async function listPaymentHistory(params: {
  status?: 'succeeded' | 'failed' | 'canceled' | 'all'
  search?: string               // 이메일 또는 주문ID
  limit?: number
} = {}): Promise<PaymentHistoryRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  let query = admin
    .from('payments')
    .select(`
      id, subscription_id, amount, status, pg_order_id, pg_response_code, pg_response_message,
      retried_count, attempted_at, succeeded_at,
      subscriptions:subscription_id (
        customer_id,
        customers:customer_id ( name, email )
      )
    `)
    .order('attempted_at', { ascending: false })
    .limit(params.limit ?? 100)

  if (params.status && params.status !== 'all') {
    query = query.eq('status', params.status)
  }
  if (params.search && params.search.startsWith('ord_')) {
    query = query.eq('pg_order_id', params.search)
  }

  const { data } = await query
  if (!data) return []

  return (data as unknown as Array<{
    id: string
    subscription_id: string
    amount: number
    status: string
    pg_order_id: string
    pg_response_code: string | null
    pg_response_message: string | null
    retried_count: number
    attempted_at: string
    succeeded_at: string | null
    subscriptions: {
      customer_id: string
      customers: { name: string | null; email: string | null } | null
    } | null
  }>).map<PaymentHistoryRow>((r) => ({
    id: r.id,
    subscriptionId: r.subscription_id,
    customerName: r.subscriptions?.customers?.name ?? null,
    customerEmail: r.subscriptions?.customers?.email ?? null,
    amount: r.amount,
    status: r.status,
    pgOrderId: r.pg_order_id,
    pgResponseCode: r.pg_response_code,
    pgResponseMessage: r.pg_response_message,
    retriedCount: r.retried_count,
    attemptedAt: r.attempted_at,
    succeededAt: r.succeeded_at,
  }))
}
