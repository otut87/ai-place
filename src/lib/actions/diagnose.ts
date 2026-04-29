'use server'

// T-136 / T-137 / T-139 — 공개 진단 서버 액션.
// 인증 불필요. T-256: Upstash 분산 rate limit (분당 5회/IP) 도입 — SSRF 호스트 차단(T-254 #2)
// 만으로 막지 못하는 DDoS 증폭 / cost amplification 벡터 차단.

import { scanSite, type ScanResult } from '@/lib/diagnostic/scan-site'
import { saveDiagnosticRun, getPreviousRun, scoreDelta, computeCheckDiffs } from '@/lib/diagnostic/history'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rate-limit'
import { headers } from 'next/headers'

export interface DiagnosticCompare {
  prev: {
    runId: string
    score: number
    createdAt: string
  } | null
  delta: { delta: number | null; tone: 'up' | 'down' | 'same' | 'new'; label: string }
  checkDiffs?: Array<{ id: string; label: string; prevStatus: string | null; currStatus: string; prevPoints: number | null; currPoints: number; pointDelta: number }>
}

export async function runPublicDiagnosticAction(url: string): Promise<ScanResult & { compare?: DiagnosticCompare }> {
  if (!url || url.length > 500) {
    return {
      url,
      fetchedAt: new Date().toISOString(),
      score: 0,
      checks: [],
      error: 'URL 이 비었거나 너무 깁니다 (최대 500자)',
      pagesScanned: 0,
      sitemapPresent: false,
    }
  }

  // T-256 — 분당 5회/IP 제한. scanSite 자체가 8 concurrent × 49 pages = 최대 392
  // 외부 fetch 를 발생시키므로 무제한 호출은 DDoS 증폭 + LLM 비용 폭주 위험.
  const rlHeaders = await headers()
  const rlIp = clientIpFromHeaders(name => rlHeaders.get(name))
  const rl = await checkRateLimit(rlIp, 'diagnose')
  if (!rl.success) {
    const retryInSec = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
    return {
      url,
      fetchedAt: new Date().toISOString(),
      score: 0,
      checks: [],
      error: `요청이 너무 많습니다. ${retryInSec}초 후 다시 시도해 주세요. (분당 ${rl.limit}회 제한)`,
      pagesScanned: 0,
      sitemapPresent: false,
    }
  }

  const result = await scanSite(url)
  if (result.error) return result

  // 이전 진단 조회 → 저장 (순서 중요: 현재 결과 저장 전에 이전 조회)
  let compare: DiagnosticCompare | undefined
  try {
    const origin = new URL(result.url).origin
    const hdrs = await headers()
    const ua = hdrs.get('user-agent') ?? ''
    const prev = await getPreviousRun(origin, result.fetchedAt)
    const delta = scoreDelta(prev?.score ?? null, result.score)
    compare = {
      prev: prev ? { runId: prev.id, score: prev.score, createdAt: prev.created_at } : null,
      delta,
      checkDiffs: prev
        ? computeCheckDiffs(prev.checks, result.checks.map(c => ({ id: c.id, label: c.label, status: c.status, points: c.points })))
        : undefined,
    }
    await saveDiagnosticRun({ result, triggeredBy: 'public', userAgent: ua })
  } catch (err) {
    // T-259: silent failure 였음. observability(R7) 도입 전까진 console 이 유일한 신호.
    // 이력 저장 실패해도 진단 결과는 반환 (UX 차단 방지).
    console.error('[diagnose] history pipeline failed', err instanceof Error ? err.message : err)
  }
  return { ...result, compare }
}

// T-257 — captureLeadAction 제거. /check 페이지의 LeadForm 이 PDF 자동 발송 / 안내
// 메일 / admin/leads 페이지 어느 것도 없는 dead funnel 이었음 (사용자에게 거짓 약속).
// leads 테이블은 보존 (migration 025) — 미래 admin/leads + 자동 follow-up 도입 시 활용 가능.
