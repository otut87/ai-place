/**
 * telemetry.ts 테스트 (T-028)
 * Supabase admin client 를 mock 하여 insert payload·집계 로직만 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockGte = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => {
  return {
    getAdminClient: () => ({
      from: vi.fn(() => ({
        insert: mockInsert,
        select: mockSelect,
      })),
    }),
  }
})

beforeEach(() => {
  mockInsert.mockReset()
  mockSelect.mockReset()
  mockGte.mockReset()
  // select('...').gte(...) 체이닝을 기본값으로 세팅
  mockSelect.mockImplementation(() => ({ gte: mockGte }))
})
afterEach(() => {
  vi.resetModules()
})

describe('logAIGeneration', () => {
  it('insert payload 필드 매핑', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { logAIGeneration } = await import('@/lib/ai/telemetry')
    await logAIGeneration({
      placeId: 'p-1',
      stage: 'content',
      model: 'claude-sonnet-4-6',
      inputTokens: 1200,
      outputTokens: 340,
      latencyMs: 2500,
      qualityScore: 85,
      retried: 1,
    })
    expect(mockInsert).toHaveBeenCalledTimes(1)
    const payload = mockInsert.mock.calls[0][0]
    expect(payload.place_id).toBe('p-1')
    expect(payload.stage).toBe('content')
    expect(payload.model).toBe('claude-sonnet-4-6')
    expect(payload.input_tokens).toBe(1200)
    expect(payload.output_tokens).toBe(340)
    expect(payload.latency_ms).toBe(2500)
    expect(payload.quality_score).toBe(85)
    expect(payload.retried).toBe(1)
  })

  it('음수 토큰/지연 → 0 으로 clamp', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { logAIGeneration } = await import('@/lib/ai/telemetry')
    await logAIGeneration({
      stage: 'other', model: 'x',
      inputTokens: -10, outputTokens: -5, latencyMs: -1,
    })
    const payload = mockInsert.mock.calls[0][0]
    expect(payload.input_tokens).toBe(0)
    expect(payload.output_tokens).toBe(0)
    expect(payload.latency_ms).toBe(0)
    expect(payload.place_id).toBeNull()
  })

  it('insert 에러 발생해도 throw 하지 않음', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'db down' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logAIGeneration } = await import('@/lib/ai/telemetry')
    await expect(
      logAIGeneration({ stage: 'other', model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('insert 예외 발생해도 throw 하지 않음', async () => {
    mockInsert.mockRejectedValue(new Error('network'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logAIGeneration } = await import('@/lib/ai/telemetry')
    await expect(
      logAIGeneration({ stage: 'other', model: 'x', inputTokens: 0, outputTokens: 0, latencyMs: 0 }),
    ).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('getGenerationStats', () => {
  it('집계: totals + avg + byStage', async () => {
    mockGte.mockResolvedValue({
      data: [
        { stage: 'content', input_tokens: 100, output_tokens: 50, latency_ms: 1000, quality_score: 80 },
        { stage: 'content', input_tokens: 200, output_tokens: 100, latency_ms: 2000, quality_score: 90 },
        { stage: 'preprocess', input_tokens: 50, output_tokens: 20, latency_ms: 500, quality_score: null },
      ],
      error: null,
    })
    const { getGenerationStats } = await import('@/lib/ai/telemetry')
    const stats = await getGenerationStats(30)
    expect(stats).not.toBeNull()
    expect(stats!.totalCalls).toBe(3)
    expect(stats!.totalInputTokens).toBe(350)
    expect(stats!.totalOutputTokens).toBe(170)
    expect(stats!.avgLatencyMs).toBe(Math.round((1000 + 2000 + 500) / 3))
    expect(stats!.avgQualityScore).toBe(85) // (80+90)/2
    expect(stats!.byStage.content).toBe(2)
    expect(stats!.byStage.preprocess).toBe(1)
  })

  it('비어있으면 0 통계', async () => {
    mockGte.mockResolvedValue({ data: [], error: null })
    const { getGenerationStats } = await import('@/lib/ai/telemetry')
    const stats = await getGenerationStats(7)
    expect(stats!.totalCalls).toBe(0)
    expect(stats!.avgLatencyMs).toBe(0)
    expect(stats!.avgQualityScore).toBeNull()
  })

  it('조회 에러 → null + error log', async () => {
    mockGte.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getGenerationStats } = await import('@/lib/ai/telemetry')
    expect(await getGenerationStats(7)).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
