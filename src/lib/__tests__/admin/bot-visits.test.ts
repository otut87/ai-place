import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLimit = vi.fn()
const mockGte = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockGte.mockReset()
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

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({ limit: mockLimit })),
      gte: mockGte,
    })),
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

describe('aggregateBotStatus', () => {
  beforeEach(() => {
    mockGte.mockResolvedValue({
      data: [{ status: 200 }, { status: 200 }, { status: 404 }, { status: 500 }],
      error: null,
    })
  })

  it('admin null → 0', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { aggregateBotStatus } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotStatus()
    expect(r.total).toBe(0)
    expect(r.rate404).toBe(0)
  })

  it('200/404/기타 분류 + 404 비율', async () => {
    const { aggregateBotStatus } = await import('@/lib/admin/bot-visits')
    const r = await aggregateBotStatus(7)
    expect(r.total).toBe(4)
    expect(r.status200).toBe(2)
    expect(r.status404).toBe(1)
    expect(r.statusOther).toBe(1)
    expect(r.rate404).toBeCloseTo(0.25, 2)
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
    // 이 경로는 .eq().gte() 체인 — 별도 mock 필요
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({ limit: mockLimit })),
        gte: mockGte,
        eq: vi.fn(() => ({ gte: mockGte })),
      })),
    }))

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
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ gte: vi.fn().mockResolvedValue({
          data: [
            { path: '/a', bot_id: 'gptbot' },
            { path: '/a', bot_id: 'claudebot' },
            { path: '/a', bot_id: 'gptbot' },
            { path: '/b', bot_id: 'gptbot' },
          ],
          error: null,
        }) })),
      })),
    }))
    const { topCrawledPaths } = await import('@/lib/admin/bot-visits')
    const r = await topCrawledPaths(7, 5)
    expect(r[0]).toEqual({ path: '/a', count: 3, bots: expect.arrayContaining(['gptbot', 'claudebot']) })
    expect(r[1].path).toBe('/b')
  })

  it('DB data null → []', async () => {
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ gte: vi.fn().mockResolvedValue({ data: null, error: null }) })),
      })),
    }))
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
