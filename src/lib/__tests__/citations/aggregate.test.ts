import { describe, it, expect } from 'vitest'
import {
  summarizeByEngine,
  summarizeByPrompt,
  topCitedPlaces,
  summarizeTrend,
  type CitationRow,
} from '@/lib/citations/aggregate'

function row(over: Partial<CitationRow> = {}): CitationRow {
  return {
    id: 'x',
    prompt_id: 'cheonan-dermatology',
    engine: 'chatgpt',
    session_id: 'run-test',
    response: '',
    cited_sources: [],
    cited_places: [],
    aiplace_cited: false,
    tested_at: '2026-04-10T00:00:00Z',
    ...over,
  }
}

describe('summarizeByEngine', () => {
  it('엔진별 총·인용·비율 집계', () => {
    const rows: CitationRow[] = [
      row({ engine: 'chatgpt', aiplace_cited: true }),
      row({ engine: 'chatgpt', aiplace_cited: false }),
      row({ engine: 'claude', aiplace_cited: true }),
      row({ engine: 'claude', aiplace_cited: true }),
      row({ engine: 'gemini', aiplace_cited: false }),
    ]
    const s = summarizeByEngine(rows)
    expect(s.chatgpt.total).toBe(2)
    expect(s.chatgpt.cited).toBe(1)
    expect(s.chatgpt.rate).toBeCloseTo(0.5, 2)
    expect(s.claude.rate).toBeCloseTo(1.0, 2)
    expect(s.gemini.rate).toBeCloseTo(0.0, 2)
  })

  it('총 0건 → rate 0', () => {
    const s = summarizeByEngine([])
    expect(s.chatgpt.rate).toBe(0)
    expect(s.claude.total).toBe(0)
  })
})

describe('summarizeByPrompt', () => {
  it('promptId × engine 별 rate 맵 생성', () => {
    const rows: CitationRow[] = [
      row({ prompt_id: 'A', engine: 'chatgpt', aiplace_cited: true }),
      row({ prompt_id: 'A', engine: 'chatgpt', aiplace_cited: false }),
      row({ prompt_id: 'A', engine: 'claude', aiplace_cited: true }),
      row({ prompt_id: 'B', engine: 'chatgpt', aiplace_cited: false }),
    ]
    const s = summarizeByPrompt(rows)
    expect(s.get('A')?.chatgpt.total).toBe(2)
    expect(s.get('A')?.chatgpt.cited).toBe(1)
    expect(s.get('A')?.claude.cited).toBe(1)
    expect(s.get('B')?.chatgpt.cited).toBe(0)
  })
})

describe('topCitedPlaces', () => {
  it('언급 빈도 순 정렬', () => {
    const rows: CitationRow[] = [
      row({ cited_places: ['닥터에버스', '디두'] }),
      row({ cited_places: ['닥터에버스'] }),
      row({ cited_places: ['디두', '단비'] }),
      row({ cited_places: ['닥터에버스'] }),
    ]
    const top = topCitedPlaces(rows, 10)
    expect(top[0].name).toBe('닥터에버스')
    expect(top[0].count).toBe(3)
    expect(top[1].name).toBe('디두')
    expect(top[1].count).toBe(2)
  })

  it('제한 개수 준수', () => {
    const rows: CitationRow[] = Array.from({ length: 20 }, (_, i) => row({ cited_places: [`p${i}`] }))
    const top = topCitedPlaces(rows, 5)
    expect(top).toHaveLength(5)
  })
})

describe('summarizeTrend', () => {
  it('일자별 인용률 추이', () => {
    const rows: CitationRow[] = [
      row({ tested_at: '2026-04-10T01:00:00Z', aiplace_cited: true }),
      row({ tested_at: '2026-04-10T02:00:00Z', aiplace_cited: false }),
      row({ tested_at: '2026-04-11T01:00:00Z', aiplace_cited: true }),
      row({ tested_at: '2026-04-11T02:00:00Z', aiplace_cited: true }),
    ]
    const t = summarizeTrend(rows)
    expect(t).toHaveLength(2)
    const apr10 = t.find(x => x.date === '2026-04-10')
    expect(apr10?.rate).toBeCloseTo(0.5, 2)
    const apr11 = t.find(x => x.date === '2026-04-11')
    expect(apr11?.rate).toBeCloseTo(1.0, 2)
  })

  it('빈 배열 → 빈 추이', () => {
    expect(summarizeTrend([])).toEqual([])
  })

  it('날짜 정렬 (오름차순)', () => {
    const rows: CitationRow[] = [
      row({ tested_at: '2026-04-15T01:00:00Z' }),
      row({ tested_at: '2026-04-10T01:00:00Z' }),
      row({ tested_at: '2026-04-12T01:00:00Z' }),
    ]
    const t = summarizeTrend(rows)
    expect(t.map(x => x.date)).toEqual(['2026-04-10', '2026-04-12', '2026-04-15'])
  })
})
