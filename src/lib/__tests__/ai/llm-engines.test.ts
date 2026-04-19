// T-140 — LLM 엔진 호출 헬퍼 테스트 (fetch 목킹).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { callChatGPT, callClaude, callGemini, callEngine, isPlaceCited } from '@/lib/ai/llm-engines'

const originalFetch = globalThis.fetch

beforeEach(() => {
  vi.restoreAllMocks()
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

function mockFetchOnce(body: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify(body), { status }),
  ))
}

describe('callChatGPT', () => {
  it('API 키 미설정 시 throw', async () => {
    const prev = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    await expect(callChatGPT('q')).rejects.toThrow(/OPENAI_API_KEY/)
    if (prev) process.env.OPENAI_API_KEY = prev
  })
  it('env 파라미터로 키 주입 → 응답 content 반환', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'hello' } }] })
    const r = await callChatGPT('q', { openaiKey: 'sk-test' })
    expect(r).toBe('hello')
  })
  it('API 에러 → throw', async () => {
    mockFetchOnce({ error: 'bad' }, 500)
    await expect(callChatGPT('q', { openaiKey: 'sk-test' })).rejects.toThrow(/ChatGPT API 500/)
  })
  it('빈 content → 빈 문자열', async () => {
    mockFetchOnce({ choices: [] })
    const r = await callChatGPT('q', { openaiKey: 'sk-test' })
    expect(r).toBe('')
  })
})

describe('callClaude', () => {
  it('키 미설정 throw', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    await expect(callClaude('q')).rejects.toThrow(/ANTHROPIC_API_KEY/)
    if (prev) process.env.ANTHROPIC_API_KEY = prev
  })
  it('text 블록 응답 파싱', async () => {
    mockFetchOnce({ content: [{ type: 'text', text: 'world' }] })
    const r = await callClaude('q', { anthropicKey: 'sk-ant' })
    expect(r).toBe('world')
  })
  it('text 블록 없으면 빈 문자열', async () => {
    mockFetchOnce({ content: [{ type: 'tool_use' }] })
    const r = await callClaude('q', { anthropicKey: 'sk-ant' })
    expect(r).toBe('')
  })
  it('API 에러 throw', async () => {
    mockFetchOnce({}, 401)
    await expect(callClaude('q', { anthropicKey: 'x' })).rejects.toThrow(/Claude API 401/)
  })
})

describe('callGemini', () => {
  it('키 미설정 throw', async () => {
    const prev = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    await expect(callGemini('q', {}, 0)).rejects.toThrow(/GEMINI_API_KEY/)
    if (prev) process.env.GEMINI_API_KEY = prev
  })
  it('parts.text 조합 반환', async () => {
    mockFetchOnce({ candidates: [{ content: { parts: [{ text: 'foo' }, { text: 'bar' }] } }] })
    const r = await callGemini('q', { geminiKey: 'g' }, 0)
    expect(r).toBe('foo\nbar')
  })
  it('비복구 에러 throw', async () => {
    mockFetchOnce({}, 400)
    await expect(callGemini('q', { geminiKey: 'g' }, 0)).rejects.toThrow(/Gemini API 400/)
  })
})

describe('callEngine 디스패치', () => {
  it('엔진별 적절 함수로 라우팅', async () => {
    mockFetchOnce({ choices: [{ message: { content: 'x' } }] })
    const r = await callEngine('chatgpt', 'q', { openaiKey: 'k' })
    expect(r).toBe('x')
  })
})

describe('isPlaceCited', () => {
  it('업체명 포함 → true', () => {
    expect(isPlaceCited('추천: 닥터스킨 클리닉이 유명합니다', '닥터스킨 클리닉')).toBe(true)
  })
  it('미포함 → false', () => {
    expect(isPlaceCited('다른 내용', '닥터스킨')).toBe(false)
  })
  it('빈 이름 → false', () => {
    expect(isPlaceCited('anything', '   ')).toBe(false)
  })
})
