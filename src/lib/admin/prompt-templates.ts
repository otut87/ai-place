// T-077 — prompt_templates CRUD + 활성화.
// 같은 카테고리 내 active=true 는 1개만 — update 시 기존 active 를 false 로 전환.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface PromptTemplateRow {
  id: string
  category: string
  version: number
  system_prompt: string
  user_template: string
  active: boolean
  notes: string | null
  created_at: string
}

export async function listPromptTemplates(category?: string): Promise<PromptTemplateRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  let q = admin
    .from('prompt_templates')
    .select('id, category, version, system_prompt, user_template, active, notes, created_at')
    .order('category', { ascending: true })
    .order('version', { ascending: false })
  if (category) q = q.eq('category', category)
  const { data } = await q
  return (data ?? []) as PromptTemplateRow[]
}

export async function getActivePromptTemplate(category: string): Promise<PromptTemplateRow | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data } = await admin
    .from('prompt_templates')
    .select('id, category, version, system_prompt, user_template, active, notes, created_at')
    .eq('category', category)
    .eq('active', true)
    .maybeSingle()
  return data as PromptTemplateRow | null
}

export interface UpsertPromptInput {
  category: string
  systemPrompt: string
  userTemplate: string
  notes?: string
}

export async function createPromptVersion(input: UpsertPromptInput): Promise<{ success: boolean; id?: string; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: last } = await admin
    .from('prompt_templates')
    .select('version')
    .eq('category', input.category)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = ((last as { version: number } | null)?.version ?? 0) + 1

  const { data, error } = await admin
    .from('prompt_templates')
    .insert({
      category: input.category,
      version: nextVersion,
      system_prompt: input.systemPrompt,
      user_template: input.userTemplate,
      notes: input.notes ?? null,
      active: false,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, id: (data as { id: string }).id }
}

/** 특정 버전을 활성으로 설정 — 같은 카테고리의 기존 active 는 해제. */
export async function activatePromptVersion(id: string): Promise<{ success: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { data: row, error: loadErr } = await admin
    .from('prompt_templates')
    .select('category')
    .eq('id', id)
    .single()
  if (loadErr || !row) return { success: false, error: '템플릿을 찾을 수 없습니다.' }

  const category = (row as { category: string }).category

  // 기존 active 해제 → 새 active 설정 (순서 중요: unique constraint 회피)
  const { error: deactErr } = await admin
    .from('prompt_templates')
    .update({ active: false })
    .eq('category', category)
    .eq('active', true)
  if (deactErr) return { success: false, error: deactErr.message }

  const { error: actErr } = await admin
    .from('prompt_templates')
    .update({ active: true })
    .eq('id', id)
  if (actErr) return { success: false, error: actErr.message }

  return { success: true }
}

/** 템플릿 토큰 치환 — {{name}}, {{address}} 등. */
export function renderTemplate(template: string, vars: Record<string, string | number | undefined>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key]
    return v == null ? '' : String(v)
  })
}

/** A/B 비교용: 버전별 평균 quality_score + 통과율 집계. */
export interface PromptAggregate {
  promptTemplateId: string
  version: number
  calls: number
  passRate: number        // 0~1 (quality_score >= 70)
  avgScore: number        // 평균 quality_score
}

export async function getPromptAggregates(category: string): Promise<PromptAggregate[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const { data: templates } = await admin
    .from('prompt_templates')
    .select('id, version')
    .eq('category', category)
  if (!templates) return []

  const out: PromptAggregate[] = []
  for (const t of templates as Array<{ id: string; version: number }>) {
    const { data: gens } = await admin
      .from('ai_generations')
      .select('quality_score')
      .eq('prompt_template_id', t.id)
    const rows = (gens ?? []) as Array<{ quality_score: number | null }>
    const calls = rows.length
    if (calls === 0) {
      out.push({ promptTemplateId: t.id, version: t.version, calls: 0, passRate: 0, avgScore: 0 })
      continue
    }
    const scores = rows.map(r => r.quality_score ?? 0)
    const avg = scores.reduce((a, b) => a + b, 0) / calls
    const pass = scores.filter(s => s >= 70).length / calls
    out.push({ promptTemplateId: t.id, version: t.version, calls, passRate: pass, avgScore: avg })
  }
  return out.sort((a, b) => b.version - a.version)
}
