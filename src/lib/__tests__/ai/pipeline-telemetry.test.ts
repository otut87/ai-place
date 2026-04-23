// T-195 — pipeline-telemetry 테스트.
import { describe, it, expect } from 'vitest'
import { PipelineTelemetry, estimateStageCostKrw } from '@/lib/ai/pipeline-telemetry'

describe('PipelineTelemetry', () => {
  it('record() 로 단계 추가 + build() 로 PipelineLog 조립', () => {
    const t = new PipelineTelemetry()
    t.record({ stage: 'writer', model: 'claude-sonnet-4-6', latencyMs: 100, status: 'pass', inputTokens: 1000, outputTokens: 500 })
    t.record({ stage: 'quality-score', latencyMs: 5, status: 'pass' })

    const log = t.build()
    expect(log.stages.length).toBe(2)
    expect(log.success).toBe(true)
    expect(log.totalLatencyMs).toBeGreaterThanOrEqual(0)
    expect(log.estimatedCostKrw).toBeGreaterThan(0)
  })

  it('fail 단계 있으면 success=false', () => {
    const t = new PipelineTelemetry()
    t.record({ stage: 'writer', latencyMs: 10, status: 'fail', error: 'test' })
    expect(t.build().success).toBe(false)
  })

  it('run() 이 성공 결과를 record 하고 반환값 전달', async () => {
    const t = new PipelineTelemetry()
    const r = await t.run('writer', async () => ({ foo: 'bar' }), {
      model: 'claude-sonnet-4-6',
      extractResult: r => ({ got: r.foo }),
    })
    expect(r).toEqual({ foo: 'bar' })
    const log = t.build()
    expect(log.stages[0].result).toEqual({ got: 'bar' })
    expect(log.stages[0].status).toBe('pass')
  })

  it('run() 이 throw 하면 fail 로 기록하고 null 반환', async () => {
    const t = new PipelineTelemetry()
    const r = await t.run('writer', async () => { throw new Error('boom') })
    expect(r).toBeNull()
    const log = t.build()
    expect(log.stages[0].status).toBe('fail')
    expect(log.stages[0].error).toContain('boom')
    expect(log.success).toBe(false)
  })

  it('stageCount 증가 추적', () => {
    const t = new PipelineTelemetry()
    expect(t.stageCount).toBe(0)
    t.record({ stage: 'writer', latencyMs: 1 })
    expect(t.stageCount).toBe(1)
  })
})

describe('estimateStageCostKrw', () => {
  it('Sonnet 입력 1M + 출력 1M 토큰 ≈ $3+$15 = $18 → ~25,200원', () => {
    const c = estimateStageCostKrw({
      stage: 'writer', model: 'claude-sonnet-4-6', latencyMs: 1,
      inputTokens: 1_000_000, outputTokens: 1_000_000,
    })
    expect(c).toBeGreaterThan(24000)
    expect(c).toBeLessThan(26000)
  })

  it('model 지정 없으면 0', () => {
    expect(estimateStageCostKrw({ stage: 'writer', latencyMs: 1 })).toBe(0)
  })

  it('알 수 없는 model 은 0', () => {
    expect(estimateStageCostKrw({
      stage: 'writer', model: 'unknown-model', latencyMs: 1,
      inputTokens: 1000, outputTokens: 1000,
    })).toBe(0)
  })
})
