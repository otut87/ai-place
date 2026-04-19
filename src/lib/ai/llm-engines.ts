// T-140 — 3개 LLM 엔진 호출 헬퍼 (baseline-test.ts 로직 재사용용).
// OpenAI GPT-4o (web search), Claude Sonnet, Gemini 2.5 Flash.

export type Engine = 'chatgpt' | 'claude' | 'gemini'

export interface EngineEnv {
  openaiKey?: string
  anthropicKey?: string
  geminiKey?: string
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

export async function callChatGPT(prompt: string, env: EngineEnv = {}): Promise<string> {
  const key = env.openaiKey ?? process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY 미설정')
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-search-preview',
      messages: [{ role: 'user', content: prompt }],
      web_search_options: { search_context_size: 'medium' },
    }),
  })
  if (!res.ok) throw new Error(`ChatGPT API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

export async function callClaude(prompt: string, env: EngineEnv = {}): Promise<string> {
  const key = env.anthropicKey ?? process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY 미설정')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const textBlock = data.content?.find((b: { type: string }) => b.type === 'text')
  return textBlock?.text ?? ''
}

export async function callGemini(prompt: string, env: EngineEnv = {}, retries = 2): Promise<string> {
  const key = env.geminiKey ?? process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY 미설정')
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
        }),
      },
    )
    if (res.ok) {
      const data = await res.json()
      const parts = data.candidates?.[0]?.content?.parts ?? []
      return parts.map((p: { text?: string }) => p.text ?? '').join('\n')
    }
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      await sleep(Math.min(10000 * (attempt + 1), 30000))
      continue
    }
    throw new Error(`Gemini API ${res.status}: ${await res.text()}`)
  }
  throw new Error('Gemini: max retries exceeded')
}

export async function callEngine(engine: Engine, prompt: string, env?: EngineEnv): Promise<string> {
  switch (engine) {
    case 'chatgpt': return callChatGPT(prompt, env)
    case 'claude': return callClaude(prompt, env)
    case 'gemini': return callGemini(prompt, env)
  }
}

/** 업체명이 응답 텍스트에 포함되는지 확인 (부분 일치). */
export function isPlaceCited(response: string, placeName: string): boolean {
  const n = placeName.trim()
  if (!n) return false
  return response.includes(n)
}
