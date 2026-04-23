// T-172 → T-230 — 파일럿 종료 예고 크론 (매일 09:00 KST).
//
// 카드 선등록 모델 (2026-04-23) 반영:
//   - 모든 customer 는 카드 등록 완료 상태 (카드 없으면 업체 등록 자체 차단)
//   - 따라서 "카드 등록해주세요" 가 아니라 "D-N 에 ₩{amount} 첫 결제 예정" 예고
//   - D-3 / D-1 / D-0 3회 발송 (기존 D-7 은 너무 일러서 제거)
//   - dispatchNotify 통해 events.ts 의 billing.trial_ending 이벤트로 통일
//
// 파일럿 금액 = 활성 업체 수 × ₩14,900 (결제 직전 amount 기준).

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { dispatchNotify } from '@/lib/actions/notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DAY_MS = 24 * 60 * 60 * 1000

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const now = Date.now()

  // trial_ends_at 이 3일 / 1일 / 당일 에 해당하는 customers
  const { data: customers } = await admin
    .from('customers')
    .select('id, email, name, trial_ends_at')
    .not('trial_ends_at', 'is', null)

  const list = (customers ?? []) as Array<{
    id: string; email: string; name: string | null; trial_ends_at: string
  }>

  let sent = 0
  let skipped = 0

  for (const c of list) {
    const end = new Date(c.trial_ends_at)
    const daysLeft = Math.ceil((end.getTime() - now) / DAY_MS)
    if (![3, 1, 0].includes(daysLeft)) continue

    // 활성 구독(status='active') 가 이미 있으면 첫 결제가 이미 끝난 경우 — skip
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, amount, status')
      .eq('customer_id', c.id)
      .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const subscription = sub as { id: string; amount: number; status: string } | null

    if (!subscription) { skipped += 1; continue }
    if (subscription.status !== 'pending') {
      // 이미 active/past_due/pending_cancellation — 파일럿 예고 대상 아님
      skipped += 1
      continue
    }

    // 활성 업체 수 (amount 동기화 검증)
    const { count: activePlaceCount } = await admin
      .from('places')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', c.id)
      .eq('status', 'active')

    await dispatchNotify({
      type: 'billing.trial_ending',
      customerName: c.name ?? '(이름 없음)',
      customerEmail: c.email,
      daysLeft: daysLeft as 3 | 1 | 0,
      trialEndsAt: c.trial_ends_at,
      amount: subscription.amount,
      activePlaceCount: activePlaceCount ?? 0,
    })
    sent += 1
  }

  return NextResponse.json({
    ok: true,
    now: new Date(now).toISOString(),
    scanned: list.length,
    sent,
    skipped,
    checkpoints: [3, 1, 0].map((d) => new Date(now + d * DAY_MS).toISOString().slice(0, 10)),
  })
}
