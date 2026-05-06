/**
 * bot-stats-daily.ts 테스트 (T-264)
 *
 * 053 일별 사전집계 reader 검증:
 * - placeIds 빈 배열 → empty bucket / empty trend
 * - snapshot 어제까지 + today RPC 정상 merge
 * - direct (page_type=detail) vs mention 분류
 * - DB 미가용 fallback
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSnapshotRange = vi.fn()
const mockTodayRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockTodayRpc,
  })),
}))

beforeEach(() => {
  mockSnapshotRange.mockReset().mockResolvedValue({ data: [], error: null })
  mockTodayRpc.mockReset().mockResolvedValue({ data: [], error: null })
  mockFrom.mockReset().mockImplementation(() => ({
    select: () => ({
      in: () => ({
        gte: () => ({
          lte: () => ({
            range: mockSnapshotRange,
          }),
        }),
      }),
    }),
  }))
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
    mockSnapshotRange.mockResolvedValueOnce({
      data: [
        // 어제까지 사전집계: GPTBot(ai-training/chatgpt) detail 5회, ClaudeBot(ai-training/claude) blog 3회
        { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 5, last_visited_at: '2026-05-05T10:00:00Z' },
        { date: '2026-05-05', place_id: 'p1', bot_id: 'claudebot', page_type: 'blog', visits: 3, last_visited_at: '2026-05-05T11:00:00Z' },
      ],
      error: null,
    })
    mockTodayRpc.mockResolvedValueOnce({
      data: [
        // 오늘 RPC: ChatGPT-User(ai-search/chatgpt) detail 2회, PerplexityBot(ai-search/perplexity) compare 1회
        { place_id: 'p1', bot_id: 'chatgpt-user', page_type: 'detail', visits: 2, last_visited_at: '2026-05-06T09:00:00Z' },
        { place_id: 'p1', bot_id: 'perplexitybot', page_type: 'compare', visits: 1, last_visited_at: '2026-05-06T10:00:00Z' },
      ],
      error: null,
    })

    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))

    // ai-training: gptbot=5(direct) + claudebot=3(mention) = 8 total
    expect(r.aiTraining.total).toBe(8)
    expect(r.aiTraining.direct).toBe(5)
    expect(r.aiTraining.mention).toBe(3)
    expect(r.aiTraining.byEngine.chatgpt).toBe(5)
    expect(r.aiTraining.byEngine.claude).toBe(3)

    // ai-search: chatgpt-user=2(direct) + perplexitybot=1(mention) = 3 total
    expect(r.aiSearch.total).toBe(3)
    expect(r.aiSearch.direct).toBe(2)
    expect(r.aiSearch.mention).toBe(1)
    expect(r.aiSearch.byEngine.chatgpt).toBe(2)
    expect(r.aiSearch.byEngine.perplexity).toBe(1)
  })

  it('snapshot DB 미가용 → 빈 bucket fallback', async () => {
    mockSnapshotRange.mockResolvedValueOnce({ data: null, error: { message: 'down' } })
    mockTodayRpc.mockResolvedValueOnce({ data: [], error: null })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))
    expect(r.aiSearch.total).toBe(0)
    expect(r.aiTraining.total).toBe(0)
    consoleSpy.mockRestore()
  })

  it('미식별 bot_id 는 무시 (fallback 안 함)', async () => {
    mockSnapshotRange.mockResolvedValueOnce({
      data: [
        { date: '2026-05-05', place_id: 'p1', bot_id: 'unknown-bot', page_type: 'detail', visits: 100, last_visited_at: null },
      ],
      error: null,
    })

    const { getOwnerBotSummaryDaily } = await import('@/lib/owner/bot-stats-daily')
    const r = await getOwnerBotSummaryDaily(['p1'], 30, new Date('2026-05-06T12:00:00Z'))
    expect(r.aiSearch.total).toBe(0)
    expect(r.aiTraining.total).toBe(0)
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
    mockSnapshotRange.mockResolvedValueOnce({
      data: [
        { date: '2026-05-05', place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 4, last_visited_at: null },
        { date: '2026-05-04', place_id: 'p1', bot_id: 'claudebot', page_type: 'detail', visits: 2, last_visited_at: null },
      ],
      error: null,
    })
    mockTodayRpc.mockResolvedValueOnce({
      data: [
        { place_id: 'p1', bot_id: 'gptbot', page_type: 'detail', visits: 7, last_visited_at: null },
      ],
      error: null,
    })

    const { getOwnerDailyTrendDaily } = await import('@/lib/owner/bot-stats-daily')
    const rows = await getOwnerDailyTrendDaily(['p1'], 7, new Date('2026-05-06T12:00:00Z'))
    expect(rows).toHaveLength(7)
    // total 합이 4+2+7=13.
    const total = rows.reduce((s, r) => s + r.total, 0)
    expect(total).toBe(13)
    // 가장 최근 날짜(today)에 today RPC 의 7 이 있어야 함.
    const today = rows[rows.length - 1]
    expect(today.total).toBe(7)
    expect(today.aiTraining.chatgpt).toBe(7)
  })
})
