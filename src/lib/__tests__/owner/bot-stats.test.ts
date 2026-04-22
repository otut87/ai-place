import { describe, it, expect } from 'vitest'
import {
  aggregateOwnerBotSummary,
  aggregateOwnerDailyTrend,
  mapBotToEngine,
  type AnnotatedVisit,
} from '@/lib/owner/bot-stats'

describe('mapBotToEngine', () => {
  it('ai-search 엔진 매핑', () => {
    expect(mapBotToEngine('chatgpt-user', 'ai-search')).toBe('chatgpt')
    expect(mapBotToEngine('oai-searchbot', 'ai-search')).toBe('chatgpt')
    expect(mapBotToEngine('claude-web', 'ai-search')).toBe('claude')
    expect(mapBotToEngine('perplexitybot', 'ai-search')).toBe('perplexity')
    expect(mapBotToEngine('perplexity-user', 'ai-search')).toBe('perplexity')
    expect(mapBotToEngine('youbot', 'ai-search')).toBe('other')
    expect(mapBotToEngine('duckassistbot', 'ai-search')).toBe('other')
  })

  it('ai-training 엔진 매핑', () => {
    expect(mapBotToEngine('gptbot', 'ai-training')).toBe('chatgpt')
    expect(mapBotToEngine('claudebot', 'ai-training')).toBe('claude')
    expect(mapBotToEngine('anthropic-ai', 'ai-training')).toBe('claude')
    expect(mapBotToEngine('google-extended', 'ai-training')).toBe('gemini')
    expect(mapBotToEngine('ccbot', 'ai-training')).toBe('other')
    expect(mapBotToEngine('bytespider', 'ai-training')).toBe('other')
  })

  it('알 수 없는 bot_id → other', () => {
    expect(mapBotToEngine('unknown-bot', 'ai-search')).toBe('other')
    expect(mapBotToEngine('unknown-bot', 'ai-training')).toBe('other')
  })

  it('search/crawler-other 그룹 → other', () => {
    expect(mapBotToEngine('googlebot', 'search')).toBe('other')
    expect(mapBotToEngine('diffbot', 'crawler-other')).toBe('other')
  })
})

