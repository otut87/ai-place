'use server'

// T-167·T-169·T-170 — 컨설팅 engagement 관리.
import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { scanSite } from '@/lib/diagnostic/scan-site'
import { saveDiagnosticRun } from '@/lib/diagnostic/history'
import { revalidatePath } from 'next/cache'

export interface CreateEngagementInput {
  targetUrl: string
  clientName?: string
  customerId?: string
  contractAmount?: number
  assignedTo?: string
  notes?: string
}

export type CreateEngagementOutcome =
  | { success: true; engagementId: string; baselineRunId: string; taskCount: number }
  | { success: false; error: string }

/** baseline 진단 실행 → engagement 생성 → 작업 체크리스트 자동 생성. */
export async function createEngagementAction(input: CreateEngagementInput): Promise<CreateEngagementOutcome> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1) baseline 진단
  const scan = await scanSite(input.targetUrl)
  if (scan.error) return { success: false, error: `진단 실패: ${scan.error}` }

  const baselineRunId = await saveDiagnosticRun({ result: scan, triggeredBy: 'premium', customerId: input.customerId ?? null })
  if (!baselineRunId) return { success: false, error: 'baseline run 저장 실패' }

  // 2) engagement 생성
  const { data: eng, error: engError } = await admin
    .from('engagements')
    .insert({
      customer_id: input.customerId ?? null,
      target_url: scan.url,
      status: 'in_progress',
      contract_amount: input.contractAmount ?? null,
      baseline_run_id: baselineRunId,
      assigned_to: input.assignedTo ?? null,
      client_name: input.clientName ?? null,
      notes: input.notes ?? null,
    })
    .select('id')
    .single()
  if (engError || !eng) return { success: false, error: engError?.message ?? 'engagement 생성 실패' }
  const engagementId = (eng as { id: string }).id

  // 3) 작업 체크리스트 자동 생성 (fail + warn)
  const tasks = scan.checks
    .filter(c => c.status !== 'pass')
    .map(c => ({
      engagement_id: engagementId,
      check_id: c.id,
      label: c.label,
      initial_points: c.points,
      max_points: c.maxPoints,
    }))
  if (tasks.length > 0) {
    await admin.from('engagement_tasks').insert(tasks)
  }

  revalidatePath('/admin/consulting')
  return { success: true, engagementId, baselineRunId, taskCount: tasks.length }
}

export interface CompleteEngagementOutcome {
  success: boolean
  error?: string
  finalRunId?: string
  finalScore?: number
  delta?: number
}

/** engagement 완료 — final 진단 실행 후 delta 계산. */
export async function completeEngagementAction(engagementId: string): Promise<CompleteEngagementOutcome> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: eng } = await admin
    .from('engagements')
    .select('target_url, baseline_run_id, customer_id')
    .eq('id', engagementId)
    .maybeSingle()
  if (!eng) return { success: false, error: 'engagement 없음' }
  const row = eng as { target_url: string; baseline_run_id: string; customer_id: string | null }

  const scan = await scanSite(row.target_url)
  if (scan.error) return { success: false, error: `final 진단 실패: ${scan.error}` }

  const finalRunId = await saveDiagnosticRun({ result: scan, triggeredBy: 'premium', customerId: row.customer_id })
  if (!finalRunId) return { success: false, error: 'final run 저장 실패' }

  const { data: baseline } = await admin
    .from('diagnostic_runs')
    .select('score')
    .eq('id', row.baseline_run_id)
    .maybeSingle()
  const baselineScore = (baseline as { score: number } | null)?.score ?? 0
  const delta = scan.score - baselineScore

  await admin
    .from('engagements')
    .update({ status: 'completed', final_run_id: finalRunId, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', engagementId)

  revalidatePath('/admin/consulting')
  return { success: true, finalRunId, finalScore: scan.score, delta }
}

/** 체크리스트 완료 토글. */
export async function toggleEngagementTaskAction(taskId: string, done: boolean): Promise<{ success: boolean; error?: string }> {
  await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }
  const { error } = await admin
    .from('engagement_tasks')
    .update({ done, done_at: done ? new Date().toISOString() : null })
    .eq('id', taskId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}
