// T-172 — 파일럿 만료 리마인드 크론 (매일 09:00 KST).
// 7일 전 / 1일 전 / 당일 이메일 발송.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESEND_URL = 'https://api.resend.com/emails'

async function sendReminder(opts: { to: string; name: string | null; daysLeft: number; trialEnd: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.log('[trial-reminder]', opts.to, `${opts.daysLeft}일 남음 — RESEND_API_KEY 미설정, skip`)
    return false
  }
  const from = process.env.MONTHLY_REPORT_FROM ?? 'AI Place <billing@aiplace.kr>'
  const subject = opts.daysLeft === 0
    ? `[AI Place] 파일럿 오늘 종료 — 결제 카드 등록을 완료해 주세요`
    : `[AI Place] 파일럿 ${opts.daysLeft}일 남음`
  const html = `<!doctype html><html><body style="font-family:sans-serif;padding:24px;">
    <h2>안녕하세요 ${opts.name ?? '고객'}님,</h2>
    <p>AI Place 파일럿 체험이 <strong>${opts.daysLeft === 0 ? '오늘' : opts.daysLeft + '일 후'}</strong> 종료됩니다.</p>
    <p>만료일: ${new Date(opts.trialEnd).toLocaleDateString('ko-KR')}</p>
    <p>지속 이용을 원하시면 <a href="https://aiplace.kr/owner/billing">카드 등록</a> 후 월 14,900원 자동 결제로 전환됩니다.</p>
    <p>해지를 원하시면 <a href="https://aiplace.kr/owner/billing/cancel">해지 페이지</a>에서 완료해 주세요.</p>
    <hr/>
    <p style="font-size:12px;color:#888">AI Place · support@aiplace.kr</p>
    </body></html>`
  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject, html }),
  })
  return res.ok
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const now = Date.now()
  const sevenDaysFromNow = new Date(now + 7 * 24 * 60 * 60 * 1000)
  const oneDayFromNow = new Date(now + 1 * 24 * 60 * 60 * 1000)
  const today = new Date()

  // 7일 후·1일 후·오늘 만료되는 trial
  const { data: customers } = await admin
    .from('customers')
    .select('id, email, name, trial_ends_at')
    .not('trial_ends_at', 'is', null)

  const list = (customers ?? []) as Array<{ id: string; email: string; name: string | null; trial_ends_at: string }>

  let sent = 0
  let skipped = 0

  for (const c of list) {
    const end = new Date(c.trial_ends_at)
    const daysLeft = Math.ceil((end.getTime() - now) / (24 * 60 * 60 * 1000))
    if ([7, 1, 0].includes(daysLeft)) {
      // 활성 구독 있으면 이미 결제 세팅된 상태 — skip
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id')
        .eq('customer_id', c.id)
        .eq('status', 'active')
        .maybeSingle()
      if (sub) { skipped += 1; continue }

      const ok = await sendReminder({ to: c.email, name: c.name, daysLeft, trialEnd: c.trial_ends_at })
      if (ok) sent += 1
      else skipped += 1
    }
  }

  return NextResponse.json({
    ok: true,
    now: today.toISOString(),
    scanned: list.length,
    sent,
    skipped,
    checkpoints: [
      sevenDaysFromNow.toISOString().slice(0, 10),
      oneDayFromNow.toISOString().slice(0, 10),
      today.toISOString().slice(0, 10),
    ],
  })
}
