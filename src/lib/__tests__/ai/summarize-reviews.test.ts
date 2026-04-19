/**
 * Phase 11 — summarize-reviews
 * Haiku 호출은 mocking. upsert + stale 판정은 순수 함수라 직접 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReviewSummary } from '@/lib/types'
import {
  upsertReviewSummary,
  isSummaryStale,
  summarizeReviewsForSource,
} from '@/lib/ai/summarize-reviews'

describe('upsertReviewSummary', () => {
  const existing: ReviewSummary = {
    source: 'Google',
    positiveThemes: ['친절'],
    negativeThemes: [],
    lastChecked: '2026-04-01',
  }

  it('새 소스는 배열에 append', () => {
    const next: ReviewSummary = {
      source: 'Naver',
      positiveThemes: ['깔끔'],
      negativeThemes: [],
      lastChecked: '2026-04-19',
    }
    const result = upsertReviewSummary([existing], next)
    expect(result).toHaveLength(2)
    expect(result[1].source).toBe('Naver')
  })

  it('같은 소스는 교체 (upsert)', () => {
    const next: ReviewSummary = {
      source: 'Google',
      positiveThemes: ['실력'],
      negativeThemes: ['주차'],
      lastChecked: '2026-04-19',
    }
    const result = upsertReviewSummary([existing], next)
    expect(result).toHaveLength(1)
    expect(result[0].positiveThemes).toEqual(['실력'])
    expect(result[0].negativeThemes).toEqual(['주차'])
  })

  it('소스 매칭은 case-insensitive', () => {
    const next: ReviewSummary = {
      source: 'google',
      positiveThemes: ['x'],
      negativeThemes: [],
      lastChecked: '2026-04-19',
    }
    const result = upsertReviewSummary([existing], next)
    expect(result).toHaveLength(1)
  })

  it('기존 배열 undefined 시 배열 생성', () => {
    const next: ReviewSummary = {
      source: 'Kakao',
      positiveThemes: [],
      negativeThemes: [],
      lastChecked: '2026-04-19',
    }
    const result = upsertReviewSummary(undefined, next)
    expect(result).toEqual([next])
  })
})

describe('isSummaryStale', () => {
  const now = new Date('2026-04-19T00:00:00Z')

  it('요약이 없으면 stale', () => {
    expect(isSummaryStale(undefined, 7, now)).toBe(true)
  })

  it('lastChecked 없으면 stale', () => {
    const s = { source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: '' }
    expect(isSummaryStale(s, 7, now)).toBe(true)
  })

  it('7일 이내면 fresh', () => {
    const s = { source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: '2026-04-15' }
    expect(isSummaryStale(s, 7, now)).toBe(false)
  })

  it('7일 초과면 stale', () => {
    const s = { source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: '2026-04-10' }
    expect(isSummaryStale(s, 7, now)).toBe(true)
  })

  it('잘못된 날짜는 stale 로 처리', () => {
    const s = { source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: 'not-a-date' }
    expect(isSummaryStale(s, 7, now)).toBe(true)
  })
})

// Anthropic SDK 전체 mocking — `new Anthropic()` 호출을 위해 constructor 형태.
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn()
  function MockClient(this: { messages: { create: typeof mockCreate } }) {
    this.messages = { create: mockCreate }
  }
  return { default: MockClient, __mockCreate: mockCreate }
})

describe('summarizeReviewsForSource', () => {
  beforeEach(async () => {
    const mod = await import('@anthropic-ai/sdk') as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    mod.__mockCreate.mockReset()
  })

  it('리뷰 0건이면 null 반환 (API 호출 생략)', async () => {
    const result = await summarizeReviewsForSource('Google', [])
    expect(result).toBeNull()
  })

  it('Haiku 응답을 ReviewSummary 로 변환', async () => {
    const mod = await import('@anthropic-ai/sdk') as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    mod.__mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        input: {
          positiveThemes: ['친절한 설명', '빠른 대기'],
          negativeThemes: ['주차 협소'],
          sampleQuote: '설명이 자세하고 대기가 짧다는 후기가 반복됩니다.',
        },
      }],
      usage: { input_tokens: 500, output_tokens: 100 },
    })

    const result = await summarizeReviewsForSource('Google', [
      { text: '친절하고 설명 잘해주심', rating: 5 },
      { text: '주차는 좀 힘들어요', rating: 4 },
    ], { businessName: '수피부과' })

    expect(result).not.toBeNull()
    expect(result!.summary.source).toBe('Google')
    expect(result!.summary.positiveThemes).toEqual(['친절한 설명', '빠른 대기'])
    expect(result!.summary.negativeThemes).toEqual(['주차 협소'])
    expect(result!.summary.sampleQuote).toContain('자세')
    expect(result!.summary.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result!.inputTokens).toBe(500)
  })

  it('tool_use 블록 없으면 에러 throw', async () => {
    const mod = await import('@anthropic-ai/sdk') as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    mod.__mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'no tool call' }],
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    await expect(
      summarizeReviewsForSource('Google', [{ text: 'x', rating: 5 }]),
    ).rejects.toThrow('tool_use')
  })

  it('빈 sampleQuote 는 undefined 로 정규화', async () => {
    const mod = await import('@anthropic-ai/sdk') as unknown as { __mockCreate: ReturnType<typeof vi.fn> }
    mod.__mockCreate.mockResolvedValue({
      content: [{
        type: 'tool_use',
        input: { positiveThemes: ['a'], negativeThemes: [], sampleQuote: '   ' },
      }],
      usage: { input_tokens: 100, output_tokens: 50 },
    })

    const result = await summarizeReviewsForSource('Google', [{ text: 'x', rating: 5 }])
    expect(result!.summary.sampleQuote).toBeUndefined()
  })
})
