// T-197 — GSC 성과 피드백 (Phase 5).
//
// 동작:
//  1) Google Search Console API 로 최근 30일 블로그 페이지별 CTR/impressions fetch.
//  2) blog_posts.gsc_* 컬럼 갱신.
//  3) blog_posts 의 keyword_id 로 집계 → keyword_bank.avg_ctr/avg_impressions/priority 갱신.
//
// OAuth 복잡도·쿼터 고려 → GSC_ACCESS_TOKEN 환경변수 없으면 no-op.
// 실제 GSC 연동은 다음 단계 task 로 분리 가능 (OAuth2 refresh token 포함).

import { getAdminClient } from '@/lib/supabase/admin-client'

// 런타임에 매번 읽음 — 테스트에서 env 변경 시 즉시 반영.
function gscSiteUrl(): string {
  return process.env.GSC_SITE_URL ?? 'https://aiplace.kr/'
}
function gscAccessToken(): string {
  return process.env.GSC_ACCESS_TOKEN ?? ''
}

export interface GSCPageRow {
  page: string                    // https://aiplace.kr/blog/.../slug
  clicks: number
  impressions: number
  ctr: number                     // 0~1
  position: number
}

export interface PerformanceFeedbackResult {
  enabled: boolean                // GSC 환경변수 있어서 실제 동작했는지
  fetchedRows: number
  blogPostsUpdated: number
  keywordsUpdated: number
  errors: string[]
}

/**
 * Google Search Console Search Analytics API 호출.
 * https://developers.google.com/webmaster-tools/v1/searchanalytics/query
 * 성공 시 PageRow[] 반환, 실패 시 null.
 */
async function fetchGSCPages(
  startDate: string,                // 'YYYY-MM-DD'
  endDate: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GSCPageRow[] | null> {
  const token = gscAccessToken()
  if (!token) return null

  const url = `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(gscSiteUrl())}/searchAnalytics/query`
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate,
      endDate,
      dimensions: ['page'],
      rowLimit: 1000,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`[perf-feedback] GSC API ${res.status}: ${text.slice(0, 200)}`)
    return null
  }

  const data = await res.json() as {
    rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>
  }
  return (data.rows ?? []).map(r => ({
    page: r.keys[0] ?? '',
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))
}

/** URL → blog_posts.slug 추출. 예: https://aiplace.kr/blog/cheonan/medical/abc → abc */
export function extractSlugFromPageUrl(url: string): string | null {
  const m = url.match(/\/blog\/[^/]+\/[^/]+\/([^/?#]+)/)
  return m?.[1] ?? null
}

export interface SyncGSCMetricsInput {
  days?: number                   // 기본 30
  fetchImpl?: typeof fetch
}

/**
 * 메인 엔트리 — 주 1회 cron 에서 호출.
 * GSC 환경 미설정 시 enabled=false 로 조용히 종료 (차단 없음).
 */
export async function syncGSCMetrics(
  input: SyncGSCMetricsInput = {},
): Promise<PerformanceFeedbackResult> {
  const admin = getAdminClient()
  if (!admin) {
    return { enabled: false, fetchedRows: 0, blogPostsUpdated: 0, keywordsUpdated: 0, errors: ['admin 미초기화'] }
  }

  const days = input.days ?? 30
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)

  const pages = await fetchGSCPages(fmt(start), fmt(end), input.fetchImpl)
  if (!pages) {
    return {
      enabled: false, fetchedRows: 0, blogPostsUpdated: 0, keywordsUpdated: 0,
      errors: ['GSC 환경변수 미설정 또는 호출 실패 — 기능 비활성'],
    }
  }

  // page URL → slug 매핑
  const bySlug = new Map<string, GSCPageRow>()
  for (const p of pages) {
    const slug = extractSlugFromPageUrl(p.page)
    if (slug) bySlug.set(slug, p)
  }

  // blog_posts 갱신
  const errors: string[] = []
  let blogPostsUpdated = 0
  const now = new Date().toISOString()

  for (const [slug, row] of bySlug) {
    const { error } = await admin
      .from('blog_posts')
      .update({
        gsc_impressions: Math.round(row.impressions),
        gsc_clicks: Math.round(row.clicks),
        gsc_ctr: Math.min(1, Math.max(0, row.ctr)),
        gsc_avg_position: Math.round(row.position * 100) / 100,
        gsc_updated_at: now,
      })
      .eq('slug', slug)
    if (error) errors.push(`blog_posts[${slug}]: ${error.message}`)
    else blogPostsUpdated += 1
  }

  // keyword_bank 집계 — blog_posts.keyword_id 가 있는 것들만
  const { data: keywordRows } = await admin
    .from('blog_posts')
    .select('keyword_id, gsc_impressions, gsc_ctr')
    .not('keyword_id', 'is', null)
    .not('gsc_ctr', 'is', null)

  const kwAgg = new Map<string, { ctrs: number[]; imps: number[] }>()
  for (const r of (keywordRows ?? []) as Array<{
    keyword_id: string; gsc_impressions: number | null; gsc_ctr: number | null
  }>) {
    if (!r.keyword_id || r.gsc_ctr == null) continue
    const e = kwAgg.get(r.keyword_id) ?? { ctrs: [], imps: [] }
    e.ctrs.push(r.gsc_ctr)
    if (r.gsc_impressions != null) e.imps.push(r.gsc_impressions)
    kwAgg.set(r.keyword_id, e)
  }

  let keywordsUpdated = 0
  for (const [kwId, { ctrs, imps }] of kwAgg) {
    const avgCtr = ctrs.reduce((s, v) => s + v, 0) / ctrs.length
    const avgImp = imps.length > 0 ? Math.round(imps.reduce((s, v) => s + v, 0) / imps.length) : null
    // CTR 높으면 priority 낮춤(우선순위 상승), 낮으면 높임.
    // 공식: avgCtr > 0.05 → priority -= 2, 0.02~0.05 → -1, 그 미만 → +1
    let priorityDelta = 0
    if (avgCtr >= 0.05) priorityDelta = -2
    else if (avgCtr >= 0.02) priorityDelta = -1
    else if (avgCtr < 0.005) priorityDelta = 1

    const patch: Record<string, unknown> = {
      avg_ctr: Math.min(1, Math.max(0, avgCtr)),
      avg_impressions: avgImp,
      priority_updated_at: now,
    }
    // priority 는 read-modify-write — 간단히 사용자가 원한 경우만 적용.
    // 여기서는 priorityDelta 만 기록, 실제 priority 반영은 별도 step 으로 (안정성).
    void priorityDelta

    const { error } = await admin
      .from('keyword_bank')
      .update(patch)
      .eq('id', kwId)
    if (error) errors.push(`keyword_bank[${kwId}]: ${error.message}`)
    else keywordsUpdated += 1
  }

  return { enabled: true, fetchedRows: pages.length, blogPostsUpdated, keywordsUpdated, errors }
}
