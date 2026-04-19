// T-165 — 공유 링크 리포트 뷰어 (로그인 없이 접근).
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { viewReportShare } from '@/lib/actions/report-share'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { generateMarkdownReport } from '@/lib/diagnostic/report-generator'
import type { ScanResult } from '@/lib/diagnostic/scan-site'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export const metadata: Metadata = {
  title: 'AI 검색 최적화 진단 리포트',
  robots: { index: false, follow: false },
}

interface Props {
  params: Promise<{ hash: string }>
}

export default async function ReportSharePage({ params }: Props) {
  const { hash } = await params
  const share = await viewReportShare(hash)
  if (!share) notFound()

  const admin = getAdminClient()
  if (!admin) return <div className="p-10 text-center">admin unavailable</div>

  const { data: run } = await admin
    .from('diagnostic_runs')
    .select('url, fetchedAt:created_at, score, pages_scanned, sitemap_present, checks')
    .eq('id', share.runId)
    .maybeSingle()
  if (!run) notFound()
  const r = run as { url: string; fetchedAt: string; score: number; pages_scanned: number; sitemap_present: boolean; checks: unknown }

  const baselineData = share.baselineRunId
    ? (await admin.from('diagnostic_runs').select('score, created_at').eq('id', share.baselineRunId).maybeSingle()).data as { score: number; created_at: string } | null
    : null

  const scanResult: ScanResult = {
    url: r.url,
    fetchedAt: r.fetchedAt,
    score: r.score,
    pagesScanned: r.pages_scanned,
    sitemapPresent: r.sitemap_present,
    checks: Array.isArray(r.checks) ? (r.checks as ScanResult['checks']) : [],
  }

  const markdown = generateMarkdownReport(scanResult, {
    title: share.title ?? 'AI 검색 최적화 진단 리포트',
    clientName: share.clientName ?? undefined,
    baseline: baselineData ? { score: baselineData.score, date: baselineData.created_at.slice(0, 10) } : undefined,
  })

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-4 flex items-center justify-between text-xs text-[#6a6a6a]">
        <span>🔗 공유 링크 · 만료 {new Date(share.expiresAt).toLocaleDateString('ko-KR')} · 조회 {share.views}회</span>
        <a href="/check" className="text-[#008060] underline">내 사이트 진단하기</a>
      </div>
      <article className="prose prose-sm max-w-none rounded-2xl border border-[#e7e7e7] bg-white p-8">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{markdown}</pre>
      </article>
      <p className="mt-6 text-center text-xs text-[#9a9a9a]">
        Powered by AI Place — AI 검색 최적화 진단 도구
      </p>
    </main>
  )
}
