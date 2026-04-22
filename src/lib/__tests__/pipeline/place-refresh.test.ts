/**
 * Phase 11 — place-refresh 파이프라인 핸들러.
 * Google Places API + Haiku LLM 은 모두 mocking.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// === mocks ===
const mockAdmin = {
  from: vi.fn(),
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => mockAdmin,
}))

vi.mock('@/lib/google-places', () => ({
  getPlaceDetails: vi.fn(),
}))

vi.mock('@/lib/ai/summarize-reviews', async () => {
  const actual = await vi.importActual('@/lib/ai/summarize-reviews')
  return {
    ...actual,
    summarizeReviewsForSource: vi.fn(),
  }
})

import { runPlaceEnrichGoogle, runPlaceSummarizeGoogleReviews } from '@/lib/pipeline/place-refresh'
import { getPlaceDetails } from '@/lib/google-places'
import { summarizeReviewsForSource } from '@/lib/ai/summarize-reviews'

function mockSelectSingle(returnValue: unknown) {
  const single = vi.fn().mockResolvedValue({ data: returnValue, error: null })
  const eq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq })
  return select
}

function mockUpdate() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  const update = vi.fn().mockReturnValue({ eq })
  return update
}

describe('runPlaceEnrichGoogle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('place 가 없으면 에러 throw', async () => {
    mockAdmin.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })
    await expect(runPlaceEnrichGoogle('nope')).rejects.toThrow('place not found')
  })

  it('google_place_id 없으면 빈 결과 반환', async () => {
    mockAdmin.from.mockReturnValue({
      select: mockSelectSingle({
        id: 'p1',
        slug: 's1',
        name: 'X',
        category: 'c',
        google_place_id: null,
        review_count: null,
        review_summaries: null,
      }),
    })
    const r = await runPlaceEnrichGoogle('p1')
    expect(r.slug).toBe('s1')
    expect(r.rating).toBeNull()
    expect(r.reviewsFetched).toBe(0)
    expect(r.summaryWritten).toBe(false)
  })

  it('신규 등록 (review_count=null, summary 없음) → Haiku 호출 + summary 작성', async () => {
    const updateFn = mockUpdate()
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1',
        slug: 's1',
        name: 'X',
        category: 'c',
        google_place_id: 'gp1',
        review_count: null,
        review_summaries: null,
      }),
      update: updateFn,
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4.7, reviewCount: 230,
      reviews: [{ text: 'good', rating: 5, relativeTime: '1달 전', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '',
      googleMapsUri: 'https://maps.google/x', photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    vi.mocked(summarizeReviewsForSource).mockResolvedValue({
      summary: { source: 'Google', positiveThemes: ['친절'], negativeThemes: [], lastChecked: '2026-04-22' },
      inputTokens: 500, outputTokens: 50, latencyMs: 123,
    })

    const r = await runPlaceEnrichGoogle('p1')
    expect(r.rating).toBe(4.7)
    expect(r.reviewCount).toBe(230)
    expect(r.reviewsChanged).toBe(true)  // null → 230
    expect(r.summaryWritten).toBe(true)
    expect(summarizeReviewsForSource).toHaveBeenCalledTimes(1)
  })

  it('reviewCount 변경 없고 summary 있으면 Haiku 호출 skip', async () => {
    const updateFn = mockUpdate()
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp1',
        review_count: 100,  // 기존 100
        review_summaries: [{
          source: 'Google', positiveThemes: ['기존'], negativeThemes: [], lastChecked: '2026-04-15',
        }],
      }),
      update: updateFn,
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4.5, reviewCount: 100,  // 변화 없음
      reviews: [{ text: 'good', rating: 5, relativeTime: '1달', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)

    const r = await runPlaceEnrichGoogle('p1')
    expect(r.reviewsChanged).toBe(false)
    expect(r.summaryWritten).toBe(false)
    expect(r.summarySkipReason).toBe('unchanged')
    expect(summarizeReviewsForSource).not.toHaveBeenCalled()
  })

  it('reviewCount 증가하면 Haiku 재호출', async () => {
    const updateFn = mockUpdate()
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp1',
        review_count: 100,  // 기존 100
        review_summaries: [{
          source: 'Google', positiveThemes: ['기존'], negativeThemes: [], lastChecked: '2026-04-15',
        }],
      }),
      update: updateFn,
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4.6, reviewCount: 105,  // +5 증가
      reviews: [{ text: 'new review', rating: 5, relativeTime: '3일', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    vi.mocked(summarizeReviewsForSource).mockResolvedValue({
      summary: { source: 'Google', positiveThemes: ['신규 언급'], negativeThemes: [], lastChecked: '2026-04-22' },
      inputTokens: 500, outputTokens: 50, latencyMs: 123,
    })

    const r = await runPlaceEnrichGoogle('p1')
    expect(r.reviewsChanged).toBe(true)
    expect(r.summaryWritten).toBe(true)
    expect(summarizeReviewsForSource).toHaveBeenCalledTimes(1)
  })

  it('reviewCount 동일하지만 summary 없으면 첫 요약 수행', async () => {
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp1',
        review_count: 50,
        review_summaries: null,  // summary 없음 (과거 실패 복구 케이스)
      }),
      update: mockUpdate(),
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4.2, reviewCount: 50,  // 동일
      reviews: [{ text: 'ok', rating: 4, relativeTime: '7일', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    vi.mocked(summarizeReviewsForSource).mockResolvedValue({
      summary: { source: 'Google', positiveThemes: ['보통'], negativeThemes: [], lastChecked: '2026-04-22' },
      inputTokens: 500, outputTokens: 50, latencyMs: 123,
    })

    const r = await runPlaceEnrichGoogle('p1')
    expect(r.reviewsChanged).toBe(false)
    expect(r.summaryWritten).toBe(true)
    expect(summarizeReviewsForSource).toHaveBeenCalledTimes(1)
  })

  it('Google reviews 배열이 비어있으면 Haiku 호출 skip', async () => {
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp1',
        review_count: null,
        review_summaries: null,
      }),
      update: mockUpdate(),
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: null, reviewCount: 0, reviews: [],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '', photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)

    const r = await runPlaceEnrichGoogle('p1')
    expect(r.summaryWritten).toBe(false)
    expect(r.summarySkipReason).toBe('no_reviews')
    expect(summarizeReviewsForSource).not.toHaveBeenCalled()
  })
})

describe('runPlaceSummarizeGoogleReviews', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('google_place_id 없으면 summaryWritten=false, reason=no_google_place_id', async () => {
    mockAdmin.from.mockReturnValue({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: null, review_summaries: null,
      }),
    })
    const r = await runPlaceSummarizeGoogleReviews('p1')
    expect(r.summaryWritten).toBe(false)
    expect(r.reason).toBe('no_google_place_id')
  })

  it('Google 리뷰 0건이면 skip', async () => {
    mockAdmin.from.mockReturnValue({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp', review_summaries: null,
      }),
    })
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4, reviewCount: 0, reviews: [],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    const r = await runPlaceSummarizeGoogleReviews('p1')
    expect(r.summaryWritten).toBe(false)
    expect(r.reason).toBe('no_reviews')
  })

  it('fresh 한 기존 요약이 있으면 skip (reason=fresh)', async () => {
    const today = new Date().toISOString().slice(0, 10)
    mockAdmin.from.mockReturnValue({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp',
        review_summaries: [{
          source: 'Google',
          positiveThemes: ['a'],
          negativeThemes: [],
          lastChecked: today,
        }],
      }),
    })
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4, reviewCount: 5,
      reviews: [{ text: 'good', rating: 5, relativeTime: '1달', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    const r = await runPlaceSummarizeGoogleReviews('p1')
    expect(r.summaryWritten).toBe(false)
    expect(r.reason).toBe('fresh')
  })

  it('stale 요약이면 Haiku 호출 + DB 업데이트', async () => {
    const updateFn = mockUpdate()
    mockAdmin.from.mockImplementation(() => ({
      select: mockSelectSingle({
        id: 'p1', slug: 's1', name: 'X', category: 'c',
        google_place_id: 'gp',
        review_summaries: [{
          source: 'Google', positiveThemes: [], negativeThemes: [], lastChecked: '2020-01-01',
        }],
      }),
      update: updateFn,
    }))
    vi.mocked(getPlaceDetails).mockResolvedValue({
      name: 'X', nameEn: 'X', rating: 4, reviewCount: 5,
      reviews: [{ text: 'good', rating: 5, relativeTime: '1달', language: 'ko' }],
      phone: '', websiteUri: '', openingHours: [], editorialSummary: '', googleMapsUri: '',
      photoRefs: [],
    } as unknown as Awaited<ReturnType<typeof getPlaceDetails>>)
    vi.mocked(summarizeReviewsForSource).mockResolvedValue({
      summary: {
        source: 'Google',
        positiveThemes: ['친절'],
        negativeThemes: [],
        lastChecked: '2026-04-19',
      },
      inputTokens: 500,
      outputTokens: 50,
      latencyMs: 123,
    })

    const r = await runPlaceSummarizeGoogleReviews('p1')
    expect(r.summaryWritten).toBe(true)
    expect(updateFn).toHaveBeenCalled()
  })
})
