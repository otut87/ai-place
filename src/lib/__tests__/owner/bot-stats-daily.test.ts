/**
 * bot-stats-daily.ts 테스트 (T-264 + T-265)
 *
 * 053 일별 사전집계 reader 검증:
 * - placeIds 빈 배열 → empty bucket / empty trend
 * - snapshot RPC + today RPC 정상 merge
 * - direct (page_type=detail) vs mention 분류
 * - DB 미가용 fallback
 *
 * T-265: snapshot fetch 도 RPC (owner_bot_visits_daily_select) 로 변경 — PostgREST
 * 1000-row cap 페이지네이션 제거. listOwnerBotVisitsDaily 도 054 RPC 사용.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// RPC 이름별로 분기 — bot_visits_today_owner / owner_recent_bot_visits.
// T-271: snapshot 은 RPC 가 아닌 raw select (.from().select().in().gte().lte().range()).
const rpcResponses: Record<string, { data: unknown; error: unknown }> = {
  bot_visits_today_owner: { data: [], error: null },
  owner_recent_bot_visits: { data: [], error: null },
}

const mockRpc = vi.fn(async (name: string) => {
  return rpcResponses[name] ?? { data: [], error: null }
})

// Snapshot raw select mock — range() 호출 시 페이지네이션 결과 반환.
let snapshotRawData: unknown[] = []
let snapshotRawError: { message: string } | null = null
const mockSnapshotRange = vi.fn((from: number, to: number) => {
  if (snapshotRawError) return Promise.resolve({ data: null, error: snapshotRawError })
  return Promise.resolve({ data: snapshotRawData.slice(from, to + 1), error: null })
})

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({
    rpc: mockRpc,
    from: vi.fn(() => ({
      select: () => ({
        in: () => ({
          gte: () => ({
            lte: () => ({
              range: mockSnapshotRange,
            }),
          }),
        }),
      }),
    })),
  })),
}))

beforeEach(() => {
  rpcResponses.bot_visits_today_owner = { data: [], error: null }
  rpcResponses.owner_recent_bot_visits = { data: [], error: null }
  snapshotRawData = []
  snapshotRawError = null
  mockRpc.mockClear()
  mockSnapshotRange.mockClear()
})

describe('getOwnerBotSummaryDaily', () => {
  it('placeIds 빈 배열 → 빈 bucket', async () => {
    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily([], 30, new Date('2026-05-06T12:00:00Z'))
    expect(r.aiSearch.total).toBe(0)
    expect(r.aiTraining.total).toBe(0)
    expect(r.placeIds).toEqual([])
  })

  it('snapshot rows + today RPC 누적 — direct(detail)/mention 분류 + 엔진 매핑', async () => {
    snapshotRawData = [
      // 어제까지 사전집계: GPTBot detail 5회, ClaudeBot blog 3회
      { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 5, last_visited_at: '2026-05-05T10:00:00Z' },
      { date: '2026-05-05', place_id: 'p1', bot_id: 'claudebot', page_type: 'blog', visits: 3, last_visited_at: '2026-05-05T11:00:00Z' },
    ]
    rpcResponses.bot_visits_today_owner = {
      data: [
        // 오늘 RPC: ChatGPT-User detail 2회, PerplexityBot compare 1회
        { place_id: 'p1', bot_id: 'chatgpt-user', page_type: 'detail', visits: 2, last_visited_at: '2026-05-06T09:00:00Z' },
        { place_id: 'p1', bot_id: 'perplexitybot', page_type: 'compare', visits: 1, last_visited_at: '2026-05-06T10:00:00Z' },
      ],
      error: null,
    }

    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))

    expect(r.aiTraining.total).toBe(8)
    expect(r.aiTraining.direct).toBe(5)
    expect(r.aiTraining.mention).toBe(3)
    expect(r.aiTraining.byEngine.chatgpt).toBe(5)
    expect(r.aiTraining.byEngine.claude).toBe(3)

    expect(r.aiSearch.total).toBe(3)
    expect(r.aiSearch.direct).toBe(2)
    expect(r.aiSearch.mention).toBe(1)
    expect(r.aiSearch.byEngine.chatgpt).toBe(2)
    expect(r.aiSearch.byEngine.perplexity).toBe(1)
  })

  it('snapshot raw 에러 → 빈 bucket fallback', async () => {
    snapshotRawError = { message: 'down' }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))
    expect(r.aiSearch.total).toBe(0)
    expect(r.aiTraining.total).toBe(0)
    consoleSpy.mockRestore()
  })

  it('미식별 bot_id 는 무시 (fallback 안 함)', async () => {
    snapshotRawData = [
      { date: '2026-05-05', place_id: 'p1', bot_id: 'unknown-bot', page_type: 'detail', visits: 100, last_visited_at: null },
    ]

    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))
    expect(r.aiSearch.total).toBe(0)
    expect(r.aiTraining.total).toBe(0)
    void snapshotRawError  // suppress unused var lint
  })
})

describe('getOwnerDailyTrendDaily', () => {
  it('placeIds 빈 → 0 으로 채워진 trend (윈도우 일자 모두 포함)', async () => {
    const { getOwnerDailyTrendDaily } = await import('@/lib/owner/bot-stats-daily')
    const rows = await getOwnerDailyTrendDaily([], 7, new Date('2026-05-06T12:00:00Z'))
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row.total).toBe(0)
    }
  })

  it('snapshot 일자별 누적 + today RPC 는 today key 로 집계', async () => {
    snapshotRawData = [
      { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 4, last_visited_at: null },
      { date: '2026-05-04', place_id: 'p1', bot_id: 'claudebot', page_type: 'detail', visits: 2, last_visited_at: null },
    ]
    rpcResponses.bot_visits_today_owner = {
      data: [
        { place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 7, last_visited_at: null },
      ],
      error: null,
    }

    const { getOwnerDailyTrendDaily } = await import('@/lib/owner/bot-stats-daily')
    const rows = await getOwnerDailyTrendDaily(['p1'], 7, new Date('2026-05-06T12:00:00Z'))
    expect(rows).toHaveLength(7)
    const total = rows.reduce((s, r) => s + r.total, 0)
    expect(total).toBe(13)
    const today = rows[rows.length - 1]
    expect(today.total).toBe(7)
    expect(today.aiTraining.chatgpt).toBe(7)
  })
})

describe('fetchOwnerStatsBundle (T-269)', () => {
  it('placeIds 빈 배열 → RPC 호출 없이 빈 bundle 반환', async () => {
    const { fetchOwnerStatsBundle } = await import('@/lib/owner/bot-stats-daily')
    const b = await fetchOwnerStatsBundle([], 30, new Date('2026-05-06T12:00:00Z'))
    expect(b.snapshot).toEqual([])
    expect(b.todayRows).toEqual([])
    expect(b.days).toBe(30)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('snapshot raw + today RPC 정상 fetch (T-271)', async () => {
    snapshotRawData = [{ date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 4, last_visited_at: null }]
    rpcResponses.bot_visits_today_owner = {
      data: [{ place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 7, last_visited_at: null }],
      error: null,
    }

    const { fetchOwnerStatsBundle } = await import('@/lib/owner/bot-stats-daily')
    const b = await fetchOwnerStatsBundle(['p1'], 7, new Date('2026-05-06T12:00:00Z'))

    expect(b.snapshot).toHaveLength(1)
    expect(b.todayRows).toHaveLength(1)
    // snapshot 은 raw select (mockSnapshotRange), today 만 RPC.
    expect(mockSnapshotRange).toHaveBeenCalled()
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })
})

describe('getOwnerBotSummaryFromBundle (T-269)', () => {
  it('bundle snapshot+today 동기 aggregate', async () => {
    const { getOwnerBotSummaryFromBundle } = await import('@/lib/owner/bot-stats-daily')
    const r = getOwnerBotSummaryFromBundle({
      snapshot: [
        { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 5, last_visited_at: null },
      ],
      todayRows: [
        { place_id: 'p1', bot_id: 'chatgpt-user', page_type: 'detail', visits: 2, last_visited_at: null },
      ],
      fromIso: '2026-04-06T00:00:00Z', toIso: '2026-05-06T12:00:00Z',
      days: 30, fromKey: '2026-04-06', toKey: '2026-05-06', todayKey: '2026-05-06',
    }, ['p1'])
    expect(r.aiTraining.total).toBe(5)
    expect(r.aiTraining.direct).toBe(5)
    expect(r.aiSearch.total).toBe(2)
    expect(r.aiSearch.direct).toBe(2)
  })

  it('snapshot null → 빈 bucket', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerBotSummaryFromBundle } = await import('@/lib/owner/bot-stats-daily')
    const r = getOwnerBotSummaryFromBundle({
      snapshot: null,
      todayRows: [],
      fromIso: 'a', toIso: 'b', days: 30, fromKey: '2026-04-06', toKey: '2026-05-06', todayKey: '2026-05-06',
    }, ['p1'])
    expect(r.aiSearch.total).toBe(0)
    consoleSpy.mockRestore()
  })
})

describe('getOwnerDailyTrendFromBundle (T-269)', () => {
  it('일자 버킷 + snapshot/today 누적', async () => {
    const { getOwnerDailyTrendFromBundle } = await import('@/lib/owner/bot-stats-daily')
    const rows = getOwnerDailyTrendFromBundle({
      snapshot: [
        { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 4, last_visited_at: null },
      ],
      todayRows: [
        { place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 7, last_visited_at: null },
      ],
      fromIso: 'a', toIso: 'b', days: 7, fromKey: '2026-04-30', toKey: '2026-05-06', todayKey: '2026-05-06',
    })
    expect(rows).toHaveLength(7)
    const total = rows.reduce((s, r) => s + r.total, 0)
    expect(total).toBe(11)
    const today = rows[rows.length - 1]
    expect(today.aiTraining.chatgpt).toBe(7)
  })
})

describe('listOwnerBotVisitsDaily', () => {
  it('placeIds 빈 → []', async () => {
    const { listOwnerBotVisitsDaily } = await import('@/lib/owner/bot-stats-daily')
    expect(await listOwnerBotVisitsDaily([])).toEqual([])
  })

  it('RPC 결과를 OwnerBotVisit 으로 변환 + AI 그룹만 + dedup', async () => {
    rpcResponses.owner_recent_bot_visits = {
      data: [
        { id: 1, bot_id: 'chatgpt-user', path: '/cheonan/derma/a', visited_at: '2026-05-06T10:00:00Z', page_type: 'detail', place_id: 'p1' },
        { id: 2, bot_id: 'googlebot',    path: '/cheonan/derma/a', visited_at: '2026-05-06T11:00:00Z', page_type: 'detail', place_id: 'p1' },
        { id: 3, bot_id: 'claudebot',    path: '/blog/x',          visited_at: '2026-05-06T12:00:00Z', page_type: 'blog',   place_id: 'p1' },
        // 같은 path 가 다른 place 에도 매핑된 fan-out — id dedup 으로 하나로.
        { id: 3, bot_id: 'claudebot',    path: '/blog/x',          visited_at: '2026-05-06T12:00:00Z', page_type: 'blog',   place_id: 'p2' },
      ],
      error: null,
    }

    const { listOwnerBotVisitsDaily } = await import('@/lib/owner/bot-stats-daily')
    const out = await listOwnerBotVisitsDaily(['p1', 'p2'], 10, 30, new Date('2026-05-06T12:00:00Z'))

    expect(out).toHaveLength(2)              // googlebot 제외 (search 그룹), id dedup
    expect(out[0].attribution).toBe('direct')  // detail → direct
    expect(out[0].pageType).toBe('place')      // detail → place 정규화
    expect(out[1].attribution).toBe('mention') // blog → mention
    expect(out[1].placeIds).toEqual(['p1', 'p2'])  // fan-out 병합
  })

  it('RPC 에러 → []', async () => {
    rpcResponses.owner_recent_bot_visits = { data: null, error: { message: 'fail' } }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { listOwnerBotVisitsDaily } = await import('@/lib/owner/bot-stats-daily')
    expect(await listOwnerBotVisitsDaily(['p1'])).toEqual([])
    consoleSpy.mockRestore()
  })
})
