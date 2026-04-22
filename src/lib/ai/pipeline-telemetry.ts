// T-195 — 파이프라인 단계별 텔레메트리 (Phase 3).
// ai_generations 는 LLM 호출 단위 로그 (기존). 이 모듈은 "블로그 1편 생성 흐름" 전체를
// blog_posts.pipeline_log 에 구조화하여 저장 — 관리자 대시보드에서 단계별 토큰·지연·실패 사유 시각화.

export type PipelineStage =
  | 'researcher'
  | 'writer'
  | 'quality-score'
  | 'quality-reviewer'
  | 'medical-law-checker'
  | 'writer-rewrite'
  | 'quality-score-final'
  | 'image-thumbnail'
  | 'image-place-photos'
  | 'similarity-guard'

export interface PipelineStageLog {
  stage: PipelineStage
  model?: string                         // e.g. 'claude-sonnet-4-6', 'gpt-image-2'
  inputTokens?: number
  outputTokens?: number
  latencyMs: number
  retried?: number
  /** 단계별 주요 결과 — stage 에 따라 의미 다름. */
  result?: Record<string, unknown>
  /** pass/warn/fail 등 간단 상태. */
  status?: 'pass' | 'warn' | 'fail' | 'skip'
  error?: string
}

export interface PipelineLog {
  startedAt: string                      // ISO
  completedAt?: string
  totalLatencyMs: number
  stages: PipelineStageLog[]
  /** 비용 (KRW, 환율 1,400원 기준 추정). */
  estimatedCostKrw: number
  /** 성공 여부. fail 단계 존재 시 false. */
  success: boolean
}

const USD_TO_KRW = 1400

// 모델별 단가 (2026-04 기준, USD per 1M tokens).
// Anthropic: https://www.anthropic.com/pricing
// OpenAI:    https://platform.openai.com/docs/pricing
const PRICING: Record<string, { input: number; output: number } | { perImage: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 0.8, output: 4 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'gpt-image-2': { perImage: 0.006 },      // low quality 1024×1024
  'google-places-photo': { perImage: 0.007 },
  'google-places-text-search': { perImage: 0.032 },
}

/** 단계 단가 → KRW 환산. */
export function estimateStageCostKrw(log: PipelineStageLog): number {
  if (!log.model) return 0
  const pricing = PRICING[log.model]
  if (!pricing) return 0

  if ('perImage' in pricing) {
    return pricing.perImage * USD_TO_KRW
  }

  const inUsd = (log.inputTokens ?? 0) / 1_000_000 * pricing.input
  const outUsd = (log.outputTokens ?? 0) / 1_000_000 * pricing.output
  return (inUsd + outUsd) * USD_TO_KRW
}

export class PipelineTelemetry {
  private startedAt = new Date()
  private stages: PipelineStageLog[] = []

  record(log: PipelineStageLog): void {
    this.stages.push(log)
  }

  /** 비동기 블록 실행 시간 측정 + 결과·에러 자동 캡처. */
  async run<T>(
    stage: PipelineStage,
    fn: () => Promise<T>,
    opts: {
      model?: string
      extractTokens?: (r: T) => { input?: number; output?: number }
      extractResult?: (r: T) => Record<string, unknown>
      extractStatus?: (r: T) => PipelineStageLog['status']
    } = {},
  ): Promise<T | null> {
    const t0 = Date.now()
    try {
      const r = await fn()
      const tokens = opts.extractTokens?.(r) ?? {}
      this.record({
        stage,
        model: opts.model,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        latencyMs: Date.now() - t0,
        result: opts.extractResult?.(r),
        status: opts.extractStatus?.(r) ?? 'pass',
      })
      return r
    } catch (err) {
      this.record({
        stage,
        model: opts.model,
        latencyMs: Date.now() - t0,
        status: 'fail',
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  build(): PipelineLog {
    const completedAt = new Date()
    const totalLatencyMs = completedAt.getTime() - this.startedAt.getTime()
    const estimatedCostKrw = this.stages.reduce(
      (sum, s) => sum + estimateStageCostKrw(s),
      0,
    )
    const success = !this.stages.some(s => s.status === 'fail')
    return {
      startedAt: this.startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      totalLatencyMs,
      stages: this.stages,
      estimatedCostKrw: Math.round(estimatedCostKrw * 100) / 100,
      success,
    }
  }

  get stageCount(): number {
    return this.stages.length
  }
}
