import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.fn()
const mockFrom = vi.fn()

// T-253 — bot-visits.ts 가 두 종류 chain 사용:
//   1. SELECT cols + .gte().range(from, to) — 페이지네이션 (1000개 cap 우회)
//   2. SELECT '*' { count: 'exact', head: true } + .gte().eq() — 서버 카운트
//
// 양쪽 chain 모두 thenable + chainable 이어야 하므로 Postgrest mock 빌더를 제공.
//
// API 호환:
//   mockGte.mockResolvedValue({ data, error })            — paginate 모드 응답 데이터
//   mockGte.mockResolvedValueOnce(v)                       — 첫 호출만 v 로
//   mockCount.mockResolvedValue({ count, error })          — count head 모드 응답
//   mockCount.mockResolvedValueOnce(v)
//   _countQueue 는 select('*', {count:'exact'}) 호출 순서대로 소비.
type GteResult = { data: unknown; error: unknown }
type CountResult = { count: number | null; error: unknown }

const _gteQueue: GteResult[] = []
let _gteDefault: GteResult = { data: [], error: null }
const _countQueue: CountResult[] = []
let _countDefault: CountResult = { count: 0, error: null }

function nextGte(): GteResult { return _gteQueue.shift() ?? _gteDefault }
function nextCount(): CountResult { return _countQueue.shift() ?? _countDefault }

// thenable + .range() — paginate 시 첫 페이지에 데이터, 후속 페이지는 빈 배열 (loop 종료).
function gteThenable(consumed = false): Promise<GteResult> & { range: (...args: unknown[]) => Promise<GteResult> } {
  const result = consumed ? { data: [], error: null } : nextGte()
  const p = Promise.resolve(result) as Promise<GteResult> & { range: (...args: unknown[]) => Promise<GteResult> }
  let pageCount = 0
  p.range = () => {
    const r = pageCount === 0 ? result : { data: [], error: null }
    pageCount += 1
    return Promise.resolve(r)
  }
  return p
}

// count thenable — head:true 라 data 없이 count 만 반환.
function countThenable(): Promise<CountResult> & { gte: (...args: unknown[]) => Promise<CountResult> & { eq: (...args: unknown[]) => Promise<CountResult> } } {
  const result = nextCount()
  const eqStep = () => Promise.resolve(result)
  const gteStep = () => Object.assign(Promise.resolve(result), { eq: eqStep })
  return Object.assign(Promise.resolve(result), { gte: gteStep }) as ReturnType<typeof countThenable>
}

const mockGte = Object.assign(vi.fn(() => gteThenable()), {
  mockResolvedValue: (v: GteResult) => { _gteDefault = v; return mockGte },
  mockResolvedValueOnce: (v: GteResult) => { _gteQueue.push(v); return mockGte },
  mockReset: () => { _gteQueue.length = 0; _gteDefault = { data: [], error: null } },
})

const mockCount = {
  mockResolvedValue: (v: CountResult) => { _countDefault = v },
  mockResolvedValueOnce: (v: CountResult) => { _countQueue.push(v) },
  mockReset: () => { _countQueue.length = 0; _countDefault = { count: 0, error: null } },
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockGte.mockReset()
  mockCount.mockReset()
  mockFrom.mockReset()

  mockLimit.mockResolvedValue({
    data: [
      { id: 1, bot_id: 'gptbot', path: '/cheonan/dermatology', city: 'cheonan', category: 'dermatology', place_slug: null, visited_at: '2026-04-20T00:00:00Z' },
    ],
    error: null,
  })

  mockGte.mockResolvedValue({
    data: [
      { bot_id: 'gptbot', visited_at: '2026-04-20T00:00:00Z' },
      { bot_id: 'gptbot', visited_at: '2026-04-19T00:00:00Z' },
      { bot_id: 'claudebot', visited_at: '2026-04-18T00:00:00Z' },
    ],
    error: null,
  })

  // select(cols) → gte/eq chain (paginate). select('*', {count:exact, head:true}) → count chain.
  mockFrom.mockImplementation(() => ({
    select: vi.fn((_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head && opts?.count === 'exact') {
        return countThenable()
      }
      return {
        order: vi.fn(() => ({ limit: mockLimit })),
        gte: mockGte,
        eq: vi.fn(() => ({ gte: mockGte })),
      }
    }),
  }))
})

