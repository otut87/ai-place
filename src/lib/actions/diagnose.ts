'use server'

// T-136 / T-137 / T-139 — 공개 진단 서버 액션.
// 인증 불필요. rate limit 은 외부 (middleware 또는 Vercel Edge) 에서 처리 예정.

import { scanSite, type ScanResult } from '@/lib/diagnostic/scan-site'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { headers } from 'next/headers'

export async function runPublicDiagnosticAction(url: string): Promise<ScanResult> {
  if (!url || url.length > 500) {
    return {
      url,
      fetchedAt: new Date().toISOString(),
      score: 0,
      checks: [],
      error: 'URL 이 비었거나 너무 깁니다 (최대 500자)',
    }
  }
  return await scanSite(url)
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
