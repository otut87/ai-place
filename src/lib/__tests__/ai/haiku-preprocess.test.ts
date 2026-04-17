/**
 * haiku-preprocess.ts 테스트 (T-023)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate }
    },
  }
})

beforeEach(() => {
  mockCreate.mockReset()
  process.env.ANTHROPIC_API_KEY = 'test-key'
})
afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY
})

const SAMPLE_SUMMARY = {
  commonTreatments: ['여드름 레이저', '리프팅'],
  priceSignals: '리프팅 20-40만원대',
  positiveThemes: ['친절', '효과 좋음'],
  negativeThemes: [],
  uniqueFeatures: ['야간 진료'],
  commonQuestions: ['가격 얼마인가요?'],
}

describe('buildContext', () => {
  it('블로그·카페 섹션 헤더 + 건수 포함', async () => {
    const { buildContext } = await import('@/lib/ai/haiku-preprocess')
    const ctx = buildContext(
      [{ title: '후기', link: 'x', description: '좋았어요', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
      [{ title: '질문', link: 'x', description: '어떤가요?', cafename: '맘카페', cafeurl: 'x', raw: {} }],
    )
    expect(ctx).toContain('네이버 블로그 (1건)')
    expect(ctx).toContain('네이버 카페 (1건)')
    expect(ctx).toContain('좋았어요')
    expect(ctx).toContain('어떤가요?')
  })

  it('빈 카페 입력이면 카페 섹션 생략', async () => {
    const { buildContext } = await import('@/lib/ai/haiku-preprocess')
    const ctx = buildContext(
      [{ title: 't', link: 'x', description: 'd', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
      [],
    )
    expect(ctx).toContain('블로그')
    expect(ctx).not.toContain('카페')
  })
})

describe('preprocessNaverReferences', () => {
  it('블로그·카페 모두 빈 입력 → API 호출 없이 빈 요약', async () => {
    const { preprocessNaverReferences } = await import('@/lib/ai/haiku-preprocess')
    const { summary, telemetry } = await preprocessNaverReferences([], [])
    expect(summary.commonTreatments).toEqual([])
    expect(telemetry).toEqual({ inputTokens: 0, outputTokens: 0, latencyMs: 0 })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('정상 tool_use 응답 파싱 + 스키마 검증', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'summarize_naver_references', input: SAMPLE_SUMMARY }],
      usage: { input_tokens: 1200, output_tokens: 340 },
    })
    const { preprocessNaverReferences } = await import('@/lib/ai/haiku-preprocess')
    const { summary, telemetry } = await preprocessNaverReferences(
      [{ title: 't', link: 'x', description: 'd', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
      [],
    )
    expect(summary.commonTreatments).toEqual(['여드름 레이저', '리프팅'])
    expect(summary.priceSignals).toBe('리프팅 20-40만원대')
    expect(telemetry.inputTokens).toBe(1200)
    expect(telemetry.outputTokens).toBe(340)
    expect(telemetry.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('tool_use 블록 없으면 throw', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'plain text' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const { preprocessNaverReferences } = await import('@/lib/ai/haiku-preprocess')
    await expect(
      preprocessNaverReferences(
        [{ title: 't', link: 'x', description: 'd', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
        [],
      ),
    ).rejects.toThrow(/tool_use/)
  })

  it('tool_choice + model 검증', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'summarize_naver_references', input: SAMPLE_SUMMARY }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const { preprocessNaverReferences } = await import('@/lib/ai/haiku-preprocess')
    await preprocessNaverReferences(
      [{ title: 't', link: 'x', description: 'd', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
      [],
      { businessName: '닥터에버스', category: '피부과' },
    )
    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5-20251001')
    expect(call.tool_choice).toEqual({ type: 'tool', name: 'summarize_naver_references' })
    expect(call.messages[0].content).toContain('닥터에버스')
    expect(call.messages[0].content).toContain('피부과')
  })

  it('부분 필드만 반환되어도 zod default 가 채움', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use', name: 'summarize_naver_references',
        input: { commonTreatments: ['A'] }, // 나머지 필드 누락
      }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const { preprocessNaverReferences } = await import('@/lib/ai/haiku-preprocess')
    const { summary } = await preprocessNaverReferences(
      [{ title: 't', link: 'x', description: 'd', bloggername: 'a', bloggerlink: 'x', postdate: '20260101', raw: {} }],
      [],
    )
    expect(summary.commonTreatments).toEqual(['A'])
    expect(summary.priceSignals).toBe('')
    expect(summary.positiveThemes).toEqual([])
  })
})
