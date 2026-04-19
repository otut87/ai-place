'use server'

// T-076 — 파이프라인 작업 재시도 서버 액션.

import { requireAuthForAction } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { retryPipelineJob } from '@/lib/admin/pipeline-jobs'

export async function retryPipelineJobAction(jobId: string) {
  await requireAuthForAction()
  const r = await retryPipelineJob(jobId)
  if (r.success) revalidatePath('/admin/pipelines')
  return r
}
