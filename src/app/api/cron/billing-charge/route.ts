// T-073 — 자동 결제 실행 Cron.
// Vercel Cron 매일 1회: next_charge_at <= now 인 active/past_due 구독 일괄 결제.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { getPgAdapter } from '@/lib/billing'
import { chargeSubscriptionOnce } from '@/lib/billing/charge-subscription'
import { dispatchNotify } from '@/lib/actions/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const nowIso = new Date().toISOString()
  const { data, error } = await admin
    .from('subscriptions')
    .select(`
      id, customer_id, billing_key_id, failed_retry_count, status,
      billing_keys:billing_key_id ( billing_key, status ),
      customers:customer_id ( name, email )
    `)
    .in('status', ['active', 'past_due'])
    .lte('next_charge_at', nowIso)
    .limit(100)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'query_failed' }, { status: 500 })
  }

  const adapter = getPgAdapter()
  let succeeded = 0
  let failed = 0

  for (const row of data as unknown as Array<{
    id: string
    customer_id: string
    billing_key_id: string | null
    failed_retry_count: number
    status: string
    billing_keys: { billing_key: string; status: string } | null
    customers: { name: string | null; email: string | null } | null
  }>) {
    if (!row.billing_keys || row.billing_keys.status !== 'active') continue

    const outcome = await chargeSubscriptionOnce(adapter, {
      subscriptionId: row.id,
      billingKey: row.billing_keys.billing_key,
      customerKey: row.customer_id,
      customerName: row.customers?.name ?? '(이름 없음)',
      customerEmail: row.customers?.email ?? undefined,
      retriedCount: row.failed_retry_count,
    })

    await admin.from('payments').insert({ ...outcome.paymentRow, billing_key_id: row.billing_key_id })
    await admin
      .from('subscriptions')
      .update({ ...outcome.subscriptionPatch, updated_at: new Date().toISOString() })
      .eq('id', row.id)

    if (outcome.paymentRow.status === 'succeeded') succeeded += 1
    else failed += 1

    if (outcome.notify.type === 'payment.failed') {
      await dispatchNotify({
        type: 'payment.failed',
        customerName: row.customers?.name ?? '(이름 없음)',
        customerEmail: row.customers?.email ?? undefined,
        amount: outcome.paymentRow.amount,
        failureMessage: outcome.notify.failureMessage,
        retriedCount: outcome.paymentRow.retried_count,
        nextRetryAt: outcome.notify.nextRetryAt,
        adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
      })
    } else if (outcome.notify.type === 'payment.retry_exhausted') {
      await dispatchNotify({
        type: 'payment.retry_exhausted',
        customerName: row.customers?.name ?? '(이름 없음)',
        customerEmail: row.customers?.email ?? undefined,
        amount: outcome.paymentRow.amount,
        adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
      })
    }
  }

  return NextResponse.json({ ok: true, scanned: data.length, succeeded, failed })
}
