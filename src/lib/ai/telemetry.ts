// LLM 호출 텔레메트리 (T-028)
// 모든 AI 호출을 ai_generations 테이블에 누적하여 비용·지연·품질을 관측한다.
// - 실패하면 로그만 남기고 throw 하지 않는다 (본 호출 흐름을 막지 않는다).
// - service_role 로 insert 하므로 RLS 우회.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface LogGenerationInput {
  placeId?: string | null
  stage: 'preprocess' | 'content' | 'recommendation' | 'other'
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  qualityScore?: number | null
  retried?: number
}

export async function logAIGeneration(input: LogGenerationInput): Promise<void> {
  const client = getAdminClient()
  if (!client) {
    console.warn('[telemetry] admin client 미초기화 — 로그 스킵')
    return
  }
  try {
    const { error } = await (client.from('ai_generations') as ReturnType<typeof client.from>).insert({
      place_id: input.placeId ?? null,
      stage: input.stage,
      model: input.model,
      input_tokens: Math.max(0, Math.round(input.inputTokens)),
      output_tokens: Math.max(0, Math.round(input.outputTokens)),
      latency_ms: Math.max(0, Math.round(input.latencyMs)),
      quality_score: input.qualityScore ?? null,
      retried: input.retried ?? 0,
    } as never)
    if (error) {
      console.error('[telemetry] insert 실패:', error.message)
    }
  } catch (err) {
    console.error('[telemetry] insert 예외:', err instanceof Error ? err.message : err)
  }
}

export interface GenerationStats {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  avgLatencyMs: number
  avgQualityScore: number | null
  byStage: Record<string, number>
}

/**
 * 지정 기간(기본 30일) 내 호출 집계.
 * 어드민 대시보드에서 월 평균 비용·지연 요약에 사용.
 */
export async function getGenerationStats(daysBack = 30): Promise<GenerationStats | null> {
  const client = getAdminClient()
  if (!client) return null
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await client
    .from('ai_generations')
    .select('stage, input_tokens, output_tokens, latency_ms, quality_score')
    .gte('created_at', since)

  if (error || !data) {
    console.error('[telemetry] stats 조회 실패:', error?.message)
    return null
  }

  const rows = data as Array<{
    stage: string
    input_tokens: number
    output_tokens: number
    latency_ms: number
    quality_score: number | null
  }>

  const byStage: Record<string, number> = {}
  let totalInput = 0
  let totalOutput = 0
  let totalLatency = 0
  let qualitySum = 0
  let qualityCount = 0

  for (const r of rows) {
    byStage[r.stage] = (byStage[r.stage] ?? 0) + 1
    totalInput += r.input_tokens
    totalOutput += r.output_tokens
    totalLatency += r.latency_ms
    if (r.quality_score != null) {
      qualitySum += r.quality_score
      qualityCount += 1
    }
  }

  return {
    totalCalls: rows.length,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    avgLatencyMs: rows.length > 0 ? Math.round(totalLatency / rows.length) : 0,
    avgQualityScore: qualityCount > 0 ? Math.round(qualitySum / qualityCount) : null,
    byStage,
  }
}