describe('listRecentBotVisits', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listRecentBotVisits } = await import('@/lib/admin/bot-visits')
    expect(await listRecentBotVisits()).toEqual([])
  })

  it('정상 반환', async () => {
    const { listRecentBotVisits } = await import('@/lib/admin/bot-visits')
    const r = await listRecentBotVisits(50)
    expect(r).toHaveLength(1)
    expect(r[0].bot_id).toBe('gptbot')
  })
})

describe('aggregateAiBotSummary', () => {
  it('admin null → 0/[]/zeros', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { aggregateAiBotSummary } = await import('@/lib/admin/bot-visits')
    const r = await aggregateAiBotSummary(7)
    expect(r.totalVisits).toBe(0)
    expect(r.byBot).toEqual([])
    expect(r.byDay).toHaveLength(7)
    expect(r.byDay.every(n => n === 0)).toBe(true)
  })

  it('googleother(crawler-other) 는 합계에서 제외 — AI + search 만 포함', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { bot_id: 'gptbot', visited_at: '2026-04-22T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-22T00:00:00Z' },
        { bot_id: 'claudebot', visited_at: '2026-04-23T00:00:00Z' },
        { bot_id: 'googlebot', visited_at: '2026-04-23T00:00:00Z' }, // search → 포함
        { bot_id: 'bingbot', visited_at: '2026-04-24T00:00:00Z' },   // search → 포함
        { bot_id: 'googleother', visited_at: '2026-04-22T00:00:00Z' }, // crawler-other → 제외
        { bot_id: 'googleother', visited_at: '2026-04-22T00:00:00Z' },
      ],
      error: null,
    })
    const { aggregateAiBotSummary } = await import('@/lib/admin/bot-visits')
    const r = await aggregateAiBotSummary(7)
    expect(r.totalVisits).toBe(5) // gpt 2 + claude 1 + google 1 + bing 1
    const ids = r.byBot.map(b => b.botId)
    expect(ids).toContain('gptbot')
    expect(ids).toContain('googlebot')
    expect(ids).toContain('bingbot')
    expect(ids).not.toContain('googleother')
  })

  it('byBot 은 visits 내림차순', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { bot_id: 'claudebot', visited_at: '2026-04-22T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-22T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-23T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-24T00:00:00Z' },
      ],
      error: null,
    })
    const { aggregateAiBotSummary } = await import('@/lib/admin/bot-visits')
    const r = await aggregateAiBotSummary(7)
    expect(r.byBot[0].botId).toBe('gptbot')
    expect(r.byBot[0].visits).toBe(3)
    expect(r.byBot[1].botId).toBe('claudebot')
    expect(r.byBot[1].visits).toBe(1)
  })

  it('byDay 길이 = days, 데이터 없는 날은 0', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockGte.mockResolvedValueOnce({
      data: [{ bot_id: 'gptbot', visited_at: new Date().toISOString() }],
      error: null,
    })
    const { aggregateAiBotSummary } = await import('@/lib/admin/bot-visits')
    const r = await aggregateAiBotSummary(14)
    expect(r.byDay).toHaveLength(14)
    expect(r.byDay[r.byDay.length - 1]).toBe(1) // 오늘
    // 0일치 데이터 가진 날도 0 으로 보존
    expect(r.byDay[0]).toBe(0)
    void today
  })

  it('첫 페이지 null → 안전 폴백', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { aggregateAiBotSummary } = await import('@/lib/admin/bot-visits')
    const r = await aggregateAiBotSummary(7)
    expect(r.totalVisits).toBe(0)
    expect(r.byBot).toEqual([])
    expect(r.byDay).toHaveLength(7)
  })
})