describe('aggregateOwnerBotSummary', () => {
  const placeIds = ['p1']
  const since = '2026-03-23T00:00:00Z'
  const days = 30

  function run(rows: AnnotatedVisit[]) {
    return aggregateOwnerBotSummary(rows, placeIds, days, since)
  }

  it('빈 입력 → 모든 버킷 0', () => {
    const s = run([])
    expect(s.aiSearch.total).toBe(0)
    expect(s.aiSearch.direct).toBe(0)
    expect(s.aiSearch.mention).toBe(0)
    expect(s.aiSearch.byEngine).toEqual({ chatgpt: 0, claude: 0, perplexity: 0, other: 0 })
    expect(s.aiSearch.lastVisitAt).toBeNull()
    expect(s.aiTraining.total).toBe(0)
    expect(s.aiTraining.byEngine).toEqual({ chatgpt: 0, claude: 0, gemini: 0, other: 0 })
  })

  it('직접/언급 분리 — place=direct, blog/compare/guide/keyword=mention', () => {
    const rows: AnnotatedVisit[] = [
      { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-21T10:00:00Z' },
      { botId: 'claude-web', pageType: 'blog', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'perplexitybot', pageType: 'compare', visitedAt: '2026-04-19T10:00:00Z' },
      { botId: 'chatgpt-user', pageType: 'guide', visitedAt: '2026-04-18T10:00:00Z' },
      { botId: 'claude-web', pageType: 'keyword', visitedAt: '2026-04-17T10:00:00Z' },
    ]
    const s = run(rows)
    expect(s.aiSearch.total).toBe(5)
    expect(s.aiSearch.direct).toBe(1)
    expect(s.aiSearch.mention).toBe(4)
  })

  it('엔진별 카운트', () => {
    const rows: AnnotatedVisit[] = [
      { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'oai-searchbot', pageType: 'place', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'claude-web', pageType: 'place', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'perplexitybot', pageType: 'blog', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'perplexity-user', pageType: 'blog', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'duckassistbot', pageType: 'blog', visitedAt: '2026-04-20T10:00:00Z' },
    ]
    const s = run(rows)
    expect(s.aiSearch.byEngine.chatgpt).toBe(2)
    expect(s.aiSearch.byEngine.claude).toBe(1)
    expect(s.aiSearch.byEngine.perplexity).toBe(2)
    expect(s.aiSearch.byEngine.other).toBe(1)
  })

  it('ai-training — Gemini (Google-Extended) 포함', () => {
    const rows: AnnotatedVisit[] = [
      { botId: 'gptbot', pageType: 'place', visitedAt: '2026-04-20T09:00:00Z' },
      { botId: 'claudebot', pageType: 'blog', visitedAt: '2026-04-21T09:00:00Z' },
      { botId: 'anthropic-ai', pageType: 'blog', visitedAt: '2026-04-21T10:00:00Z' },
      { botId: 'google-extended', pageType: 'blog', visitedAt: '2026-04-22T09:00:00Z' },
      { botId: 'ccbot', pageType: 'blog', visitedAt: '2026-04-20T09:00:00Z' },
    ]
    const s = run(rows)
    expect(s.aiTraining.total).toBe(5)
    expect(s.aiTraining.byEngine.chatgpt).toBe(1)
    expect(s.aiTraining.byEngine.claude).toBe(2)
    expect(s.aiTraining.byEngine.gemini).toBe(1)
    expect(s.aiTraining.byEngine.other).toBe(1)
    expect(s.aiTraining.direct).toBe(1)
    expect(s.aiTraining.mention).toBe(4)
  })

  it('search / crawler-other 그룹은 집계에서 제외', () => {
    const rows: AnnotatedVisit[] = [
      { botId: 'googlebot', pageType: 'place', visitedAt: '2026-04-20T09:00:00Z' },
      { botId: 'diffbot', pageType: 'blog', visitedAt: '2026-04-20T10:00:00Z' },
      { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-20T11:00:00Z' },
    ]
    const s = run(rows)
    expect(s.aiSearch.total).toBe(1)
    expect(s.aiTraining.total).toBe(0)
  })

  it('lastVisitAt — 가장 최근 시각', () => {
    const rows: AnnotatedVisit[] = [
      { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-15T09:00:00Z' },
      { botId: 'claude-web', pageType: 'blog', visitedAt: '2026-04-22T11:30:00Z' },
      { botId: 'perplexitybot', pageType: 'blog', visitedAt: '2026-04-18T14:00:00Z' },
    ]
    const s = run(rows)
    expect(s.aiSearch.lastVisitAt).toBe('2026-04-22T11:30:00Z')
  })

  it('output 전체 shape — placeIds/periodDays/since 유지', () => {
    const s = run([])
    expect(s.placeIds).toEqual(placeIds)
    expect(s.periodDays).toBe(days)
    expect(s.since).toBe(since)
  })
})

describe('aggregateOwnerDailyTrend', () => {
  // KST 2026-04-22 09:00 기준 = UTC 2026-04-22 00:00.
  const NOW = new Date('2026-04-22T00:00:00Z')

  it('빈 입력 → N개 날짜 버킷 모두 0', () => {
    const rows = aggregateOwnerDailyTrend([], 7, NOW)
    expect(rows).toHaveLength(7)
    expect(rows[0].total).toBe(0)
    expect(rows[6].total).toBe(0)
    // 각 버킷의 engine 맵은 4개 키를 가져야 함.
    expect(Object.keys(rows[0].aiSearch).sort()).toEqual(['chatgpt', 'claude', 'other', 'perplexity'])
    expect(Object.keys(rows[0].aiTraining).sort()).toEqual(['chatgpt', 'claude', 'gemini', 'other'])
  })

  it('날짜 버킷 순서 — 오래된 날짜 먼저, 오늘 마지막', () => {
    const rows = aggregateOwnerDailyTrend([], 3, NOW)
    // 3일이면 today-2, today-1, today 순.
    expect(rows).toHaveLength(3)
    expect(rows[0].date < rows[1].date).toBe(true)
    expect(rows[1].date < rows[2].date).toBe(true)
  })

  it('방문을 해당 날짜 엔진 버킷에 귀속', () => {
    // 2026-04-22 03:00 UTC = 2026-04-22 12:00 KST
    const rows = aggregateOwnerDailyTrend(
      [
        { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-22T03:00:00Z' },
        { botId: 'claude-web', pageType: 'blog', visitedAt: '2026-04-22T04:00:00Z' },
        { botId: 'gptbot', pageType: 'place', visitedAt: '2026-04-22T05:00:00Z' },
        { botId: 'google-extended', pageType: 'blog', visitedAt: '2026-04-22T06:00:00Z' },
      ],
      7, NOW,
    )
    const today = rows[rows.length - 1]
    expect(today.aiSearch.chatgpt).toBe(1)
    expect(today.aiSearch.claude).toBe(1)
    expect(today.aiTraining.chatgpt).toBe(1)
    expect(today.aiTraining.gemini).toBe(1)
    expect(today.total).toBe(4)
  })

  it('window 밖 날짜는 drop', () => {
    const rows = aggregateOwnerDailyTrend(
      [
        { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-01T00:00:00Z' },  // 21일 전
        { botId: 'claude-web',   pageType: 'place', visitedAt: '2026-04-22T03:00:00Z' },  // 오늘
      ],
      7, NOW,
    )
    // 21일 전 방문은 드랍, 오늘만 1건
    const totals = rows.reduce((s, r) => s + r.total, 0)
    expect(totals).toBe(1)
  })

  it('search / crawler-other 그룹은 추이에서 제외', () => {
    const rows = aggregateOwnerDailyTrend(
      [
        { botId: 'googlebot', pageType: 'place', visitedAt: '2026-04-22T03:00:00Z' },
        { botId: 'chatgpt-user', pageType: 'place', visitedAt: '2026-04-22T03:00:00Z' },
      ],
      7, NOW,
    )
    const today = rows[rows.length - 1]
    expect(today.total).toBe(1)
    expect(today.aiSearch.chatgpt).toBe(1)
  })
})
