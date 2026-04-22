// T-195 — Writer 에이전트 (Sonnet) 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Place } from '@/lib/types'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

import { writeBlog } from '@/lib/ai/agents/writer'

beforeEach(() => mockCreate.mockReset())

function mkPlace(slug: string): Place {
  return {
    slug, name: slug, city: 'cheonan', category: 'dermatology',
    description: '', address: '천안시 동남구', services: [], faqs: [], tags: [],
    rating: 4.5, reviewCount: 50,
  }
}

const baseDraft = {
  title: '천안 피부과 추천 제목 30자 넘는 제목 입니다.',
  summary: '천안에서 피부과를 찾는 독자를 위한 중립 서술 요약문 60자 분량.',
  content: '## 결론\n본문\n## 분석 방법\n본문',
  tags: ['천안 피부과'],
  faqs: [{ question: 'q1', answer: 'a1' }, { question: 'q2', answer: 'a2' }, { question: 'q3', answer: 'a3' }],
}

describe('writeBlog', () => {
  it('verifiedPlaces + externalReferences 둘 다 비면 throw', async () => {
    await expect(writeBlog({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive', targetQuery: '천안 피부과',
      verifiedPlaces: [], externalReferences: [],
      apiKey: 'k',
    })).rejects.toThrow(/verifiedPlaces/)
  })

  it('tool_use 응답 → 구조화 WriterOutput 반환', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: baseDraft }],
      usage: { input_tokens: 2000, output_tokens: 1500 },
    })

    const r = await writeBlog({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive', targetQuery: '천안 피부과',
      verifiedPlaces: [mkPlace('a'), mkPlace('b')], externalReferences: [],
      apiKey: 'k',
    })

    expect(r.title).toBe(baseDraft.title)
    expect(r.tokensUsed.input).toBe(2000)
    expect(r.faqs.length).toBe(3)
  })

  it('rewritePatches 가 있으면 프롬프트에 반영되어 호출', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', name: 'generate_blog', input: baseDraft }],
      usage: { input_tokens: 100, output_tokens: 100 },
    })

    await writeBlog({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive', targetQuery: '천안 피부과',
      verifiedPlaces: [mkPlace('a')], externalReferences: [],
      previousDraft: { ...baseDraft, tokensUsed: { input: 0, output: 0 }, latencyMs: 0 },
      rewritePatches: [{ block: '결론', instruction: '40자로 축약' }],
      apiKey: 'k',
    })

    const call = mockCreate.mock.calls[0][0]
    const userMsg = call.messages[0].content as string
    expect(userMsg).toContain('재작성 지시')
    expect(userMsg).toContain('40자로 축약')
  })

  it('tool_use 없으면 throw', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'no tool' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    await expect(writeBlog({
      city: 'cheonan', cityName: '천안시',
      category: 'dermatology', categoryName: '피부과', sector: 'medical',
      postType: 'detail', angle: 'review-deepdive', targetQuery: '천안 피부과',
      verifiedPlaces: [mkPlace('a')], externalReferences: [],
      apiKey: 'k',
    })).rejects.toThrow(/tool_use/)
  })
})
