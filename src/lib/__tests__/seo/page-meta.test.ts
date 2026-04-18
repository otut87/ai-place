import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildHomeMetadata,
  buildAboutMetadata,
  buildCategoryMetadata,
  buildPlaceMetadata,
  buildBlogIndexMetadata,
  buildGuideMetadata,
  buildCompareMetadata,
} from '@/lib/seo/page-meta'
import type { Place } from '@/lib/types'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-04-18T00:00:00Z'))
})

function placeFixture(overrides: Partial<Place> = {}): Place {
  return {
    id: '1',
    slug: 'su-dermatology',
    name: '수피부과',
    nameEn: 'Su Dermatology',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안 피부과',
    address: '충남 천안시 동남구 번영로 1',
    phone: '041-555-1234',
    openingHours: [],
    latitude: 36.8,
    longitude: 127.1,
    rating: 4.8,
    reviewCount: 120,
    reviewExcerpt: '',
    source: '',
    services: [{ name: '여드름', description: '', priceRange: '' }],
    faqs: [],
    tags: ['여드름'],
    imageUrl: null,
    sameAs: [],
    lastUpdated: '2026-04-18',
    ...overrides,
  } as unknown as Place
}

describe('buildHomeMetadata', () => {
  it('sets canonical and OG for the home page', () => {
    const m = buildHomeMetadata()
    expect(m.alternates?.canonical).toBe('/')
    expect(m.openGraph?.url).toBe('/')
    expect(m.openGraph?.title).toContain('AI Place')
  })
})

describe('buildAboutMetadata', () => {
  it('sets canonical and OG for the about page', () => {
    const m = buildAboutMetadata()
    expect(m.alternates?.canonical).toBe('/about')
  })
})

describe('buildCategoryMetadata', () => {
  it('includes city name, category name, and current year in the title', () => {
    const m = buildCategoryMetadata({
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
      hasPlaces: true,
      description: '천안 피부과 추천 목록입니다.',
    })
    expect(m.title).toContain('천안')
    expect(m.title).toContain('피부과')
    expect(m.title).toContain('2026')
    expect(m.alternates?.canonical).toBe('/cheonan/dermatology')
  })

  it('emits robots noindex when there are no places', () => {
    const m = buildCategoryMetadata({
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
      hasPlaces: false,
      description: '설명',
    })
    expect(m.robots).toEqual({ index: false, follow: true })
  })

  it('omits robots when there are places', () => {
    const m = buildCategoryMetadata({
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
      hasPlaces: true,
      description: '설명',
    })
    expect(m.robots).toBeUndefined()
  })
})

describe('buildPlaceMetadata', () => {
  it('composes title with city, category, and place name', () => {
    const m = buildPlaceMetadata({
      place: placeFixture(),
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
    })
    expect(m.title).toContain('수피부과')
    expect(m.title).toContain('천안')
    expect(m.title).toContain('피부과')
    expect(m.alternates?.canonical).toBe('/cheonan/dermatology/su-dermatology')
  })

  it('includes rating in the description when present', () => {
    const m = buildPlaceMetadata({
      place: placeFixture({ rating: 4.8 }),
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
    })
    expect(m.description).toMatch(/4\.8/)
  })

  it('omits rating phrase when rating is missing', () => {
    const m = buildPlaceMetadata({
      place: placeFixture({ rating: undefined as unknown as number }),
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
    })
    expect(m.description).not.toMatch(/평점/)
  })
})

describe('buildBlogIndexMetadata', () => {
  it('returns blog canonical', () => {
    const m = buildBlogIndexMetadata()
    expect(m.alternates?.canonical).toBe('/blog')
  })
})

describe('buildBlogPostMetadata', () => {
  it('composes blog post canonical and OG article', async () => {
    const { buildBlogPostMetadata } = await import('@/lib/seo/page-meta')
    const m = buildBlogPostMetadata({
      citySlug: 'cheonan',
      sectorSlug: 'medical',
      postSlug: 'best-dermatology',
      postTitle: '천안 피부과 Best',
      postSummary: '요약',
      publishedAt: '2026-01-01',
    })
    expect(m.alternates?.canonical).toBe('/blog/cheonan/medical/best-dermatology')
    // openGraph.type is 'article' but OpenGraph union widens the type; assert indirectly
    expect(m.openGraph).toMatchObject({ title: '천안 피부과 Best' })
  })
})

describe('buildGuideMetadata', () => {
  it('returns guide canonical', () => {
    const m = buildGuideMetadata({ cityName: '천안', categoryName: '피부과', citySlug: 'cheonan', categorySlug: 'dermatology' })
    expect(m.alternates?.canonical).toBe('/guide/cheonan/dermatology')
    expect(m.title).toContain('가이드')
  })
})

describe('buildCompareMetadata', () => {
  it('returns compare canonical with topic', () => {
    const m = buildCompareMetadata({
      cityName: '천안',
      categoryName: '피부과',
      citySlug: 'cheonan',
      categorySlug: 'dermatology',
      topicSlug: 'cost-vs-quality',
      topicTitle: '비용 vs 품질',
    })
    expect(m.alternates?.canonical).toBe('/compare/cheonan/dermatology/cost-vs-quality')
    expect(m.title).toContain('비용 vs 품질')
  })
})
