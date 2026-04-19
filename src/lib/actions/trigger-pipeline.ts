'use server'

// T-080 — 수동 등록 직후 pipeline_jobs 에 enqueue.
// 실제 실행은 별도 워커/cron 이 pending 상태를 소비해서 처리 (현재는 큐잉만).

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'

export interface EnqueueInput {
  jobType: 'collect' | 'generate' | 'publish'
  targetType?: 'place' | 'blog_post'
  targetId?: string
  payload?: unknown
}

export async function enqueuePipelineJob(input: EnqueueInput): Promise<{ success: boolean; id?: string; error?: string }> {
  await requireAuthForAction()

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data, error } = await admin
    .from('pipeline_jobs')
    .insert({
      job_type: input.jobType,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      input_payload: input.payload ?? null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: (data as { id: string }).id }
}
