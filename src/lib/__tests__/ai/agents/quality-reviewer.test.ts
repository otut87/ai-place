// T-195 — Quality Reviewer (Haiku) 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

import { reviewQuality } from '@/lib/ai/agents/quality-reviewer'

beforeEach(() => mockCreate.mockReset())

describe('reviewQuality', () => {
  it('tool_use → issues + rewritePatches 구조화', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'review_blog',
        input: {
          issues: ['제목이 30자 미만', 'Direct Answer 짧음'],
          rewritePatches: [
            { block: 'title', instruction: '30자 이상으로 확장' },
            { block: 'summary', instruction: 'Direct Answer 40~80자' },
          ],
        },
      }],
      usage: { input_tokens: 500, output_tokens: 200 },
    })

    const r = await reviewQuality({
      title: 'x', summary: 'y', content: 'z',
      rulesReport: [],
      hardFailures: ['seo.title_length'],
      warnings: [],
      apiKey: 'k',
    })

    expect(r.issues.length).toBe(2)
    expect(r.rewritePatches[0].block).toBe('title')
    expect(r.tokensUsed.input).toBe(500)
  })

  it('tool_use 없으면 throw', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'oops' }],
      usage: { input_tokens: 10, output_tokens: 10 },
    })
    await expect(reviewQuality({
      title: 'x', summary: 'y', content: 'z',
      rulesReport: [], hardFailures: [], warnings: [], apiKey: 'k',
    })).rejects.toThrow()
  })
})
