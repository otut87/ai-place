/**
 * llm-detector.ts 테스트 (T-015 Tier 3)
 * Anthropic SDK mock 으로 주요 분기만 검증 (가드/파싱/슬러그 검증).
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

describe('detectCategoryViaLLM', () => {
  it('ANTHROPIC_API_KEY 없으면 null', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { detectCategoryViaLLM } = await import('@/lib/classification/llm-detector')
    const result = await detectCategoryViaLLM({
      name: '테스트', availableSlugs: ['dermatology'],
    })
    expect(result).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('정상 JSON 파싱 + 슬러그 검증', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"category":"dermatology","confidence":0.9}' }],
    })
    const { detectCategoryViaLLM } = await import('@/lib/classification/llm-detector')
    const result = await detectCategoryViaLLM({
      name: '차앤박', availableSlugs: ['dermatology', 'dental'],
    })
    expect(result).toEqual({ category: 'dermatology', confidence: 0.9 })
  })

  it('LLM 반환 슬러그가 availableSlugs 에 없으면 null', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{"category":"unknown-slug","confidence":0.9}' }],
    })
    const { detectCategoryViaLLM } = await import('@/lib/classification/llm-detector')
    const result = await detectCategoryViaLLM({
      name: '이상한', availableSlugs: ['dermatology'],
    })
    expect(result).toBeNull()
  })

  it('JSON 파싱 불가 → null', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'just plain text no json' }],
    })
    const { detectCategoryViaLLM } = await import('@/lib/classification/llm-detector')
    const result = await detectCategoryViaLLM({
      name: 'X', availableSlugs: ['dermatology'],
    })
    expect(result).toBeNull()
  })

  it('API 호출 실패 → null', async () => {
    mockCreate.mockRejectedValue(new Error('rate limit'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { detectCategoryViaLLM } = await import('@/lib/classification/llm-detector')
    const result = await detectCategoryViaLLM({
      name: 'X', availableSlugs: ['dermatology'],
    })
    expect(result).toBeNull()
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})
