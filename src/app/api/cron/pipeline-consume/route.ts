// T-132 — 파이프라인 워커 크론.
// Vercel Cron 5분마다 호출 (vercel.json).
// pending 작업 1건 꺼내 job_type 별 핸들러 실행 → succeeded/failed 전환.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { generateBlogDraftAction } from '@/lib/actions/generate-blog-draft'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_RETRIES = 3

// 각 job_type 핸들러. input_payload 받아서 result_payload 반환.
async function handleBlogDraftGenerate(
  input: Record<string, unknown>,
): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
  const city = typeof input.city === 'string' ? input.city : ''
  const sector = typeof input.sector === 'string' ? input.sector : ''
  const category = typeof input.category === 'string' ? input.category : null
  const postType = typeof input.postType === 'string' ? input.postType as 'keyword' | 'compare' | 'guide' | 'general' : 'general'
  if (!city || !sector) return { success: false, error: 'city/sector 필수' }

  const r = await generateBlogDraftAction({ city, sector, category, postType })
  if (!r.success) return { success: false, error: r.error }
  return {
    success: true,
    result: {
      slug: r.slug,
      qualityScore: r.qualityScore,
      sevenBlockPassed: r.sevenBlockPassed,
      candidateCount: r.candidateCount,
    },
  }
}

async function dispatchJob(
  jobType: string,
  input: Record<string, unknown>,
): Promise<{ success: true; result: Record<string, unknown> } | { success: false; error: string }> {
  switch (jobType) {
    case 'blog_draft_generate':
      return handleBlogDraftGenerate(input)
    default:
      return { success: false, error: `unknown job_type: ${jobType}` }
  }
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  // 1. pending 작업 1건 조회 (FIFO, 오래된 것부터)
  const { data: pendingRows, error: fetchErr } = await admin
    .from('pipeline_jobs')
    .select('id, job_type, input_payload, retried_count')
    .eq('status', 'pending')
    .lt('retried_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(1)

  if (fetchErr) {
    return NextResponse.json({ error: `fetch_failed: ${fetchErr.message}` }, { status: 500 })
  }
  if (!pendingRows || pendingRows.length === 0) {
    return NextResponse.json({ ok: true, consumed: 0, message: 'no pending jobs' })
  }

  const job = pendingRows[0] as {
    id: string
    job_type: string
    input_payload: Record<string, unknown> | null
    retried_count: number
  }

  // 2. running 전환 (옵티미스틱 락)
  const { error: lockErr } = await admin
    .from('pipeline_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')

  if (lockErr) {
    return NextResponse.json({ ok: false, error: `lock_failed: ${lockErr.message}` }, { status: 500 })
  }

  // 3. 핸들러 실행
  const startedAt = Date.now()
  const outcome = await dispatchJob(job.job_type, job.input_payload ?? {})
  const durationMs = Date.now() - startedAt

  // 4. 결과 기록
  if (outcome.success) {
    await admin
      .from('pipeline_jobs')
      .update({
        status: 'succeeded',
        finished_at: new Date().toISOString(),
        result_payload: { ...outcome.result, durationMs },
      })
      .eq('id', job.id)
    return NextResponse.json({
      ok: true,
      consumed: 1,
      jobId: job.id,
      jobType: job.job_type,
      result: outcome.result,
      durationMs,
    })
  } else {
    const nextRetry = job.retried_count + 1
    await admin
      .from('pipeline_jobs')
      .update({
        status: nextRetry >= MAX_RETRIES ? 'failed' : 'pending', // 재시도 여지 있으면 pending 복귀
        finished_at: new Date().toISOString(),
        error: outcome.error,
        retried_count: nextRetry,
      })
      .eq('id', job.id)
    return NextResponse.json({
      ok: false,
      consumed: 1,
      jobId: job.id,
      jobType: job.job_type,
      error: outcome.error,
      retried: nextRetry,
      exhausted: nextRetry >= MAX_RETRIES,
      durationMs,
    })
  }
}
