// T-194 — keyword-generator 테스트 (Anthropic SDK mock).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Anthropic SDK mock — class constructor 형태로 설치
const mockMessagesCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockMessagesCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

// Supabase admin mock — 텔레메트리 조용히 스킵
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => null,
}))

import { generateKeywordsForSector } from '@/lib/blog/keyword-generator'

beforeEach(() => {
  mockMessagesCreate.mockReset()
})

describe('generateKeywordsForSector', () => {
  it('tool_use 출력 → 구조화 반환', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'generate_keywords',
        input: {
          keywords: [
            { keyword: '천안 피부과 여드름', longtails: ['여드름 케어', '피부과 추천'], priority: 3, competition: 'medium' },
            { keyword: '천안 피부과 리프팅', longtails: ['리프팅 가격'], priority: 4, competition: 'low' },
          ],
        },
      }],
      usage: { input_tokens: 200, output_tokens: 300 },
    })

    const r = await generateKeywordsForSector({
      sector: 'medical',
      category: 'dermatology',
      city: 'cheonan',
      cityName: '천안',
      angle: 'review-deepdive',
      count: 2,
      apiKey: 'test',
    })

    expect(r.keywords.length).toBe(2)
    expect(r.keywords[0].keyword).toBe('천안 피부과 여드름')
    expect(r.rejected.length).toBe(0)
    expect(r.tokens.input).toBe(200)
  })

  it('기존 키워드와 Jaccard 0.4+ 는 rejected 로', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'generate_keywords',
        input: {
          keywords: [
            { keyword: '천안 피부과 여드름 치료', longtails: ['a'], priority: 3, competition: 'medium' },
            { keyword: '서울 치과 임플란트', longtails: ['b'], priority: 3, competition: 'medium' },
          ],
        },
      }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const r = await generateKeywordsForSector({
      sector: 'medical',
      angle: 'review-deepdive',
      existingKeywords: ['천안 피부과 여드름 치료법'], // 첫번째와 매우 유사
      apiKey: 'test',
    })

    expect(r.keywords.map(k => k.keyword)).toContain('서울 치과 임플란트')
    expect(r.keywords.map(k => k.keyword)).not.toContain('천안 피부과 여드름 치료')
    expect(r.rejected.some(x => x.reason.startsWith('existing-similar'))).toBe(true)
  })

  it('자체 중복 제거 (self-similar)', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'generate_keywords',
        input: {
          keywords: [
            { keyword: '천안 피부과 여드름 치료', longtails: [], priority: 3, competition: 'medium' },
            { keyword: '천안 피부과 여드름 치료법', longtails: [], priority: 3, competition: 'medium' }, // 거의 같음
            { keyword: '서울 한의원', longtails: [], priority: 3, competition: 'medium' },
          ],
        },
      }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    const r = await generateKeywordsForSector({
      sector: 'medical',
      angle: 'review-deepdive',
      apiKey: 'test',
    })

    expect(r.keywords.length).toBe(2)
    expect(r.rejected.some(x => x.reason === 'self-similar')).toBe(true)
  })

  it('tool_use 블록 없으면 throw', async () => {
    mockMessagesCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no tool call' }],
      usage: { input_tokens: 10, output_tokens: 10 },
    })

    await expect(
      generateKeywordsForSector({ sector: 'medical', angle: 'review-deepdive', apiKey: 'test' }),
    ).rejects.toThrow()
  })
})
