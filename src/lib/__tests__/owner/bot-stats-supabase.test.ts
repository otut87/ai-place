import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase mock — path/visit 별 시나리오 주입
interface State {
  mentions: Array<{ page_path: string; page_type: string; place_id: string }>
  visits: Array<{ id?: number; bot_id: string; path: string; visited_at: string }>
  mentionsError: { message: string } | null
  visitsError: { message: string } | null
}

const state: State = {
  mentions: [],
  visits: [],
  mentionsError: null,
  visitsError: null,
}

function chainReturn(data: unknown, error: unknown = null) {
  return Promise.resolve({ data, error })
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'place_mentions') {
        return {
          select: () => ({
            in: () => state.mentionsError
              ? chainReturn(null, state.mentionsError)
              : chainReturn(state.mentions),
          }),
        }
      }
      if (table === 'bot_visits') {
        const leaf = state.visitsError
          ? chainReturn(null, state.visitsError)
          : {
              // getOwnerByPathSummary / getOwnerDailyTrend / getOwnerBotSummary 는 .in().gte().lt() 까지만
              then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
                onFulfilled({ data: state.visits, error: null }),
              // listOwnerBotVisits 는 .order().limit()
              order: () => ({
                limit: () => chainReturn(state.visits),
              }),
            }
        return {
          select: () => ({
            in: () => ({
              // T-209: .gte().lt() 체인 추가 (period 명시적 from/to)
              gte: () => ({ lt: () => leaf }),
            }),
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  state.mentions = []
  state.visits = []
  state.mentionsError = null
  state.visitsError = null
})

// ── getOwnerBotSummary ───────────────────────────────────────────
describe('getOwnerBotSummary', () => {
  it('placeIds 빈 배열 → 0 집계', async () => {
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary([], 30, new Date('2026-04-22T00:00:00Z'))
    expect(s.aiSearch.total).toBe(0)
    expect(s.aiTraining.total).toBe(0)
    expect(s.periodDays).toBe(30)
  })

  it('place_mentions 비어있음 → 빈 summary', async () => {
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1'], 30, new Date('2026-04-22T00:00:00Z'))
    expect(s.aiSearch.total).toBe(0)
  })

  it('place_mentions 조회 에러 → 빈 summary + console.error', async () => {
    state.mentionsError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1'], 30)
    expect(s.aiSearch.total).toBe(0)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('mentions + visits 매칭 → aggregateOwnerBotSummary 통해 집계', async () => {
    state.mentions = [
      { page_path: '/cheonan/derma/a', page_type: 'place', place_id: 'p-1' },
      { page_path: '/blog/cheonan/medical/x', page_type: 'blog', place_id: 'p-1' },
    ]
    state.visits = [
      { bot_id: 'chatgpt-user', path: '/cheonan/derma/a', visited_at: '2026-04-20T10:00:00Z' },
      { bot_id: 'gptbot', path: '/blog/cheonan/medical/x', visited_at: '2026-04-20T11:00:00Z' },
    ]
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1'], 30, new Date('2026-04-22T00:00:00Z'))
    expect(s.aiSearch.total).toBe(1)
    expect(s.aiTraining.total).toBe(1)
    expect(s.aiSearch.direct).toBe(1)  // 'place' → direct
    expect(s.aiTraining.mention).toBe(1)  // 'blog' → mention
  })

  it('같은 path 를 여러 place 로 귀속 → placeIds 병합', async () => {
    state.mentions = [
      { page_path: '/blog/x', page_type: 'blog', place_id: 'p-1' },
      { page_path: '/blog/x', page_type: 'blog', place_id: 'p-2' },
    ]
    state.visits = [
      { bot_id: 'claude-web', path: '/blog/x', visited_at: '2026-04-20T10:00:00Z' },
    ]
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1', 'p-2'], 30, new Date('2026-04-22T00:00:00Z'))
    expect(s.aiSearch.total).toBe(1)
  })

  it('bot_visits 에러 → 빈 summary', async () => {
    state.mentions = [{ page_path: '/x', page_type: 'place', place_id: 'p-1' }]
    state.visitsError = { message: 'bv fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1'], 30)
    expect(s.aiSearch.total).toBe(0)
    spy.mockRestore()
  })

  it('admin null → 빈 summary', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { getOwnerBotSummary } = await import('@/lib/owner/bot-stats')
    const s = await getOwnerBotSummary(['p-1'], 30)
    expect(s.aiSearch.total).toBe(0)
  })
})

// ── getOwnerDailyTrend ───────────────────────────────────────────
describe('getOwnerDailyTrend', () => {
  it('placeIds 빈 → 빈 버킷만', async () => {
    const { getOwnerDailyTrend } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerDailyTrend([], 7, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(7)
    expect(rows.every((r) => r.total === 0)).toBe(true)
  })

  it('mentions 비어있음 → 빈 버킷', async () => {
    const { getOwnerDailyTrend } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerDailyTrend(['p-1'], 3, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(3)
  })

  it('방문 매칭 후 해당 날짜 버킷에 누적', async () => {
    state.mentions = [{ page_path: '/cheonan/derma/a', page_type: 'place', place_id: 'p-1' }]
    state.visits = [
      { bot_id: 'chatgpt-user', path: '/cheonan/derma/a', visited_at: '2026-04-22T03:00:00Z' },
    ]
    const { getOwnerDailyTrend } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerDailyTrend(['p-1'], 3, new Date('2026-04-22T00:00:00Z'))
    const total = rows.reduce((s, r) => s + r.total, 0)
    expect(total).toBe(1)
  })

  it('bot_visits 에러 → 빈 버킷 유지', async () => {
    state.mentions = [{ page_path: '/x', page_type: 'blog', place_id: 'p-1' }]
    state.visitsError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerDailyTrend } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerDailyTrend(['p-1'], 3, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(3)
    expect(rows.every((r) => r.total === 0)).toBe(true)
    spy.mockRestore()
  })

  it('admin null → 빈 버킷', async () => {
    state.mentions = [{ page_path: '/x', page_type: 'blog', place_id: 'p-1' }]
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(makeAdmin() as never).mockReturnValueOnce(null as never)
    const { getOwnerDailyTrend } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerDailyTrend(['p-1'], 3, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(3)
  })
})

// ── getOwnerByPathSummary ────────────────────────────────────────
describe('getOwnerByPathSummary', () => {
  it('placeIds 빈 → []', async () => {
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    expect(await getOwnerByPathSummary([])).toEqual([])
  })

  it('mentions 비어있음 → []', async () => {
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    expect(await getOwnerByPathSummary(['p-1'])).toEqual([])
  })

  it('매칭 → total desc 로 정렬된 row', async () => {
    state.mentions = [
      { page_path: '/a', page_type: 'place', place_id: 'p-1' },
      { page_path: '/b', page_type: 'blog', place_id: 'p-1' },
    ]
    state.visits = [
      { bot_id: 'chatgpt-user', path: '/a', visited_at: '2026-04-20T10:00:00Z' },
      { bot_id: 'chatgpt-user', path: '/a', visited_at: '2026-04-21T10:00:00Z' },
      { bot_id: 'claude-web', path: '/b', visited_at: '2026-04-19T10:00:00Z' },
    ]
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerByPathSummary(['p-1'], 30, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(2)
    expect(rows[0].path).toBe('/a')
    expect(rows[0].attribution).toBe('direct')
    expect(rows[1].attribution).toBe('mention')
  })

  it('비-AI 그룹은 스킵', async () => {
    state.mentions = [{ page_path: '/a', page_type: 'place', place_id: 'p-1' }]
    state.visits = [
      { bot_id: 'googlebot', path: '/a', visited_at: '2026-04-20T10:00:00Z' },
    ]
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    const rows = await getOwnerByPathSummary(['p-1'])
    expect(rows).toEqual([])
  })

  it('bot_visits 에러 → []', async () => {
    state.mentions = [{ page_path: '/a', page_type: 'blog', place_id: 'p-1' }]
    state.visitsError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    expect(await getOwnerByPathSummary(['p-1'])).toEqual([])
    spy.mockRestore()
  })

  it('admin null → []', async () => {
    state.mentions = [{ page_path: '/a', page_type: 'blog', place_id: 'p-1' }]
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(makeAdmin() as never).mockReturnValueOnce(null as never)
    const { getOwnerByPathSummary } = await import('@/lib/owner/bot-stats')
    expect(await getOwnerByPathSummary(['p-1'])).toEqual([])
  })
})

// ── listOwnerBotVisits ───────────────────────────────────────────
describe('listOwnerBotVisits', () => {
  it('placeIds 빈 → []', async () => {
    const { listOwnerBotVisits } = await import('@/lib/owner/bot-stats')
    expect(await listOwnerBotVisits([])).toEqual([])
  })

  it('mentions 비어있음 → []', async () => {
    const { listOwnerBotVisits } = await import('@/lib/owner/bot-stats')
    expect(await listOwnerBotVisits(['p-1'])).toEqual([])
  })

  it('매칭된 visits 반환 · AI 그룹만', async () => {
    state.mentions = [
      { page_path: '/a', page_type: 'place', place_id: 'p-1' },
      { page_path: '/b', page_type: 'blog', place_id: 'p-1' },
    ]
    state.visits = [
      { id: 1, bot_id: 'chatgpt-user', path: '/a', visited_at: '2026-04-20T10:00:00Z' },
      { id: 2, bot_id: 'googlebot', path: '/a', visited_at: '2026-04-20T11:00:00Z' },
      { id: 3, bot_id: 'claude-web', path: '/b', visited_at: '2026-04-20T12:00:00Z' },
    ]
    const { listOwnerBotVisits } = await import('@/lib/owner/bot-stats')
    const rows = await listOwnerBotVisits(['p-1'], 10, 30, new Date('2026-04-22T00:00:00Z'))
    expect(rows).toHaveLength(2)   // googlebot 제외
    expect(rows[0].attribution).toBe('direct')
    expect(rows[1].attribution).toBe('mention')
  })

  it('limit 까지만 반환', async () => {
    state.mentions = [{ page_path: '/a', page_type: 'place', place_id: 'p-1' }]
    state.visits = Array.from({ length: 5 }, (_, i) => ({
      id: i, bot_id: 'chatgpt-user', path: '/a', visited_at: `2026-04-2${i}T10:00:00Z`,
    }))
    const { listOwnerBotVisits } = await import('@/lib/owner/bot-stats')
    const rows = await listOwnerBotVisits(['p-1'], 2, 30, new Date('2026-04-28T00:00:00Z'))
    expect(rows).toHaveLength(2)
  })

  it('admin null → []', async () => {
    state.mentions = [{ page_path: '/a', page_type: 'blog', place_id: 'p-1' }]
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(makeAdmin() as never).mockReturnValueOnce(null as never)
    const { listOwnerBotVisits } = await import('@/lib/owner/bot-stats')
    expect(await listOwnerBotVisits(['p-1'])).toEqual([])
  })
})
