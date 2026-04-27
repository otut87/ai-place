'use server'

// T-136 / T-137 / T-139 — 공개 진단 서버 액션.
// 인증 불필요. T-256: Upstash 분산 rate limit (분당 5회/IP) 도입 — SSRF 호스트 차단(T-254 #2)
// 만으로 막지 못하는 DDoS 증폭 / cost amplification 벡터 차단.

import { scanSite, type ScanResult } from '@/lib/diagnostic/scan-site'
import { getAdminClient } from '@/lib/supabase/admin-client'
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
  } catch {
    // 이력 기능 실패해도 진단 결과는 반환
  }
  return { ...result, compare }
}

export interface LeadCaptureInput {
  email: string
  businessName?: string
  targetUrl?: string
  diagnosticScore?: number
  phone?: string
}

export async function captureLeadAction(input: LeadCaptureInput): Promise<{ success: boolean; error?: string }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '올바른 이메일 주소를 입력해 주세요' }
  }

  // T-256 — 폼 제출 분당 10회/IP 제한 (이메일 enum + lead spam 방지).
  const rlHeaders = await headers()
  const rlIp = clientIpFromHeaders(name => rlHeaders.get(name))
  const rl = await checkRateLimit(rlIp, 'form')
  if (!rl.success) {
    const retryInSec = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
    return { success: false, error: `요청이 너무 많습니다. ${retryInSec}초 후 다시 시도해 주세요.` }
  }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // IP 기반 간단 중복 방지 — 같은 이메일 24시간 내 중복 저장 무시.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: existing } = await admin
    .from('leads')
    .select('id')
    .eq('email', email)
    .gte('created_at', since)
    .limit(1)
  if (existing && existing.length > 0) {
    return { success: true } // silent accept (중복 UX 친화적)
  }

  const hdrs = await headers()
  const userAgent = hdrs.get('user-agent') ?? ''

  const { error } = await admin.from('leads').insert({
    email,
    business_name: input.businessName?.trim() || null,
    target_url: input.targetUrl?.trim() || null,
    diagnostic_score: input.diagnosticScore ?? null,
    source: 'check',
    notes: userAgent.slice(0, 200),
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
