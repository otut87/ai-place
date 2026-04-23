// T-073 — 자동 결제 실행 Cron.
// Vercel Cron 매일 1회: next_charge_at <= now 인 active/past_due 구독 일괄 결제.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { getPgAdapter } from '@/lib/billing'
import { chargeSubscriptionOnce } from '@/lib/billing/charge-subscription'
import { dispatchNotify } from '@/lib/actions/notify'
import { calcDiscountedAmount, loadUnappliedRedemption, markRedemptionApplied } from '@/lib/billing/coupon'

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
  // T-224: 오너 수동 재시도 advisory lock (charging_started_at) 도 체크.
  //   lock 이 최근 60초 이내면 동시 charge 방지하기 위해 cron 도 skip.
  const lockCutoff = new Date(Date.now() - 60_000).toISOString()
  const { data, error } = await admin
    .from('subscriptions')
    .select(`
      id, customer_id, billing_key_id, failed_retry_count, status, amount,
      charging_started_at,
      billing_keys:billing_key_id ( billing_key, status ),
      customers:customer_id ( name, email )
    `)
    // T-204: 파일럿 종료(next_charge_at) 도래한 pending 구독도 첫 결제 대상 포함.
    .in('status', ['pending', 'active', 'past_due'])
    .lte('next_charge_at', nowIso)
    .or(`charging_started_at.is.null,charging_started_at.lt.${lockCutoff}`)
    .limit(100)

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'query_failed' }, { status: 500 })
  }

  const adapter = getPgAdapter()
  let succeeded = 0
  let failed = 0

  let skippedZero = 0
  for (const row of data as unknown as Array<{
    id: string
    customer_id: string
    billing_key_id: string | null
    failed_retry_count: number
    status: string
    amount: number
    charging_started_at: string | null
    billing_keys: { billing_key: string; status: string } | null
    customers: { name: string | null; email: string | null } | null
  }>) {
    if (!row.billing_keys || row.billing_keys.status !== 'active') continue

    // T-210: amount=0 이면 활성 업체가 없어 청구 대상이 아님 — skip.
    if (!row.amount || row.amount <= 0) {
      skippedZero += 1
      continue
    }

    // T-229: 미적용 쿠폰이 있으면 이번 charge 에 discount 적용.
    //   실패 시 redemption 은 그대로 유지돼 다음 주기로 carry-over.
    const redemption = await loadUnappliedRedemption(admin, row.customer_id)
    const chargeAmount = redemption
      ? calcDiscountedAmount(row.amount, redemption.discountType, redemption.discountValue)
      : row.amount

    const outcome = await chargeSubscriptionOnce(adapter, {
      subscriptionId: row.id,
      billingKey: row.billing_keys.billing_key,
      customerKey: row.customer_id,
      customerName: row.customers?.name ?? '(이름 없음)',
      customerEmail: row.customers?.email ?? undefined,
      amount: chargeAmount,          // T-210 + T-229: 쿠폰 적용된 최종 금액
      retriedCount: row.failed_retry_count,
    })

    const { data: insertedPayment } = await admin
      .from('payments')
      .insert({ ...outcome.paymentRow, billing_key_id: row.billing_key_id })
      .select('id')
      .single()
    const paymentId = (insertedPayment as { id: string } | null)?.id ?? null

    await admin
      .from('subscriptions')
      .update({
        ...outcome.subscriptionPatch,
        charging_started_at: null,       // T-224: lock 해제
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    // T-229: 결제 성공 시에만 쿠폰 소진 처리. 실패 시엔 redemption 유지.
    if (outcome.paymentRow.status === 'succeeded' && redemption && paymentId) {
      await markRedemptionApplied(admin, redemption.id, redemption.couponId, paymentId)
    }

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
    } else if (outcome.notify.type === 'payment.succeeded') {
      // T-230: 결제 성공 시 고객에게 영수증 안내 + 다음 결제일 안내.
      const { count: activeCount } = await admin
        .from('places')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', row.customer_id)
        .eq('status', 'active')
      await dispatchNotify({
        type: 'payment.succeeded',
        customerName: row.customers?.name ?? '(이름 없음)',
        customerEmail: row.customers?.email ?? undefined,
        amount: outcome.paymentRow.amount,
        chargedAt: outcome.notify.chargedAt,
        nextChargeAt: outcome.notify.nextChargeAt,
        receiptUrl: outcome.notify.receiptUrl,
        activePlaceCount: activeCount ?? 0,
      })
    }
  }

  return NextResponse.json({ ok: true, scanned: data.length, succeeded, failed, skippedZero })
}
