// T-056 — citation_results 집계 라이브러리.
// scripts/baseline-test.ts 가 주기적으로 쌓은 데이터를
// 어드민 대시보드에 적합한 형태로 요약.

export type AIEngine = 'chatgpt' | 'claude' | 'gemini'

export interface CitationRow {
  id: string
  // 001 스키마: uuid FK → test_prompts.id
  prompt_id: string
  engine: AIEngine
  // 001 스키마: NOT NULL
  session_id: string
  response: string
  cited_sources: string[]
  cited_places: string[]
  aiplace_cited: boolean
  tested_at: string // ISO 8601
}

export interface EngineSummary {
  total: number
  cited: number
  rate: number
}

export type EngineSummaryMap = Record<AIEngine, EngineSummary>

function emptyMap(): EngineSummaryMap {
  return {
    chatgpt: { total: 0, cited: 0, rate: 0 },
    claude: { total: 0, cited: 0, rate: 0 },
    gemini: { total: 0, cited: 0, rate: 0 },
  }
}

function finalize(map: EngineSummaryMap): EngineSummaryMap {
  for (const key of Object.keys(map) as AIEngine[]) {
    const s = map[key]
    s.rate = s.total > 0 ? s.cited / s.total : 0
  }
  return map
}

/** 엔진별 총 실행 횟수 / 인용 횟수 / 인용률. */
export function summarizeByEngine(rows: CitationRow[]): EngineSummaryMap {
  const out = emptyMap()
  for (const r of rows) {
    if (!(r.engine in out)) continue
    out[r.engine].total += 1
    if (r.aiplace_cited) out[r.engine].cited += 1
  }
  return finalize(out)
}

/** promptId × engine 별 집계. */
export function summarizeByPrompt(rows: CitationRow[]): Map<string, EngineSummaryMap> {
  const map = new Map<string, EngineSummaryMap>()
  for (const r of rows) {
    if (!map.has(r.prompt_id)) map.set(r.prompt_id, emptyMap())
    const sub = map.get(r.prompt_id)!
    if (!(r.engine in sub)) continue
    sub[r.engine].total += 1
    if (r.aiplace_cited) sub[r.engine].cited += 1
  }
  for (const sub of map.values()) finalize(sub)
  return map
}

/** 언급된 업체명 등장 빈도 순. */
export function topCitedPlaces(rows: CitationRow[], limit = 20): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    for (const name of r.cited_places) {
      const n = name.trim()
      if (!n) continue
      counts.set(n, (counts.get(n) ?? 0) + 1)
    }
  }
  return Array.from(counts, ([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** 일자별(UTC) 인용률 추이 — 그래프용. */
export function summarizeTrend(rows: CitationRow[]): Array<{ date: string; total: number; cited: number; rate: number }> {
  const byDate = new Map<string, { total: number; cited: number }>()
  for (const r of rows) {
    const date = r.tested_at.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, { total: 0, cited: 0 })
    const agg = byDate.get(date)!
    agg.total += 1
    if (r.aiplace_cited) agg.cited += 1
  }
  return Array.from(byDate, ([date, v]) => ({
    date,
    total: v.total,
    cited: v.cited,
    rate: v.total > 0 ? v.cited / v.total : 0,
  })).sort((a, b) => a.date.localeCompare(b.date))
}