describe('aggregateBotStatus', () => {
  it('admin null → 0', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { aggregateBotStatus } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotStatus()
    expect(r.total).toBe(0)
    expect(r.rate404).toBe(0)
  })

  it('200/404/기타 분류 + 404 비율 — server-side count 3회 (total/200/404)', async () => {
    // T-253: SELECT * count=exact head=true 3 호출 — total / s200 / s404 순서.
    // Promise.all 이라 호출 순서가 보장되진 않지만, queue 가 셋 다 같은 의미(독립)로
    // 작동하도록 각 카운트값이 다른 mockCount 를 큐에 넣음. 구현이 호출하는 3 카운트는
    // queue 에서 차례대로 소비됨.
    mockCount.mockResolvedValueOnce({ count: 4, error: null })
    mockCount.mockResolvedValueOnce({ count: 2, error: null })
    mockCount.mockResolvedValueOnce({ count: 1, error: null })
    const { aggregateBotStatus } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotStatus(7)
    expect(r.total).toBe(4)
    expect(r.status200).toBe(2)
    expect(r.status404).toBe(1)
    expect(r.statusOther).toBe(1)
    expect(r.rate404).toBeCloseTo(0.25, 2)
  })

  it('count head 가 0 → total 0 + rate404 0', async () => {
    mockCount.mockResolvedValueOnce({ count: 0, error: null })
    mockCount.mockResolvedValueOnce({ count: 0, error: null })
    mockCount.mockResolvedValueOnce({ count: 0, error: null })
    const { aggregateBotStatus } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotStatus(7)
    expect(r.total).toBe(0)
    expect(r.rate404).toBe(0)
  })
})

describe('topBot404Paths', () => {
  beforeEach(() => {
    mockGte.mockResolvedValue({
      data: [
        { path: '/missing' }, { path: '/missing' }, { path: '/missing' },
        { path: '/gone' }, { path: '/other' },
      ],
      error: null,
    })
  })

  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { topBot404Paths } = await import('@/lib/admin/bot-visits')
    expect(await topBot404Paths()).toEqual([])
  })

  it('경로별 집계 + 정렬', async () => {
    // .eq().gte() 체인 — beforeEach 에서 이미 eq → gte 설정됨, 여기는 데이터만 덮어씀.
    const { topBot404Paths } = await import('@/lib/admin/bot-visits')
    const r = await topBot404Paths(7, 5)
    expect(r[0]).toEqual({ path: '/missing', count: 3 })
    expect(r).toHaveLength(3)
  })
})

describe('topCrawledPaths', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { topCrawledPaths } = await import('@/lib/admin/bot-visits')
    expect(await topCrawledPaths()).toEqual([])
  })

  it('경로별 집계 + 봇 유니크 + 내림차순', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { path: '/a', bot_id: 'gptbot' },
        { path: '/a', bot_id: 'claudebot' },
        { path: '/a', bot_id: 'gptbot' },
        { path: '/b', bot_id: 'gptbot' },
      ],
      error: null,
    })
    const { topCrawledPaths } = await import('@/lib/admin/bot-visits')
    const r = await topCrawledPaths(7, 5)
    expect(r[0]).toEqual({ path: '/a', count: 3, bots: expect.arrayContaining(['gptbot', 'claudebot']) })
    expect(r[1].path).toBe('/b')
  })

  it('DB data null → []', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: null })
    const { topCrawledPaths } = await import('@/lib/admin/bot-visits')
    expect(await topCrawledPaths()).toEqual([])
  })
})

