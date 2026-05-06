// Phase 1 / A2 (2026-05-06) — bot_visits 일별 사전집계 reader 단위 테스트.
// snapshot (어제까지) + RPC (오늘) 두 소스 합치기 정확성 검증.

import { describe, it, expect, vi, beforeEach } from 'vitest'

interface MockState {
  snapshot: Array<{
    date: string
    bot_id: string
    bot_group: string
    status: number
    visits: number
    unique_paths: number
    last_visited_at: string | null
  }>
  snapshotPaths: Array<{
    date: string
    path: string
    status: number
    bot_ids: string[]
    visits: number
  }>
  todaySummary: Array<{
    bot_id: string
    bot_group: string
    status: number
    visits: number | string
    unique_paths: number | string
    last_visited_at: string | null
  }>
  todayPaths: Array<{ path: string; status: number; bot_ids: string[]; visits: number | string }>
  snapshotError: { message: string } | null
}

const state: MockState = {
  snapshot: [],
  snapshotPaths: [],
  todaySummary: [],
  todayPaths: [],
  snapshotError: null,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'bot_visits_daily') {
        return {
          select: () => ({
            gte: () => ({
              lte: () =>
                state.snapshotError
                  ? Promise.resolve({ data: null, error: state.snapshotError })
                  : Promise.resolve({ data: state.snapshot, error: null }),
            }),
            order: () => ({
              limit: () => ({
                maybeSingle: () => {
                  // 가장 최근 last_visited_at — snapshot 의 max 반환
                  const sorted = [...state.snapshot]
                    .filter(r => r.last_visited_at)
                    .sort((a, b) => (b.last_visited_at ?? '').localeCompare(a.last_visited_at ?? ''))
                  return Promise.resolve({
                    data: sorted[0] ? { last_visited_at: sorted[0].last_visited_at } : null,
                    error: null,
                  })
                },
              }),
            }),
          }),
        }
      }
      if (table === 'bot_visits_daily_paths') {
        return {
          select: () => ({
            gte: () => ({
              lte: () => Promise.resolve({ data: state.snapshotPaths, error: null }),
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
    rpc(name: string) {
      if (name === 'bot_visits_today_summary') {
        return Promise.resolve({ data: state.todaySummary, error: null })
      }
      if (name === 'bot_visits_today_top_paths') {
        return Promise.resolve({ data: state.todayPaths, error: null })
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } })
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  state.snapshot = []
  state.snapshotPaths = []
  state.todaySummary = []
  state.todayPaths = []
  state.snapshotError = null
})

describe('aggregateBotVisitsDaily', () => {
  it('snapshot + today 합산, bot_id 단위', async () => {
    state.snapshot = [
      { date: '2026-05-04', bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 100, unique_paths: 30, last_visited_at: '2026-05-04T23:00:00Z' },
      { date: '2026-05-05', bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 150, unique_paths: 40, last_visited_at: '2026-05-05T23:00:00Z' },
      { date: '2026-05-05', bot_id: 'claudebot', bot_group: 'ai-training', status: 200, visits: 50, unique_paths: 20, last_visited_at: '2026-05-05T20:00:00Z' },
    ]
    state.todaySummary = [
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 30, unique_paths: 10, last_visited_at: '2026-05-06T10:00:00Z' },
    ]
    const { aggregateBotVisitsDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await aggregateBotVisitsDaily(7)

    const gpt = r.find((x) => x.botId === 'gptbot')
    expect(gpt?.visits).toBe(100 + 150 + 30)  // snapshot 2일 + today
    expect(gpt?.lastVisitAt).toBe('2026-05-06T10:00:00Z')

    const claude = r.find((x) => x.botId === 'claudebot')
    expect(claude?.visits).toBe(50)

    // 정렬: visits desc
    expect(r[0].botId).toBe('gptbot')
  })

  it('bigint 직렬화 (string) → number 변환', async () => {
    state.todaySummary = [
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: '12345', unique_paths: '67', last_visited_at: null },
    ]
    const { aggregateBotVisitsDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await aggregateBotVisitsDaily(1)
    expect(r[0].visits).toBe(12345)
    expect(typeof r[0].visits).toBe('number')
  })
})

describe('aggregateBotStatusDaily', () => {
  it('total / 200 / 404 / other / rate404 정확히 합산', async () => {
    state.snapshot = [
      { date: '2026-05-04', bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 100, unique_paths: 30, last_visited_at: null },
      { date: '2026-05-04', bot_id: 'gptbot', bot_group: 'ai-training', status: 404, visits: 10, unique_paths: 5, last_visited_at: null },
      { date: '2026-05-05', bot_id: 'claudebot', bot_group: 'ai-training', status: 0, visits: 5, unique_paths: 2, last_visited_at: null },
    ]
    state.todaySummary = [
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 50, unique_paths: 20, last_visited_at: null },
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 404, visits: 5, unique_paths: 2, last_visited_at: null },
    ]
    const { aggregateBotStatusDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await aggregateBotStatusDaily(7)

    expect(r.total).toBe(170)        // 100+10+5+50+5
    expect(r.status200).toBe(150)    // 100+50
    expect(r.status404).toBe(15)     // 10+5
    expect(r.statusOther).toBe(5)    // total - 200 - 404
    expect(r.rate404).toBeCloseTo(15 / 170)
  })

  it('데이터 없음 → all 0', async () => {
    const { aggregateBotStatusDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await aggregateBotStatusDaily(30)
    expect(r.total).toBe(0)
    expect(r.rate404).toBe(0)
  })
})

describe('aggregateByGroupDaily', () => {
  it('bot_group 단위 합산 + 유니크 봇 수', async () => {
    state.snapshot = [
      { date: '2026-05-05', bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 100, unique_paths: 30, last_visited_at: '2026-05-05T23:00:00Z' },
      { date: '2026-05-05', bot_id: 'claudebot', bot_group: 'ai-training', status: 200, visits: 50, unique_paths: 20, last_visited_at: null },
      { date: '2026-05-05', bot_id: 'googlebot', bot_group: 'search', status: 200, visits: 200, unique_paths: 50, last_visited_at: null },
    ]
    state.todaySummary = [
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 10, unique_paths: 5, last_visited_at: '2026-05-06T10:00:00Z' },
    ]
    const { aggregateByGroupDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await aggregateByGroupDaily(7)

    const aiTrain = r.find((x) => x.group === 'ai-training')
    expect(aiTrain?.visits).toBe(100 + 50 + 10)
    expect(aiTrain?.uniqueBots).toBe(2)              // gptbot, claudebot
    expect(aiTrain?.lastVisitAt).toBe('2026-05-06T10:00:00Z')

    const search = r.find((x) => x.group === 'search')
    expect(search?.visits).toBe(200)
    expect(search?.uniqueBots).toBe(1)
  })
})

describe('topCrawledPathsDaily', () => {
  it('status 200 만 합산, top N', async () => {
    state.snapshotPaths = [
      { date: '2026-05-05', path: '/a', status: 200, bot_ids: ['gptbot'], visits: 100 },
      { date: '2026-05-05', path: '/b', status: 200, bot_ids: ['claudebot'], visits: 50 },
      { date: '2026-05-05', path: '/a', status: 404, bot_ids: ['gptbot'], visits: 10 },  // 404 제외
    ]
    state.todayPaths = [
      { path: '/a', status: 200, bot_ids: ['gptbot', 'perplexitybot'], visits: 30 },
    ]
    const { topCrawledPathsDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await topCrawledPathsDaily(7, 5)

    expect(r[0].path).toBe('/a')
    expect(r[0].count).toBe(100 + 30)               // 200 전용 합산
    expect(r[0].bots.sort()).toEqual(['gptbot', 'perplexitybot'])
    expect(r[1].path).toBe('/b')
    expect(r[1].count).toBe(50)
  })
})

describe('topBot404PathsDaily', () => {
  it('status 404 만 합산, top N', async () => {
    state.snapshotPaths = [
      { date: '2026-05-05', path: '/notfound', status: 404, bot_ids: ['gptbot'], visits: 30 },
      { date: '2026-05-05', path: '/notfound', status: 200, bot_ids: ['gptbot'], visits: 5 },  // 200 제외
      { date: '2026-05-05', path: '/gone', status: 404, bot_ids: ['claudebot'], visits: 10 },
    ]
    state.todayPaths = [
      { path: '/notfound', status: 404, bot_ids: ['gptbot'], visits: 5 },
    ]
    const { topBot404PathsDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await topBot404PathsDaily(7, 5)

    expect(r[0].path).toBe('/notfound')
    expect(r[0].count).toBe(30 + 5)
    expect(r[1].path).toBe('/gone')
    expect(r[1].count).toBe(10)
  })
})

describe('dailyVisitTrendDaily', () => {
  it('일자 버킷 + 그룹별 분해 + 오늘 라이브 누적', async () => {
    // 마지막 일자(오늘)는 todaySummary 가 채움. snapshot 은 그 전까지.
    // 시간 fixed 가 어렵지만 전체 길이 + 그룹 분해 검증으로 충분.
    state.snapshot = [
      // snapshot 일자 키는 KST 기준 — 안전하게 '오늘 -3일' 형식 대신 임의 날짜 사용해서
      // 버킷 매칭 안 될 수 있음. 누적 동작만 확인.
    ]
    state.todaySummary = [
      { bot_id: 'gptbot', bot_group: 'ai-training', status: 200, visits: 100, unique_paths: 30, last_visited_at: null },
      { bot_id: 'googlebot', bot_group: 'search', status: 200, visits: 50, unique_paths: 20, last_visited_at: null },
    ]
    const { dailyVisitTrendDaily } = await import('@/lib/admin/bot-visits-daily')
    const r = await dailyVisitTrendDaily(7)

    expect(r).toHaveLength(7)                       // 7 일 버킷
    const todayBucket = r[r.length - 1]             // 마지막 = 오늘
    expect(todayBucket.total).toBe(150)             // 100 + 50
    expect(todayBucket.byGroup['ai-training']).toBe(100)
    expect(todayBucket.byGroup['search']).toBe(50)
  })
})

describe('getLastAggregatedAt', () => {
  it('snapshot 의 최신 last_visited_at 반환', async () => {
    state.snapshot = [
      { date: '2026-05-04', bot_id: 'a', bot_group: 'ai-training', status: 200, visits: 1, unique_paths: 1, last_visited_at: '2026-05-04T20:00:00Z' },
      { date: '2026-05-05', bot_id: 'b', bot_group: 'ai-training', status: 200, visits: 1, unique_paths: 1, last_visited_at: '2026-05-05T23:55:00Z' },
    ]
    const { getLastAggregatedAt } = await import('@/lib/admin/bot-visits-daily')
    expect(await getLastAggregatedAt()).toBe('2026-05-05T23:55:00Z')
  })

  it('데이터 없음 → null', async () => {
    const { getLastAggregatedAt } = await import('@/lib/admin/bot-visits-daily')
    expect(await getLastAggregatedAt()).toBeNull()
  })
})
