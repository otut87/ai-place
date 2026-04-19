// T-142 — 월간 리포트 HTML 생성.
// Owner 대시보드(T-141) 와 동일한 데이터 소스, 이메일용 인라인 HTML.

import { scanSite } from './scan-site'
import { scoreBucket, getBenchmark } from './benchmark'

export interface MonthlyReportData {
  placeId: string
  placeName: string
  publicUrl: string          // https://aiplace.kr/cheonan/...
  score: number
  scoreBucket: string
  bench: { registered: number; unregistered: number }
  botVisits30d: number
  botBots30d: number
  citationRate: number | null    // 0~1
  citationLastRun: string | null
  periodLabel: string            // '2026년 4월'
  topIssues: Array<{ label: string; detail: string }>
}

export async function buildMonthlyReportData(place: {
  id: string
  name: string
  slug: string
  city: string
  category: string
}, deps: {
  getBotVisits: (path: string) => Promise<{ total: number; uniqueBots: number }>
  getLatestCitation: (placeId: string) => Promise<{ rate: number; at: string } | null>
  period?: Date
}): Promise<MonthlyReportData> {
  const path = `/${place.city}/${place.category}/${place.slug}`
  const publicUrl = `https://aiplace.kr${path}`

  const [scan, botStats, cite] = await Promise.all([
    scanSite(publicUrl),
    deps.getBotVisits(path),
    deps.getLatestCitation(place.id),
  ])

  const bucket = scoreBucket(scan.score)
  const bench = getBenchmark()
  const topIssues = scan.checks
    .filter(c => c.status !== 'pass')
    .sort((a, b) => (b.maxPoints - b.points) - (a.maxPoints - a.points))
    .slice(0, 3)
    .map(c => ({ label: c.label, detail: c.detail ?? '' }))

  const d = deps.period ?? new Date()
  const periodLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월`

  return {
    placeId: place.id,
    placeName: place.name,
    publicUrl,
    score: scan.score,
    scoreBucket: bucket.label,
    bench: { registered: bench.registered, unregistered: bench.unregistered },
    botVisits30d: botStats.total,
    botBots30d: botStats.uniqueBots,
    citationRate: cite?.rate ?? null,
    citationLastRun: cite?.at ?? null,
    periodLabel,
    topIssues,
  }
}

export function renderMonthlyReportHtml(data: MonthlyReportData): string {
  const issuesHtml = data.topIssues.length === 0
    ? '<p style="color:#22aa77;margin:0;">개선이 필요한 주요 항목이 없습니다.</p>'
    : data.topIssues.map(i => `
      <div style="padding:10px 12px;background:#fef3c7;border-radius:6px;margin-bottom:6px;">
        <div style="font-weight:600;color:#92400e;">${escape(i.label)}</div>
        <div style="font-size:12px;color:#78350f;margin-top:2px;">${escape(i.detail)}</div>
      </div>`).join('')

  const citeHtml = data.citationRate !== null
    ? `<div style="font-size:32px;font-weight:700;color:#191919;">${Math.round(data.citationRate * 100)}%</div>
       <div style="font-size:12px;color:#6b6b6b;">최근 실행: ${data.citationLastRun ? new Date(data.citationLastRun).toLocaleDateString('ko-KR') : '-'}</div>`
    : `<div style="font-size:14px;color:#6b6b6b;">아직 실행되지 않았습니다. 대시보드에서 즉시 실행 가능합니다.</div>`

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${data.periodLabel} AI Place 리포트 — ${escape(data.placeName)}</title></head>
<body style="margin:0;padding:20px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#191919;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e7e7e7;">
    <div style="padding:24px;background:#008060;color:white;">
      <div style="font-size:12px;opacity:0.9;">AI Place · ${data.periodLabel} 월간 리포트</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px;">${escape(data.placeName)}</div>
      <a href="${data.publicUrl}" style="color:white;font-size:12px;opacity:0.9;text-decoration:underline;">${escape(data.publicUrl)}</a>
    </div>

    <div style="padding:20px;display:block;">
      <!-- 3개 카드 -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td width="33%" style="padding:12px;border:1px solid #e7e7e7;border-radius:8px;vertical-align:top;">
            <div style="font-size:11px;color:#6b6b6b;">AI 가독성</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;">${data.score}<span style="font-size:14px;color:#9a9a9a;">/100</span></div>
            <div style="font-size:11px;color:#6b6b6b;margin-top:2px;">${data.scoreBucket} · 등록 평균 ${data.bench.registered}</div>
          </td>
          <td width="4" style="padding:0 2px;"></td>
          <td width="33%" style="padding:12px;border:1px solid #e7e7e7;border-radius:8px;vertical-align:top;">
            <div style="font-size:11px;color:#6b6b6b;">AI 봇 방문 (30일)</div>
            <div style="font-size:28px;font-weight:700;margin-top:4px;">${data.botVisits30d}<span style="font-size:14px;color:#9a9a9a;">회</span></div>
            <div style="font-size:11px;color:#6b6b6b;margin-top:2px;">${data.botBots30d}종 봇</div>
          </td>
          <td width="4" style="padding:0 2px;"></td>
          <td width="33%" style="padding:12px;border:1px solid #e7e7e7;border-radius:8px;vertical-align:top;">
            <div style="font-size:11px;color:#6b6b6b;">AI 인용율</div>
            ${citeHtml}
          </td>
        </tr>
      </table>

      <!-- 개선 제안 -->
      <div style="margin-top:20px;">
        <h3 style="font-size:14px;margin:0 0 10px 0;">이번 달 개선 우선순위</h3>
        ${issuesHtml}
      </div>

      <!-- CTA -->
      <div style="margin-top:24px;padding:16px;background:#f5f5f5;border-radius:8px;text-align:center;">
        <a href="https://aiplace.kr/owner/places/${data.placeId}/dashboard" style="display:inline-block;padding:10px 20px;background:#008060;color:white;text-decoration:none;border-radius:6px;font-size:14px;">
          대시보드에서 자세히 보기 →
        </a>
      </div>

      <div style="margin-top:20px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:10px;color:#9a9a9a;text-align:center;">
        AI Place · 매월 1일 자동 발송 · 수신 거부는 대시보드에서 설정
      </div>
    </div>
  </div>
</body></html>`
}

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
