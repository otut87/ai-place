// /owner/reports/[placeId] — 선택 업체 × 기간의 HTML 리포트 뷰어.
// buildMonthlyReportData 호출 → renderMonthlyReportHtml → iframe srcDoc 로 주입.
// 인쇄 버튼은 브라우저 기본 Ctrl+P (PDF 저장) 안내.

import type { Metadata } from 'next'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { buildMonthlyReportData, renderMonthlyReportHtml } from '@/lib/diagnostic/monthly-report'
import { composePageTitle } from '@/lib/seo/compose-title'
import { PageHeader } from '../../_components/page-header'
import { ReportViewer } from './report-viewer'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('월간 리포트'),
  robots: { index: false, follow: false },
}

interface Params {
  params: Promise<{ placeId: string }>
  searchParams: Promise<{ period?: string }>
}

function parsePeriod(raw: string | undefined, now: Date = new Date()): Date {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const [y, m] = raw.split('-').map(Number)
    return new Date(y, m - 1, 1)
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

export default async function OwnerReportViewerPage({ params, searchParams }: Params) {
  await requireOwnerUser()
  const { placeId } = await params
  const { period: periodRaw } = await searchParams
  const period = parsePeriod(periodRaw)

  const ownerPlaces = await listOwnerPlaces()
  const place = ownerPlaces.find((p) => p.id === placeId)

  if (!place) {
    return (
      <section className="wrap">
        <PageHeader
          title="리포트를 찾을 수 없어요"
          subtitle="본인 소유 업체의 리포트만 열 수 있습니다."
          back={{ href: '/owner/reports', label: '리포트 목록' }}
        />
      </section>
    )
  }

  const admin = getAdminClient()
  if (!admin) {
    return (
      <section className="wrap">
        <div className="owner-banner danger" role="alert">
          <span>⚠️ 데이터베이스 연결 실패 — 잠시 후 다시 시도해 주세요.</span>
        </div>
      </section>
    )
  }

  const report = await buildMonthlyReportData(
    { id: place.id, name: place.name, slug: place.slug, city: place.city, category: place.category },
    {
      getBotVisits: async (path: string) => {
        const start = new Date(period.getFullYear(), period.getMonth(), 1).toISOString()
        const end = new Date(period.getFullYear(), period.getMonth() + 1, 1).toISOString()
        const { data } = await admin
          .from('bot_visits')
          .select('bot_id')
          .eq('path', path)
          .gte('visited_at', start)
          .lt('visited_at', end)
        const rows = (data ?? []) as Array<{ bot_id: string }>
        return { total: rows.length, uniqueBots: new Set(rows.map(r => r.bot_id)).size }
      },
      getLatestCitation: async (pid: string) => {
        const { data } = await admin
          .from('citation_tests')
          .select('citation_rate, started_at')
          .eq('place_id', pid)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        const row = data as { citation_rate: number; started_at: string } | null
        return row ? { rate: row.citation_rate ?? 0, at: row.started_at } : null
      },
      period,
    },
  )

  const html = renderMonthlyReportHtml(report)

  const periodKey = `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}`

  return (
    <section className="wrap">
      <PageHeader
        title={<><em>{place.name}</em> · {report.periodLabel}</>}
        subtitle={
          <>
            AI 가독성 <b style={{ color: 'var(--ink)' }}>{report.score}</b>/100 · AI 봇 {report.botVisits30d}회 ({report.botBots30d}종)
            {report.citationRate !== null && <> · 인용율 {Math.round(report.citationRate * 100)}%</>}
          </>
        }
        back={{ href: '/owner/reports', label: '리포트 목록' }}
      />

      <ReportViewer
        html={html}
        downloadFilename={`aiplace-${place.slug}-${periodKey}.html`}
      />

      <p className="info-note" style={{ marginTop: 12 }}>
        ⓘ PDF 저장: 우측 상단 &ldquo;인쇄&rdquo; 버튼 → 대상 &ldquo;PDF 로 저장&rdquo; 선택.
        HTML 파일은 &ldquo;HTML 내려받기&rdquo; 로 이메일·문서에 첨부할 수 있습니다.
      </p>
    </section>
  )
}
