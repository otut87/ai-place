// T-142 → T-209 — 월간 링크 이메일 크론.
// 매월 1일 09:00 KST 실행 (vercel.json: "0 9 1 * *" UTC → 한국 18:00).
//
// T-209 변경:
//   - 무거운 HTML 리포트 본문 생성 제거 (scanSite + buildMonthlyReportData)
//   - "지난달 AI 인용 현황 보러 가기" 링크 메일로 전환
//   - 링크는 /owner/citations?from=&to= (지난달 월 경계)
//   - 활성 구독 고객만 대상 (trial 은 뷰어에서 직접 확인 유도)

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { monthBounds } from '@/lib/owner/period-parser'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.MONTHLY_REPORT_FROM ?? 'AI Place <reports@aiplace.kr>'
  if (!apiKey) {
    return { ok: false, error: 'RESEND_API_KEY 미설정 (메일 생략)' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
  })
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
  return { ok: true }
}

/** KST 기준 지난달의 월 경계 (from/to ISO date — YYYY-MM-DD). */
function lastMonthDateStrings(now: Date = new Date()): { fromIso: string; toIso: string; label: string; monthKey: string } {
  const kst = new Date(now.getTime() + 9 * 3_600_000)
  const y = kst.getUTCFullYear()
  const m0 = kst.getUTCMonth()
  const targetY = m0 === 0 ? y - 1 : y
  const targetM = (m0 - 1 + 12) % 12
  const { from, to } = monthBounds(targetY, targetM)
  // period-parser 는 Date 객체 반환 → YYYY-MM-DD 로 포맷
  const toKst = (d: Date) => {
    const local = new Date(d.getTime() + 9 * 3_600_000)
    return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`
  }
  return {
    fromIso: toKst(from),
    toIso: toKst(to),
    label: `${targetY}년 ${targetM + 1}월`,
    monthKey: `${targetY}-${String(targetM + 1).padStart(2, '0')}`,
  }
}

function renderLinkEmail(opts: {
  customerName: string
  placeNames: string[]
  periodLabel: string
  linkUrl: string
}): string {
  const placesHtml = opts.placeNames.length === 0
    ? ''
    : `<p style="margin:16px 0 0;color:#666;font-size:13px;">대상 업체: <b>${opts.placeNames.map(escape).join(' · ')}</b></p>`

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${escape(opts.periodLabel)} AI 인용 현황</title></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#191919;">
  <div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e7e7e7;">
    <div style="padding:24px 24px 16px;background:#0f0f0f;color:white;">
      <div style="font-size:12px;opacity:0.7;letter-spacing:.05em;">AI PLACE · MONTHLY</div>
      <div style="font-size:22px;font-weight:700;margin-top:6px;">${escape(opts.periodLabel)} AI 인용 현황</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.6;">
        <b>${escape(opts.customerName)}</b> 사장님,<br />
        ${escape(opts.periodLabel)} 동안 내 업체가 AI 검색·학습 봇에 얼마나 노출됐는지 확인해 보세요.
      </p>
      <p style="margin:0 0 8px;color:#444;font-size:13px;">
        이번엔 요약 수치 대신 <b>실시간 대시보드</b> 링크를 보냅니다 — 기간·업체 필터와 개선 우선순위까지 한 번에 보실 수 있어요.
      </p>
      ${placesHtml}
      <div style="margin:24px 0 8px;text-align:center;">
        <a href="${opts.linkUrl}" style="display:inline-block;padding:12px 24px;background:#0f0f0f;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
          ${escape(opts.periodLabel)} 리포트 열기 →
        </a>
      </div>
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:11px;color:#9a9a9a;text-align:center;line-height:1.6;">
        AI Place · 매월 1일 09:00 KST 자동 발송<br />
        수신 거부는 대시보드 &gt; 결제·플랜 &gt; 알림 설정
      </div>
    </div>
  </div>
</body></html>`
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const { fromIso, toIso, label, monthKey } = lastMonthDateStrings()
  const siteBase = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://aiplace.kr'

  // 활성 구독 고객만. trial 은 스스로 대시보드에서 확인.
  const { data: subs } = await admin
    .from('subscriptions')
    .select('customer_id, customers:customer_id(id, email, name)')
    .eq('status', 'active')

  const subList = (subs ?? []) as unknown as Array<{
    customer_id: string
    customers: { id: string; email: string; name: string } | Array<{ id: string; email: string; name: string }> | null
  }>
  if (subList.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: '활성 구독 없음' })
  }

  let processed = 0
  let sent = 0
  const errors: Array<{ customerId: string; error: string }> = []

  for (const sub of subList) {
    processed += 1
    const customer = Array.isArray(sub.customers) ? sub.customers[0] : sub.customers
    if (!customer?.email) continue

    // 이 고객의 활성 업체 이름 목록 (메일에 표시)
    const { data: places } = await admin
      .from('places')
      .select('name')
      .eq('customer_id', sub.customer_id)
      .eq('status', 'active')
    const placeNames = ((places ?? []) as Array<{ name: string }>).map((p) => p.name)

    const linkUrl = `${siteBase}/owner/citations?from=${fromIso}&to=${toIso}&utm_source=monthly-email&utm_campaign=${monthKey}`
    const html = renderLinkEmail({
      customerName: customer.name || '사장님',
      placeNames,
      periodLabel: label,
      linkUrl,
    })

    const send = await sendEmail({
      to: customer.email,
      subject: `[AI Place] ${label} AI 인용 현황 — 보러 가기`,
      html,
    })
    if (send.ok) sent += 1
    else errors.push({ customerId: sub.customer_id, error: send.error ?? 'send failed' })
  }

  return NextResponse.json({
    ok: true,
    processed,
    sent,
    skipped: processed - sent,
    monthKey,
    errors: errors.slice(0, 10),
  })
}