describe('aggregateByGroup', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { aggregateByGroup } = await import('@/lib/admin/bot-visits')
    expect(await aggregateByGroup()).toEqual([])
  })

  it('4개 그룹 전부 반환 (visits 0 포함)', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { bot_id: 'gptbot', visited_at: '2026-04-20T00:00:00Z' },
        { bot_id: 'claudebot', visited_at: '2026-04-18T00:00:00Z' },
        { bot_id: 'googlebot', visited_at: '2026-04-19T00:00:00Z' },
      ],
      error: null,
    })
    const { aggregateByGroup } = await import('@/lib/admin/bot-visits')
    const r = await aggregateByGroup(30)
    expect(r.length).toBe(4)
    const training = r.find(g => g.group === 'ai-training')
    expect(training?.visits).toBe(2)  // gptbot + claudebot
    expect(training?.uniqueBots).toBe(2)
    const search = r.find(g => g.group === 'search')
    expect(search?.visits).toBe(1)
  })

  it('알 수 없는 bot_id → crawler-other 분류', async () => {
    mockGte.mockResolvedValueOnce({
      data: [{ bot_id: 'unknown-xyz', visited_at: '2026-04-20T00:00:00Z' }],
      error: null,
    })
    const { aggregateByGroup } = await import('@/lib/admin/bot-visits')
    const r = await aggregateByGroup()
    const other = r.find(g => g.group === 'crawler-other')
    expect(other?.visits).toBe(1)
  })

  it('lastVisitAt — 가장 최신 시각 반영', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { bot_id: 'gptbot', visited_at: '2026-04-10T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-22T00:00:00Z' },
        { bot_id: 'gptbot', visited_at: '2026-04-15T00:00:00Z' },
      ],
      error: null,
    })
    const { aggregateByGroup } = await import('@/lib/admin/bot-visits')
    const r = await aggregateByGroup()
    const training = r.find(g => g.group === 'ai-training')
    expect(training?.lastVisitAt).toBe('2026-04-22T00:00:00Z')
  })

  it('DB data null → []', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { aggregateByGroup } = await import('@/lib/admin/bot-visits')
    expect(await aggregateByGroup()).toEqual([])
  })
})

describe('dailyVisitTrend', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { dailyVisitTrend } = await import('@/lib/admin/bot-visits')
    expect(await dailyVisitTrend()).toEqual([])
  })

  it('days 길이만큼 bucket 생성 (방문 없는 날도 포함)', async () => {
    mockGte.mockResolvedValueOnce({
      data: [
        { bot_id: 'gptbot', visited_at: new Date().toISOString() },
      ],
      error: null,
    })
    const { dailyVisitTrend } = await import('@/lib/admin/bot-visits')
    const r = await dailyVisitTrend(7)
    expect(r.length).toBe(7)
    // 각 bucket 에 byGroup 4개 전부 존재
    expect(r[0].byGroup).toHaveProperty('ai-training')
    expect(r[0].byGroup).toHaveProperty('ai-search')
    expect(r[0].byGroup).toHaveProperty('search')
    expect(r[0].byGroup).toHaveProperty('crawler-other')
  })

  it('오늘 방문 1건 → 해당 bucket.total=1', async () => {
    const now = new Date()
    mockGte.mockResolvedValueOnce({
      data: [{ bot_id: 'gptbot', visited_at: now.toISOString() }],
      error: null,
    })
    const { dailyVisitTrend } = await import('@/lib/admin/bot-visits')
    const r = await dailyVisitTrend(7)
    const todayBucket = r[r.length - 1]
    expect(todayBucket.total).toBe(1)
    expect(todayBucket.byGroup['ai-training']).toBe(1)
  })

  it('DB data null → []', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: null })
    const { dailyVisitTrend } = await import('@/lib/admin/bot-visits')
    expect(await dailyVisitTrend()).toEqual([])
  })
})

describe('aggregateBotVisits', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { aggregateBotVisits } = await import('@/lib/admin/bot-visits')
    expect(await aggregateBotVisits()).toEqual([])
  })

  it('봇별 합산 + 방문수 내림차순', async () => {
    const { aggregateBotVisits } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotVisits(30)
    expect(r).toHaveLength(2)
    expect(r[0].botId).toBe('gptbot')
    expect(r[0].visits).toBe(2)
    expect(r[1].botId).toBe('claudebot')
    expect(r[1].visits).toBe(1)
  })

  it('최근 visit 추적', async () => {
    const { aggregateBotVisits } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotVisits()
    expect(r[0].lastVisitAt).toBe('2026-04-20T00:00:00Z')
  })

  it('DB 에러 → []', async () => {
    mockGte.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { aggregateBotVisits } = await import('@/lib/admin/bot-visits')
    expect(await aggregateBotVisits()).toEqual([])
  })
})
