/**
 * site-stats.ts 테스트 (T-003)
 *
 * 모든 수치(업체 수/활성 카테고리/전체 카테고리/도시/연도)는
 * site-stats.ts 를 단일 소스로 사용해야 함. GEO: fact consistency.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetAllPlaces = vi.fn()
const mockGetCities = vi.fn()
const mockGetCategories = vi.fn()
const mockGetAllActiveBlogPosts = vi.fn()

vi.mock('@/lib/data.supabase', () => ({
  getAllPlaces: mockGetAllPlaces,
  getCities: mockGetCities,
  getCategories: mockGetCategories,
}))

vi.mock('@/lib/blog/data.supabase', () => ({
  getAllActiveBlogPosts: mockGetAllActiveBlogPosts,
}))

beforeEach(() => {
  mockGetAllPlaces.mockReset()
  mockGetCities.mockReset()
  mockGetCategories.mockReset()
  mockGetAllActiveBlogPosts.mockReset()
  // 기본값: 비어있음
  mockGetAllActiveBlogPosts.mockResolvedValue([])
})

describe('getSiteStats', () => {
  it('모든 필드를 동적 소스에서 집계', async () => {
    mockGetAllPlaces.mockResolvedValue([
      { slug: 'a', city: 'cheonan', category: 'dermatology' },
      { slug: 'b', city: 'cheonan', category: 'dermatology' },
      { slug: 'c', city: 'cheonan', category: 'restaurant' },
      { slug: 'd', city: 'seoul', category: 'interior' },
    ])
    mockGetCities.mockResolvedValue([
      { slug: 'cheonan', name: '천안' },
      { slug: 'seoul', name: '서울' },
    ])
    mockGetCategories.mockResolvedValue(
      Array.from({ length: 83 }, (_, i) => ({ slug: `c${i}`, name: `c${i}` })),
    )

    const { getSiteStats } = await import('@/lib/site-stats')
    const stats = await getSiteStats()

    expect(stats.totalPlaces).toBe(4)
    expect(stats.activeCategories).toBe(3) // dermatology, restaurant, interior
    expect(stats.totalCategories).toBe(83)
    expect(stats.cities).toEqual(['cheonan', 'seoul'])
    expect(stats.activeCities).toEqual(['cheonan', 'seoul'])
  })

  it('currentYear 는 항상 현재 연도', async () => {
    mockGetAllPlaces.mockResolvedValue([])
    mockGetCities.mockResolvedValue([])
    mockGetCategories.mockResolvedValue([])

    const { getSiteStats } = await import('@/lib/site-stats')
    const stats = await getSiteStats()

    expect(stats.currentYear).toBe(new Date().getFullYear())
  })

  it('빈 데이터 — 숫자 0/빈 배열', async () => {
    mockGetAllPlaces.mockResolvedValue([])
    mockGetCities.mockResolvedValue([])
    mockGetCategories.mockResolvedValue([])

    const { getSiteStats } = await import('@/lib/site-stats')
    const stats = await getSiteStats()

    expect(stats.totalPlaces).toBe(0)
    expect(stats.activeCategories).toBe(0)
    expect(stats.activeCities).toEqual([])
    expect(stats.cities).toEqual([])
  })

  it('activeCities 는 실제 업체가 있는 도시만', async () => {
    mockGetAllPlaces.mockResolvedValue([
      { slug: 'a', city: 'cheonan', category: 'derm' },
    ])
    mockGetCities.mockResolvedValue([
      { slug: 'cheonan', name: '천안' },
      { slug: 'seoul', name: '서울' },
      { slug: 'busan', name: '부산' },
    ])
    mockGetCategories.mockResolvedValue([])

    const { getSiteStats } = await import('@/lib/site-stats')
    const stats = await getSiteStats()

    expect(stats.cities).toEqual(['cheonan', 'seoul', 'busan'])
    expect(stats.activeCities).toEqual(['cheonan'])
  })

  it('T-100: totalBlogPosts 는 getAllActiveBlogPosts().length 런타임 계산', async () => {
    mockGetAllPlaces.mockResolvedValue([])
    mockGetCities.mockResolvedValue([])
    mockGetCategories.mockResolvedValue([])
    mockGetAllActiveBlogPosts.mockResolvedValue([
      { city: 'cheonan', sector: 'medical', slug: 'a' },
      { city: 'cheonan', sector: 'food', slug: 'b' },
      { city: 'cheonan', sector: 'medical', slug: 'c' },
    ])

    const { getSiteStats } = await import('@/lib/site-stats')
    const stats = await getSiteStats()
    expect(stats.totalBlogPosts).toBe(3)
  })
})

describe('formatCountClause', () => {
  it('0곳 일 때 placeholder 반환', async () => {
    const { formatCountClause } = await import('@/lib/site-stats')
    expect(formatCountClause(0)).toMatch(/등록\s*예정|등록\s*중/)
  })

  it('n>0 은 "N곳" 형식', async () => {
    const { formatCountClause } = await import('@/lib/site-stats')
    expect(formatCountClause(4)).toBe('4곳')
    expect(formatCountClause(12)).toBe('12곳')
  })
})
