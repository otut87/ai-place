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
