// T-089 — 파이프라인 LLM 토큰·비용 집계 + API 쿼터 표시.
// ai_generations(013) 만 재사용. 새 테이블 금지.

import { getAdminClient } from '@/lib/supabase/admin-client'

// Claude / OpenAI / Gemini 대표 단가 (USD per 1M tokens). 실 모델별 단가는 참고용.
export const MODEL_PRICING_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5':  { input: 0.8,  output: 4.0  },
  'claude-opus-4-7':   { input: 15.0, output: 75.0 },
  'gpt-4.1-mini':      { input: 0.4,  output: 1.6  },
  'gpt-4.1':           { input: 2.5,  output: 10.0 },
  'gemini-2.5-pro':    { input: 1.25, output: 10.0 },
}

export interface LlmDailyRow {
  date: string              // 'YYYY-MM-DD'
  calls: number
  inputTokens: number
  outputTokens: number
  usdCost: number
}

export interface LlmUsageSummary {
  daily: LlmDailyRow[]
  total: {
    calls: number
    inputTokens: number
    outputTokens: number
    usdCost: number
  }
}

export async function getLlmUsage(days = 7): Promise<LlmUsageSummary> {
  const admin = getAdminClient()
  if (!admin) return emptySummary()

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('ai_generations')
    .select('model, input_tokens, output_tokens, created_at')
    .gte('created_at', since)
  if (!data) return emptySummary()

  const rows = data as Array<{ model: string; input_tokens: number; output_tokens: number; created_at: string }>
  return aggregateLlmRows(rows)
}

export function aggregateLlmRows(rows: Array<{ model: string; input_tokens: number; output_tokens: number; created_at: string }>): LlmUsageSummary {
  const byDate = new Map<string, LlmDailyRow>()
  let totalCalls = 0, totalIn = 0, totalOut = 0, totalCost = 0

  for (const r of rows) {
    const date = r.created_at.slice(0, 10)
    const entry = byDate.get(date) ?? { date, calls: 0, inputTokens: 0, outputTokens: 0, usdCost: 0 }
    const price = MODEL_PRICING_PER_MILLION[r.model]
    const cost = price
      ? (r.input_tokens * price.input + r.output_tokens * price.output) / 1_000_000
      : 0
    entry.calls += 1
    entry.inputTokens += r.input_tokens
    entry.outputTokens += r.output_tokens
    entry.usdCost += cost
    byDate.set(date, entry)
    totalCalls += 1
    totalIn += r.input_tokens
    totalOut += r.output_tokens
    totalCost += cost
  }

  const daily = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
  return {
    daily,
    total: { calls: totalCalls, inputTokens: totalIn, outputTokens: totalOut, usdCost: totalCost },
  }
}

/** 외부 수집 API 쿼터 — 하드코딩 상한 (실 쿼터는 대시보드·콘솔 확인). */
export interface ApiQuotaRow {
  name: string
  dailyLimit: number            // 일일 하드 상한 (레퍼런스)
  envVar: string                // 키 env 변수명
}

export const API_QUOTAS: ApiQuotaRow[] = [
  { name: '네이버 지역검색', dailyLimit: 25_000,  envVar: 'NAVER_CLIENT_ID' },
  { name: '네이버 블로그',   dailyLimit: 25_000,  envVar: 'NAVER_CLIENT_ID' },
  { name: '네이버 카페',     dailyLimit: 25_000,  envVar: 'NAVER_CLIENT_ID' },
  { name: '카카오 Local',    dailyLimit: 100_000, envVar: 'KAKAO_REST_KEY' },
  { name: 'Google Places',   dailyLimit: 10_000,  envVar: 'GOOGLE_PLACES_API_KEY' },
]

function emptySummary(): LlmUsageSummary {
  return { daily: [], total: { calls: 0, inputTokens: 0, outputTokens: 0, usdCost: 0 } }
}
