import { describe, it, expect, vi } from 'vitest'

const mockGetCities = vi.fn().mockResolvedValue([{ slug: 'cheonan', name: '천안' }])
const mockGetCategories = vi.fn().mockResolvedValue([{ slug: 'dermatology', name: '피부과', sector: 'medical' }])
const mockGetSectors = vi.fn().mockResolvedValue([{ slug: 'medical', name: '의료' }])

vi.mock('@/lib/data', () => ({
  getCities: () => mockGetCities(),
  getCategories: () => mockGetCategories(),
  getSectors: () => mockGetSectors(),
}))

describe('cached-data', () => {
  it('cachedCities 는 getCities 결과 그대로 반환', async () => {
    const { cachedCities } = await import('@/lib/admin/cached-data')
    const r = await cachedCities()
    expect(r).toEqual([{ slug: 'cheonan', name: '천안' }])
  })

  it('cachedCategories 도 passthrough', async () => {
    const { cachedCategories } = await import('@/lib/admin/cached-data')
    const r = await cachedCategories()
    expect(r[0].slug).toBe('dermatology')
  })

  it('cachedSectors passthrough', async () => {
    const { cachedSectors } = await import('@/lib/admin/cached-data')
    const r = await cachedSectors()
    expect(r[0].slug).toBe('medical')
  })
})
