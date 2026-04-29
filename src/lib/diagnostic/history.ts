// T-160·T-161 — 진단 이력 저장 + 이전 결과 조회.
//
// T-259 (Codex consult #6): 저장 URL 에 query/fragment 가 그대로 남으면 사용자가
// 토큰/이메일/내부 host 를 입력했을 때 PII 가 DB 에 누적된다. saveDiagnosticRun 은
// origin + pathname 만 저장하고, parse 실패하면 저장 자체를 skip 하여 신뢰 카피와 정합.
import { getAdminClient } from '@/lib/supabase/admin-client'
import type { ScanResult } from './scan-site'

/**
 * 진단 URL 을 안전 형태(`origin + pathname`)로 줄임.
 * - query string / fragment 제거 → 토큰·이메일·내부 식별자 누출 차단
 * - parse 실패 시 null (호출 측이 저장 자체를 skip 해야 안전)
 * - URL 길이는 origin+pathname 으로 자연 cap (500자 제한이 입력 단에서 적용)
 *
 * 예) https://example.com/path?token=abc#frag → https://example.com/path
 */
export function sanitizeDiagnosticUrl(raw: string): string | null {
  try {
    const u = new URL(raw)
    return `${u.origin}${u.pathname}`
  } catch {
    return null
  }
}

export interface DiagnosticRunRow {
  id: string
  url: string
  origin: string
  score: number
  pages_scanned: number
  sitemap_present: boolean
  triggered_by: string
  customer_id: string | null
  created_at: string
  checks: unknown
}

/**
 * 진단 결과를 DB에 저장.
 * 실패해도 throw 안 함 (UX 방해 방지) — 단, 로그는 남김.
 */
export async function saveDiagnosticRun(opts: {
  result: ScanResult
  triggeredBy: 'public' | 'owner' | 'cron' | 'premium'
  customerId?: string | null
  userAgent?: string
}): Promise<string | null> {
  const { result, triggeredBy, customerId, userAgent } = opts
  if (result.error) return null
  // T-259: query/fragment 제거. parse 실패 시 저장 skip (사용자에게 약속한 익명성 유지).
  const sanitizedUrl = sanitizeDiagnosticUrl(result.url)
  if (!sanitizedUrl) return null
  const admin = getAdminClient()
  if (!admin) return null
  try {
    const origin = new URL(sanitizedUrl).origin
    const { data, error } = await admin
      .from('diagnostic_runs')
      .insert({
        url: sanitizedUrl,
        origin,
        score: result.score,
        checks: result.checks,
        pages_scanned: result.pagesScanned,
        sitemap_present: result.sitemapPresent,
        triggered_by: triggeredBy,
        customer_id: customerId ?? null,
        user_agent: userAgent?.slice(0, 200) ?? null,
      })
      .select('id')
      .single()
    if (error) {
      console.error('[saveDiagnosticRun]', error.message)
      return null
    }
    return (data as { id: string }).id
  } catch (err) {
    console.error('[saveDiagnosticRun]', err instanceof Error ? err.message : 'unknown')
    return null
  }
}

/** 같은 origin 의 이전 실행 1건 조회 (현재 run 직전). */
export async function getPreviousRun(
  origin: string,
  beforeTimestamp: string,
): Promise<DiagnosticRunRow | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('diagnostic_runs')
    .select('id, url, origin, score, pages_scanned, sitemap_present, triggered_by, customer_id, created_at, checks')
    .eq('origin', origin)
    .lt('created_at', beforeTimestamp)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as DiagnosticRunRow | null) ?? null
}

/** 같은 origin 의 최근 N건 (점수 추이 차트용). */
export async function listRecentRuns(origin: string, limit = 30): Promise<DiagnosticRunRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('diagnostic_runs')
    .select('id, url, origin, score, pages_scanned, sitemap_present, triggered_by, customer_id, created_at, checks')
    .eq('origin', origin)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as DiagnosticRunRow[]
}

/** 점수 차이 계산. */
export function scoreDelta(prev: number | null, curr: number): {
  delta: number | null
  tone: 'up' | 'down' | 'same' | 'new'
  label: string
} {
  if (prev === null) return { delta: null, tone: 'new', label: '최초 진단' }
  const d = curr - prev
  if (d > 0) return { delta: d, tone: 'up', label: `이전 대비 +${d}점` }
  if (d < 0) return { delta: d, tone: 'down', label: `이전 대비 ${d}점` }
  return { delta: 0, tone: 'same', label: '이전과 동일' }
}

/** 체크별 변화 계산 — before/after 각 체크 상태·점수 비교. */
export interface CheckDiff {
  id: string
  label: string
  prevStatus: string | null
  currStatus: string
  prevPoints: number | null
  currPoints: number
  pointDelta: number
}

export function computeCheckDiffs(
  prevChecks: unknown,
  currChecks: Array<{ id: string; label: string; status: string; points: number }>,
): CheckDiff[] {
  const prevList = Array.isArray(prevChecks) ? prevChecks as Array<{ id: string; status: string; points: number }> : []
  const prevMap = new Map(prevList.map(c => [c.id, c]))
  return currChecks.map(c => {
    const p = prevMap.get(c.id)
    return {
      id: c.id,
      label: c.label,
      prevStatus: p?.status ?? null,
      currStatus: c.status,
      prevPoints: p?.points ?? null,
      currPoints: c.points,
      pointDelta: c.points - (p?.points ?? 0),
    }
  })
}
