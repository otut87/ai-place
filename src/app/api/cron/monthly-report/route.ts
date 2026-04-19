// T-142 — 월간 리포트 자동 발송 크론.
// 매월 1일 오전 9시 실행 (vercel.json: "0 9 1 * *").
// 활성 구독 업체 대상 HTML 리포트 생성 → Resend 발송 (키 없으면 DB 저장만).

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { buildMonthlyReportData, renderMonthlyReportHtml } from '@/lib/diagnostic/monthly-report'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MONTHLY_REPORT_FROM ?? 'AI Place <reports@aiplace.kr>'
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY 미설정 (리포트는 생성됨, 발송 생략)' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  })
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
  return { ok: true }
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  // 활성 구독 + 연결된 업체 조회
  const { data: subs } = await admin
    .from('subscriptions')
    .select('customer_id, customers:customer_id(id, email, name)')
    .eq('status', 'active')

  // Supabase 조인 결과는 Array or Object 둘 다 올 수 있어 unknown 경유
  const subList = (subs ?? []) as unknown as Array<{
    customer_id: string
    customers: { id: string; email: string; name: string } | Array<{ id: string; email: string; name: string }> | null
  }>
  if (subList.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: '활성 구독 없음' })
  }

  const periodDate = new Date()
  periodDate.setMonth(periodDate.getMonth() - 1) // 전월 기준 리포트

  let processed = 0
  let sent = 0
  const errors: Array<{ placeId: string; error: string }> = []

  for (const sub of subList) {
    const customer = Array.isArray(sub.customers) ? sub.customers[0] : sub.customers
    if (!customer || !customer.email) continue

    const { data: places } = await admin
      .from('places')
      .select('id, name, slug, city, category')
      .eq('customer_id', sub.customer_id)
      .eq('status', 'active')

    for (const place of (places ?? []) as Array<{ id: string; name: string; slug: string; city: string; category: string }>) {
      processed += 1
      try {
        const report = await buildMonthlyReportData(place, {
          getBotVisits: async (path) => {
            const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
            const { data } = await admin
              .from('bot_visits')
              .select('bot_id')
              .eq('path', path)
              .gte('visited_at', since)
            const rows = (data ?? []) as Array<{ bot_id: string }>
            return { total: rows.length, uniqueBots: new Set(rows.map(r => r.bot_id)).size }
          },
          getLatestCitation: async (placeId) => {
            const { data } = await admin
              .from('citation_tests')
              .select('citation_rate, started_at')
              .eq('place_id', placeId)
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            const row = data as { citation_rate: number; started_at: string } | null
            return row ? { rate: row.citation_rate ?? 0, at: row.started_at } : null
          },
          period: periodDate,
        })

        const html = renderMonthlyReportHtml(report)
        const send = await sendEmail({
          to: customer.email,
          subject: `[AI Place] ${report.periodLabel} ${place.name} 월간 리포트`,
          html,
        })
        if (send.ok) sent += 1
        else errors.push({ placeId: place.id, error: send.error ?? 'send failed' })
      } catch (err) {
        errors.push({ placeId: place.id, error: err instanceof Error ? err.message : 'unknown' })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    processed,
    sent,
    skipped: processed - sent,
    errors: errors.slice(0, 10),
  })
}
