// T-076 — pipeline_jobs 조회·재시도 헬퍼.
// 원칙: 어드민 UI 가 쓰는 얇은 래퍼. insert/update 는 각 파이프라인 스텝에서 담당.

import { getAdminClient } from '@/lib/supabase/admin-client'

export type PipelineJobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'canceled'

export interface PipelineJobRow {
  id: string
  job_type: string
  target_type: string | null
  target_id: string | null
  target_name: string | null   // target_type='place' 인 경우 places.name 병합. 그 외 null.
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

  const rows = data as Array<Omit<PipelineJobRow, 'target_name'>>

  // places.name 병합 (target_type='place' 만)
  const placeIds = Array.from(
    new Set(
      rows
        .filter(r => r.target_type === 'place' && r.target_id)
        .map(r => r.target_id as string),
    ),
  )

  const nameMap = new Map<string, string>()
  if (placeIds.length > 0) {
    const { data: placeRows } = await admin
      .from('places')
      .select('id, name')
      .in('id', placeIds)
    for (const p of (placeRows ?? []) as Array<{ id: string; name: string }>) {
      nameMap.set(p.id, p.name)
    }
  }

  return rows.map(r => ({
    ...r,
    target_name:
      r.target_type === 'place' && r.target_id ? nameMap.get(r.target_id) ?? null : null,
  }))
}

export const JOB_STATUS_LABEL: Record<PipelineJobStatus, string> = {
  pending: '대기',
  running: '실행 중',
  succeeded: '성공',
  failed: '실패',
  canceled: '취소',
}

/** job_type → 한국어 라벨. 미등록 job_type 은 raw 문자열 폴백. */
export const JOB_TYPE_LABEL: Record<string, string> = {
  'place.enrich_google': 'Google 정보 재수집',
  'place.summarize_google_reviews': 'Google 리뷰 요약',
  'blog_draft_generate': '블로그 초안 생성',
}

export function formatJobType(jobType: string): string {
  return JOB_TYPE_LABEL[jobType] ?? jobType
}

export function jobStatusTone(status: PipelineJobStatus): 'ok' | 'warn' | 'danger' | 'muted' {
  if (status === 'succeeded') return 'ok'
  if (status === 'failed') return 'danger'
  if (status === 'running' || status === 'pending') return 'warn'
  return 'muted'
}

/** Phase 11 — 업체 단위 refresh 작업 enqueue.
 *  - 같은 (job_type, target_id) 로 pending/running 잡이 이미 있으면 중복 enqueue 하지 않음 (dedup).
 *  - 호출자가 결과를 기다릴 필요 없음. 실패는 조용히 로그만.
 */
export type PlaceRefreshJobKind =
  | 'place.enrich_google'          // Google Places API 로 rating/reviewCount/reviews 재수집
  | 'place.summarize_google_reviews' // Haiku 로 Google 리뷰 요약 재생성

/** slug 로 id 조회 후 enqueuePlaceRefresh 호출. 페이지 렌더 경로에서 편의용. */
export async function enqueuePlaceRefreshBySlug(
  slug: string,
  kinds: PlaceRefreshJobKind[],
): Promise<{ enqueued: PlaceRefreshJobKind[]; skipped: PlaceRefreshJobKind[] }> {
  const admin = getAdminClient()
  if (!admin) return { enqueued: [], skipped: kinds }
  const { data } = await admin.from('places').select('id').eq('slug', slug).single()
  const row = data as { id: string } | null
  if (!row?.id) return { enqueued: [], skipped: kinds }
  return enqueuePlaceRefresh(row.id, kinds)
}

export async function enqueuePlaceRefresh(
  placeId: string,
  kinds: PlaceRefreshJobKind[],
): Promise<{ enqueued: PlaceRefreshJobKind[]; skipped: PlaceRefreshJobKind[] }> {
  const admin = getAdminClient()
  if (!admin) return { enqueued: [], skipped: kinds }

  // 이미 대기·실행 중인 동일 잡은 skip
  const { data: existing } = await admin
    .from('pipeline_jobs')
    .select('job_type')
    .eq('target_type', 'place')
    .eq('target_id', placeId)
    .in('status', ['pending', 'running'])
    .in('job_type', kinds)

  const existingTypes = new Set(((existing ?? []) as Array<{ job_type: string }>).map(r => r.job_type))
  const toEnqueue = kinds.filter(k => !existingTypes.has(k))
  const skipped = kinds.filter(k => existingTypes.has(k))

  if (toEnqueue.length === 0) return { enqueued: [], skipped }

  const rows = toEnqueue.map(k => ({
    job_type: k,
    target_type: 'place',
    target_id: placeId,
    input_payload: { placeId },
    status: 'pending',
  }))

  const { error } = await admin.from('pipeline_jobs').insert(rows)
  if (error) {
    console.error('[pipeline-jobs] enqueuePlaceRefresh failed:', error)
    return { enqueued: [], skipped: kinds }
  }
  return { enqueued: toEnqueue, skipped }
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
