// T-164 — 브라우저 인쇄용 (Ctrl+P → PDF 저장).
// Puppeteer 의존성 없이 순수 CSS @media print 로 해결.
import { notFound } from 'next/navigation'
import { viewReportShare } from '@/lib/actions/report-share'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { generateMarkdownReport } from '@/lib/diagnostic/report-generator'
import type { ScanResult } from '@/lib/diagnostic/scan-site'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata = {
  title: 'AI 검색 진단 리포트 (인쇄용)',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ hash: string }>
}

export default async function ReportPrintPage({ params }: Props) {
  const { hash } = await params
  const share = await viewReportShare(hash)
  if (!share) notFound()

  const admin = getAdminClient()
  if (!admin) return <div className="p-10">admin unavailable</div>

  const { data: run } = await admin
    .from('diagnostic_runs')
    .select('url, created_at, score, pages_scanned, sitemap_present, checks')
    .eq('id', share.runId)
    .maybeSingle()
  if (!run) notFound()
  const r = run as { url: string; created_at: string; score: number; pages_scanned: number; sitemap_present: boolean; checks: unknown }

  const baseline = share.baselineRunId
    ? (await admin.from('diagnostic_runs').select('score, created_at').eq('id', share.baselineRunId).maybeSingle()).data as { score: number; created_at: string } | null
    : null

  const scanResult: ScanResult = {
    url: r.url,
    fetchedAt: r.created_at,
    score: r.score,
    pagesScanned: r.pages_scanned,
    sitemapPresent: r.sitemap_present,
    checks: Array.isArray(r.checks) ? (r.checks as ScanResult['checks']) : [],
  }

  const markdown = generateMarkdownReport(scanResult, {
    title: share.title ?? 'AI 검색 최적화 진단 리포트',
    clientName: share.clientName ?? undefined,
    baseline: baseline ? { score: baseline.score, date: baseline.created_at.slice(0, 10) } : undefined,
  })

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, 'Noto Sans KR', sans-serif", color: '#191919' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            .no-print { display: none !important; }
            body { padding: 0; }
            pre { white-space: pre-wrap; word-wrap: break-word; page-break-inside: avoid; }
            h1, h2, h3 { page-break-after: avoid; }
          }
          @page { size: A4; margin: 2cm; }
          .page { max-width: 700px; margin: 0 auto; padding: 24px; }
          pre { font-family: inherit; line-height: 1.7; font-size: 13px; }
        ` }} />

        <div className="no-print" style={{ position: 'sticky', top: 0, background: '#191919', color: 'white', padding: '10px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>📄 인쇄용 리포트</span>
          <PrintButton />
        </div>

        <article className="page">
          <pre>{markdown}</pre>
        </article>
      </body>
    </html>
  )
}
