'use server'

// T-165 — 진단 리포트 공유 링크 생성·조회.
import { getAdminClient } from '@/lib/supabase/admin-client'
import { randomBytes } from 'crypto'

export interface CreateShareInput {
  runId: string
  title?: string
  clientName?: string
  baselineRunId?: string
  expiryDays?: number           // 기본 30
}

export interface ShareLink {
  hash: string
  url: string
  expiresAt: string
}

export type CreateShareOutcome =
  | { success: true; link: ShareLink }
  | { success: false; error: string }

export async function createReportShareAction(input: CreateShareInput): Promise<CreateShareOutcome> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 16자 hash (base36)
  const hash = randomBytes(12).toString('base64url').slice(0, 16)
  const expiryDays = input.expiryDays ?? 30
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await admin.from('report_shares').insert({
    hash,
    run_id: input.runId,
    title: input.title ?? null,
    client_name: input.clientName ?? null,
    baseline_run_id: input.baselineRunId ?? null,
    expires_at: expiresAt,
  })
  if (error) return { success: false, error: error.message }

  return {
    success: true,
    link: {
      hash,
      url: `/reports/${hash}`,
      expiresAt,
    },
  }
}

export interface ShareView {
  hash: string
  runId: string
  title: string | null
  clientName: string | null
  baselineRunId: string | null
  expiresAt: string
  views: number
}

/** 만료 확인 + 조회수 증가. 만료/없음 null. */
export async function viewReportShare(hash: string): Promise<ShareView | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('report_shares')
    .select('hash, run_id, title, client_name, baseline_run_id, expires_at, views')
    .eq('hash', hash)
    .maybeSingle()
  if (!data) return null
  const row = data as { hash: string; run_id: string; title: string | null; client_name: string | null; baseline_run_id: string | null; expires_at: string; views: number }

  if (new Date(row.expires_at).getTime() < Date.now()) return null

  // 조회수 증가 (실패 무시)
  await admin
    .from('report_shares')
    .update({ views: row.views + 1, last_viewed_at: new Date().toISOString() })
    .eq('hash', hash)

  return {
    hash: row.hash,
    runId: row.run_id,
    title: row.title,
    clientName: row.client_name,
    baselineRunId: row.baseline_run_id,
    expiresAt: row.expires_at,
    views: row.views + 1,
  }
}
