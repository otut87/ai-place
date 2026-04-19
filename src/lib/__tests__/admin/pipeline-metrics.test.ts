import { describe, it, expect, vi, beforeEach } from 'vitest'
import { aggregateLlmRows, API_QUOTAS, MODEL_PRICING_PER_MILLION } from '@/lib/admin/pipeline-metrics'

describe('aggregateLlmRows', () => {
  it('빈 입력 → 0', () => {
    const r = aggregateLlmRows([])
    expect(r.total.calls).toBe(0)
    expect(r.daily).toEqual([])
  })

  it('모델별 단가 적용 + 날짜별 그룹', () => {
    const r = aggregateLlmRows([
      { model: 'claude-sonnet-4-6', input_tokens: 1_000_000, output_tokens: 500_000, created_at: '2026-04-20T00:00:00Z' },
      { model: 'claude-sonnet-4-6', input_tokens: 2_000_000, output_tokens: 1_000_000, created_at: '2026-04-20T10:00:00Z' },
      { model: 'claude-haiku-4-5',  input_tokens: 5_000_000, output_tokens: 1_000_000, created_at: '2026-04-21T00:00:00Z' },
    ])
    expect(r.total.calls).toBe(3)
    expect(r.total.inputTokens).toBe(8_000_000)
    expect(r.total.outputTokens).toBe(2_500_000)
    // sonnet: 3M * $3 + 1.5M * $15 = $9 + $22.5 = $31.5
    // haiku: 5M * $0.8 + 1M * $4 = $4 + $4 = $8
    expect(r.total.usdCost).toBeCloseTo(39.5, 1)
    expect(r.daily).toHaveLength(2)
    expect(r.daily[0].date).toBe('2026-04-20')
    expect(r.daily[0].calls).toBe(2)
  })

  it('가격표에 없는 모델 → 비용 0', () => {
    const r = aggregateLlmRows([
      { model: 'unknown-v99', input_tokens: 10_000, output_tokens: 10_000, created_at: '2026-04-20T00:00:00Z' },
    ])
    expect(r.total.calls).toBe(1)
    expect(r.total.usdCost).toBe(0)
  })

  it('날짜 오름차순 정렬', () => {
    const r = aggregateLlmRows([
      { model: 'gpt-4.1', input_tokens: 100, output_tokens: 100, created_at: '2026-04-22T00:00:00Z' },
      { model: 'gpt-4.1', input_tokens: 100, output_tokens: 100, created_at: '2026-04-20T00:00:00Z' },
    ])
    expect(r.daily.map(d => d.date)).toEqual(['2026-04-20', '2026-04-22'])
  })
})

describe('API_QUOTAS', () => {
  it('5개 소스 정의', () => {
    expect(API_QUOTAS).toHaveLength(5)
    expect(API_QUOTAS.every(q => q.dailyLimit > 0)).toBe(true)
  })
})

describe('MODEL_PRICING_PER_MILLION', () => {
  it('주요 모델 단가', () => {
    expect(MODEL_PRICING_PER_MILLION['claude-sonnet-4-6'].input).toBe(3.0)
    expect(MODEL_PRICING_PER_MILLION['claude-haiku-4-5'].output).toBe(4.0)
  })
})

// ── DB ─────────────────────────────
const mockGte = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockGte.mockReset()
  mockFrom.mockReset()
  mockGte.mockResolvedValue({
    data: [
      { model: 'claude-sonnet-4-6', input_tokens: 1000, output_tokens: 500, created_at: '2026-04-20T00:00:00Z' },
    ],
    error: null,
  })
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({ gte: mockGte })),
  }))
})

describe('getLlmUsage', () => {
  it('admin null → 빈 요약', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getLlmUsage } = await import('@/lib/admin/pipeline-metrics')
    const r = await getLlmUsage()
    expect(r.total.calls).toBe(0)
  })

  it('DB null → 빈 요약', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: null })
    const { getLlmUsage } = await import('@/lib/admin/pipeline-metrics')
    const r = await getLlmUsage()
    expect(r.total.calls).toBe(0)
  })

  it('집계 반영', async () => {
    const { getLlmUsage } = await import('@/lib/admin/pipeline-metrics')
    const r = await getLlmUsage(7)
    expect(r.total.calls).toBe(1)
    expect(r.total.inputTokens).toBe(1000)
  })
})
