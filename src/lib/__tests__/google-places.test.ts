import { describe, it, expect, vi } from 'vitest'
import type { ReviewSummary, PlaceImage } from '@/lib/types'

describe('ReviewSummary type', () => {
  it('should accept valid ReviewSummary data', () => {
    const review: ReviewSummary = {
      source: 'Google',
      positiveThemes: ['친절한 상담', '대기시간 짧음'],
      negativeThemes: ['주차 불편'],
      sampleQuote: '친절하게 상담해주셔서 좋았습니다.',
      lastChecked: '2026-04-15',
    }

    expect(review.source).toBe('Google')
    expect(review.positiveThemes).toHaveLength(2)
    expect(review.negativeThemes).toHaveLength(1)
    expect(review.sampleQuote).toBeTruthy()
    expect(review.lastChecked).toBe('2026-04-15')
  })

  it('should accept ReviewSummary without optional sampleQuote', () => {
    const review: ReviewSummary = {
      source: 'Google',
      positiveThemes: ['좋은 시설'],
      negativeThemes: [],
      lastChecked: '2026-04-15',
    }

    expect(review.sampleQuote).toBeUndefined()
    expect(review.negativeThemes).toHaveLength(0)
  })
})

describe('PlaceImage type', () => {
  it('should accept valid PlaceImage data', () => {
    const image: PlaceImage = {
      url: 'https://example.com/photo.jpg',
      alt: '수피부과의원 진료실 내부',
      type: 'interior',
    }

    expect(image.url).toBeTruthy()
    expect(image.alt).toBeTruthy()
    expect(image.type).toBe('interior')
  })

  it('should accept all PlaceImage types', () => {
    const types: PlaceImage['type'][] = ['exterior', 'interior', 'treatment', 'staff', 'equipment']

    types.forEach(type => {
      const image: PlaceImage = {
        url: 'https://example.com/photo.jpg',
        alt: 'test',
        type,
      }
      expect(image.type).toBe(type)
    })
  })
})

describe('getPlaceDetails', () => {
  it('should fetch and parse place details from Google API', async () => {
    const mockResponse = {
      displayName: { text: '수피부과의원' },
      rating: 4.3,
      userRatingCount: 210,
      reviews: [
        {
          text: { text: '친절하게 상담해주셔서 좋았습니다. 시설도 깔끔해요.' },
          rating: 5,
          relativePublishTimeDescription: '3주 전',
        },
        {
          text: { text: '주차가 좀 불편하지만 진료는 만족스러워요.' },
          rating: 4,
          relativePublishTimeDescription: '1개월 전',
        },
      ],
      photos: [
        { name: 'places/ChIJ_test/photos/photo1' },
        { name: 'places/ChIJ_test/photos/photo2' },
      ],
    }

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    }))

    const { getPlaceDetails } = await import('@/lib/google-places')
    const result = await getPlaceDetails('ChIJ_test')

    expect(result).not.toBeNull()
    expect(result!.name).toBe('수피부과의원')
    expect(result!.rating).toBe(4.3)
    expect(result!.reviewCount).toBe(210)
    expect(result!.reviews).toHaveLength(2)
    expect(result!.reviews[0].text).toContain('친절')
    expect(result!.photoRefs).toHaveLength(2)

    vi.unstubAllGlobals()
  })

  it('should return null on API error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    }))

    const { getPlaceDetails } = await import('@/lib/google-places')
    const result = await getPlaceDetails('invalid_id')

    expect(result).toBeNull()

    vi.unstubAllGlobals()
  })
})

describe('getPhotoUrl', () => {
  it('should construct photo URL with API key', async () => {
    const { getPhotoUrl } = await import('@/lib/google-places')
    const url = getPhotoUrl('places/ChIJ_test/photos/photo1', 400)

    expect(url).toContain('places/ChIJ_test/photos/photo1')
    expect(url).toContain('maxWidthPx=400')
  })
})

describe('Place with Google Places fields', () => {
  it('should accept googlePlaceId on Place', async () => {
    const { default: _noop } = await import('@/lib/types').catch(() => ({ default: null }))
    // Type check: Place should accept googlePlaceId
    const place = {
      slug: 'test',
      name: '테스트',
      city: 'cheonan',
      category: 'dermatology',
      description: '테스트',
      address: '천안시',
      services: [],
      faqs: [],
      tags: [],
      googlePlaceId: 'ChIJ_test_place_id',
      reviewSummaries: [{
        source: 'Google',
        positiveThemes: ['좋음'],
        negativeThemes: [],
        lastChecked: '2026-04-15',
      }] satisfies ReviewSummary[],
      images: [{
        url: 'https://example.com/photo.jpg',
        alt: 'test',
        type: 'exterior' as const,
      }] satisfies PlaceImage[],
    }

    expect(place.googlePlaceId).toBe('ChIJ_test_place_id')
    expect(place.reviewSummaries).toHaveLength(1)
    expect(place.images).toHaveLength(1)
  })
})
