'use server'

// T-224 — 오너 수동 결제 재시도.
// 어드민용 billing-retry.ts 와 구분 — 소유권 검증 + 다음 advisory lock 적용.
//
// 동시성 방어:
//   1. charging_started_at 컬럼을 advisory lock 으로 사용 (migration 045)
//   2. UPDATE ... WHERE (null OR < now - 60s) 로 원자적 획득
//   3. 0 rows 반환 시 "이미 charging 중" 에러
//   4. 또한 rate limit (5분 1회) — 최근 시도 타임스탬프 재활용

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { getPgAdapter } from '@/lib/billing'
import { chargeSubscriptionOnce } from '@/lib/billing/charge-subscription'
import { dispatchNotify } from '@/lib/actions/notify'
import { revalidatePath } from 'next/cache'

const LOCK_SECONDS = 60           // 60초간 다른 프로세스 진입 차단
const RATE_LIMIT_SECONDS = 300    // 5분 1회

export type OwnerRetryResult =
  | { success: true; status: 'active' | 'past_due' | 'suspended' }
  | { success: false; error: string }

export async function ownerRetryBillingAction(subscriptionId: string): Promise<OwnerRetryResult> {
  const user = await requireOwnerForAction()
  if (!subscriptionId) return { success: false, error: 'subscriptionId 누락' }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1) 소유권 + 현재 상태 로드
  const { data: sub, error: subErr } = await admin
    .from('subscriptions')
    .select(`
      id, customer_id, billing_key_id, failed_retry_count, status, amount,
      charging_started_at,
      billing_keys:billing_key_id ( billing_key, status ),
      customers:customer_id ( name, email, user_id )
    `)
    .eq('id', subscriptionId)
    .maybeSingle()
  if (subErr || !sub) return { success: false, error: '구독을 찾을 수 없습니다.' }

  const row = sub as unknown as {
    id: string
    customer_id: string
    billing_key_id: string | null
    failed_retry_count: number
    status: string
    amount: number
    charging_started_at: string | null
    billing_keys: { billing_key: string; status: string } | null
    customers: { name: string | null; email: string | null; user_id: string | null } | null
  }

  if (!row.customers || row.customers.user_id !== user.id) {
    return { success: false, error: '본인 구독이 아닙니다.' }
  }
  if (row.status !== 'past_due') {
    return { success: false, error: `현재 상태에서는 재시도할 수 없습니다 (${row.status}).` }
  }
  if (!row.billing_keys || row.billing_keys.status !== 'active') {
    return { success: false, error: '활성 카드가 없습니다. 카드를 먼저 등록해 주세요.' }
  }

  // 2) Rate limit — charging_started_at 이 최근 5분 이내면 차단
  if (row.charging_started_at) {
    const lastMs = Date.parse(row.charging_started_at)
    if (Number.isFinite(lastMs) && Date.now() - lastMs < RATE_LIMIT_SECONDS * 1000) {
      const waitSec = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (Date.now() - lastMs)) / 1000)
      return { success: false, error: `최근에 이미 시도했습니다. ${Math.ceil(waitSec / 60)}분 후 재시도해 주세요.` }
    }
  }

  // 3) Advisory lock 획득 — UPDATE WHERE (null OR < now-60s).
  //    0 rows → 다른 프로세스(크론/동시 요청)가 charging 중.
  const lockCutoff = new Date(Date.now() - LOCK_SECONDS * 1000).toISOString()
  const nowIso = new Date().toISOString()
  const { data: locked, error: lockErr } = await admin
    .from('subscriptions')
    .update({ charging_started_at: nowIso })
    .eq('id', row.id)
    .or(`charging_started_at.is.null,charging_started_at.lt.${lockCutoff}`)
    .select('id')
  if (lockErr) return { success: false, error: `lock 획득 실패: ${lockErr.message}` }
  if (!locked || (locked as unknown[]).length === 0) {
    return { success: false, error: '이미 결제 시도가 진행 중입니다. 잠시 후 다시 시도해 주세요.' }
  }

  // 4) PG charge (Toss 에 orderId dedupe 까지 있음 — 이중 안전)
  try {
    const adapter = getPgAdapter()
    const outcome = await chargeSubscriptionOnce(adapter, {
      subscriptionId: row.id,
      billingKey: row.billing_keys.billing_key,
      customerKey: row.customer_id,
      customerName: row.customers.name ?? '(이름 없음)',
      customerEmail: row.customers.email ?? undefined,
      amount: row.amount,
      retriedCount: row.failed_retry_count,
    })

    // 5) payments insert
    await admin
      .from('payments')
      .insert({ ...outcome.paymentRow, billing_key_id: row.billing_key_id })

    // 6) subscription patch — charging_started_at 은 NULL 로 해제
    await admin
      .from('subscriptions')
      .update({
        ...outcome.subscriptionPatch,
        charging_started_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)

    // 7) notify — 성공/실패/소진 케이스
    if (outcome.notify.type === 'payment.succeeded') {
      const { count: activePlaceCount } = await admin
        .from('places')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', row.customer_id)
        .eq('status', 'active')
      await dispatchNotify({
        type: 'payment.succeeded',
        customerName: row.customers.name ?? '(이름 없음)',
        customerEmail: row.customers.email ?? undefined,
        amount: outcome.paymentRow.amount,
        chargedAt: outcome.notify.chargedAt,
        nextChargeAt: outcome.notify.nextChargeAt,
        receiptUrl: outcome.notify.receiptUrl,
        activePlaceCount: activePlaceCount ?? 0,
      })
    } else if (outcome.notify.type === 'payment.failed') {
      await dispatchNotify({
        type: 'payment.failed',
        customerName: row.customers.name ?? '(이름 없음)',
        customerEmail: row.customers.email ?? undefined,
        amount: outcome.paymentRow.amount,
        failureMessage: outcome.notify.failureMessage,
        retriedCount: outcome.paymentRow.retried_count,
        nextRetryAt: outcome.notify.nextRetryAt,
        adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
      })
    } else if (outcome.notify.type === 'payment.retry_exhausted') {
      await dispatchNotify({
        type: 'payment.retry_exhausted',
        customerName: row.customers.name ?? '(이름 없음)',
        customerEmail: row.customers.email ?? undefined,
        amount: outcome.paymentRow.amount,
        adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
      })
    }

    revalidatePath('/owner/billing')
    return { success: true, status: outcome.subscriptionPatch.status }
  } catch (e) {
    // 예외 시 lock 만 해제 — 다음 시도에 rate limit 걸리지 않게.
    await admin
      .from('subscriptions')
      .update({ charging_started_at: null })
      .eq('id', row.id)
    const msg = e instanceof Error ? e.message : 'unknown'
    return { success: false, error: `결제 시도 실패: ${msg}` }
  }
}
