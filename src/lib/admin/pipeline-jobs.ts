// T-076 — pipeline_jobs 조회·재시도 헬퍼.
// 원칙: 어드민 UI 가 쓰는 얇은 래퍼. insert/update 는 각 파이프라인 스텝에서 담당.

import { getAdminClient } from '@/lib/supabase/admin-client'

export type PipelineJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface PipelineJobRow {
  id: string
  job_type: string
  target_type: string | null
  target_id: string | null
  status: PipelineJobStatus
  error: string | null
  retried_count: number
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface PipelineJobFilter {
  status?: PipelineJobStatus | 'all'
  jobType?: string | null
  limit?: number
}

export async function listPipelineJobs(filter: PipelineJobFilter = {}): Promise<PipelineJobRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  let query = admin
    .from('pipeline_jobs')
    .select('id, job_type, target_type, target_id, status, error, retried_count, started_at, finished_at, created_at')
    .order('created_at', { ascending: false })
    .limit(filter.limit ?? 100)

  if (filter.status && filter.status !== 'all') {
    query = query.eq('status', filter.status)
  }
  if (filter.jobType) {
    query = query.eq('job_type', filter.jobType)
  }

  const { data, error } = await query
  if (error || !data) return []
  return data as PipelineJobRow[]
}

export const JOB_STATUS_LABEL: Record<PipelineJobStatus, string> = {
  pending: '대기',
  running: '실행 중',
  succeeded: '성공',
  failed: '실패',
  canceled: '취소',
}

export function jobStatusTone(status: PipelineJobStatus): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'succeeded') return 'ok'
  if (status === 'failed') return 'danger'
  if (status === 'running' || status === 'pending') return 'warn'
  return 'muted'
}

/** 같은 job_type·target 으로 pending 상태 레코드 복제 (재시도). */
export async function retryPipelineJob(jobId: string): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: orig, error: loadErr } = await admin
    .from('pipeline_jobs')
    .select('job_type, target_type, target_id, input_payload, retried_count')
    .eq('id', jobId)
    .single()

  if (loadErr || !orig) return { success: false, error: '작업을 찾을 수 없습니다.' }

  const typed = orig as {
    job_type: string
    target_type: string | null
    target_id: string | null
    input_payload: unknown
    retried_count: number
  }

  const { error } = await admin.from('pipeline_jobs').insert({
    job_type: typed.job_type,
    target_type: typed.target_type,
    target_id: typed.target_id,
    input_payload: typed.input_payload,
    retried_count: typed.retried_count + 1,
    status: 'pending',
  })

  if (error) return { success: false, error: error.message }
  return { success: true }
}
