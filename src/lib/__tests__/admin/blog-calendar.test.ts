import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildCalendarGrid, parseMonthParam, type BlogCalendarPost } from '@/lib/admin/blog-calendar'

const mockFrom = vi.fn()
const mockLimit = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockFrom.mockReset()
  mockLimit.mockResolvedValue({ data: [{ id: 'b1', slug: 's1', title: 'T', status: 'active', published_at: '2026-04-10T00:00:00Z', created_at: '2026-04-01T00:00:00Z', category: null, post_type: 'guide' }], error: null })
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      or: vi.fn(() => ({
        order: vi.fn(() => ({ limit: mockLimit })),
      })),
    })),
  }))
})

describe('listBlogPostsForMonth', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listBlogPostsForMonth } = await import('@/lib/admin/blog-calendar')
    expect(await listBlogPostsForMonth(2026, 4)).toEqual([])
  })

  it('정상 쿼리 → 행 반환', async () => {
    const { listBlogPostsForMonth } = await import('@/lib/admin/blog-calendar')
    const r = await listBlogPostsForMonth(2026, 4)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('b1')
  })

  it('DB 에러 → []', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { listBlogPostsForMonth } = await import('@/lib/admin/blog-calendar')
    expect(await listBlogPostsForMonth(2026, 4)).toEqual([])
  })
})


describe('parseMonthParam', () => {
  it('YYYY-MM 파싱', () => {
    expect(parseMonthParam('2026-04')).toEqual({ year: 2026, month: 4 })
    expect(parseMonthParam('2026-12')).toEqual({ year: 2026, month: 12 })
  })

  it('잘못된 입력 → 현재 월', () => {
    const now = new Date('2026-03-15T00:00:00Z')
    expect(parseMonthParam('abc', now)).toEqual({ year: 2026, month: 3 })
    expect(parseMonthParam('2026-13', now)).toEqual({ year: 2026, month: 3 })
    expect(parseMonthParam(undefined, now)).toEqual({ year: 2026, month: 3 })
  })
})

describe('buildCalendarGrid', () => {
  it('2026-04 (4월 1일 수요일) — 6주 42일, 월요일 시작', () => {
    const grid = buildCalendarGrid(2026, 4, [])
    expect(grid).toHaveLength(42)
    // 4월 1일은 수요일 → 월요일부터 시작하면 3월 30일이 grid[0]
    expect(grid[0].date).toBe('2026-03-30')
    expect(grid[0].inCurrentMonth).toBe(false)
    // 4월 1일은 grid[2]
    expect(grid[2].date).toBe('2026-04-01')
    expect(grid[2].inCurrentMonth).toBe(true)
  })

  it('post published_at 기준 배치', () => {
    const posts: BlogCalendarPost[] = [
      { id: 'p1', slug: 's1', title: 'A', status: 'active', published_at: '2026-04-10T09:00:00Z', created_at: '2026-04-01T00:00:00Z', category: null, post_type: 'guide' },
      { id: 'p2', slug: 's2', title: 'B', status: 'draft', published_at: null, created_at: '2026-04-15T00:00:00Z', category: null, post_type: 'guide' },
    ]
    const grid = buildCalendarGrid(2026, 4, posts)
    const apr10 = grid.find(d => d.date === '2026-04-10')
    const apr15 = grid.find(d => d.date === '2026-04-15')
    expect(apr10?.posts).toHaveLength(1)
    expect(apr10?.posts[0].id).toBe('p1')
    expect(apr15?.posts).toHaveLength(1)
    expect(apr15?.posts[0].id).toBe('p2')
  })

  it('inCurrentMonth 플래그', () => {
    const grid = buildCalendarGrid(2026, 4, [])
    const inCount = grid.filter(d => d.inCurrentMonth).length
    expect(inCount).toBe(30) // 4월은 30일
  })
})
