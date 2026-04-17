/**
 * actions/register-place.ts 테스트 (T-018/T-020)
 *
 * 기존 광범위 테스트는 register-place-actions.test.ts 에 있음.
 * 이 파일은 harness 경로 미러 (actions/register-place.ts → __tests__/actions/register-place.test.ts)
 * 를 만족시키기 위한 T-018/T-020 신규 기능 검증에 집중.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com' }),
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))

const { mockUnifiedSearch, mockDetectCategory } = vi.hoisted(() => ({
  mockUnifiedSearch: vi.fn(),
  mockDetectCategory: vi.fn(),
}))

vi.mock('@/lib/search/unified', () => ({ unifiedSearch: mockUnifiedSearch }))
vi.mock('@/lib/classification/category-detector', () => ({ detectCategory: mockDetectCategory }))

const { mockSearchByText, mockGetPlaceDetails } = vi.hoisted(() => ({
  mockSearchByText: vi.fn(),
  mockGetPlaceDetails: vi.fn(),
}))
vi.mock('@/lib/google-places', async () => {
  const actual = await vi.importActual<typeof import('@/lib/google-places')>('@/lib/google-places')
  return { ...actual, searchPlaceByText: mockSearchByText, getPlaceDetails: mockGetPlaceDetails }
})

const { mockSearchKakao } = vi.hoisted(() => ({ mockSearchKakao: vi.fn() }))
vi.mock('@/lib/naver-kakao-search', () => ({ searchKakaoPlace: mockSearchKakao }))

beforeEach(() => {
  mockSearchByText.mockReset()
  mockGetPlaceDetails.mockReset()
  mockSearchKakao.mockReset()
})

beforeEach(() => {
  mockUnifiedSearch.mockReset()
  mockDetectCategory.mockReset()
})

describe('searchPlaceUnified (T-018)', () => {
  it('빈 결과 → 성공 + data=[]', async () => {
    mockUnifiedSearch.mockResolvedValue([])
    const { searchPlaceUnified } = await import('@/lib/actions/register-place')
    const result = await searchPlaceUnified('없는업체')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
    expect(mockDetectCategory).not.toHaveBeenCalled()
  })

  it('후보 마다 detectCategory + cityFromAddress 적용', async () => {
    mockUnifiedSearch.mockResolvedValue([
      {
        kakaoPlaceId: 'k1',
        displayName: '차앤박피부과 천안점',
        roadAddress: '충남 천안시 서북구 불당25로 32',
        jibunAddress: null,
        latitude: 36.8189,
        longitude: 127.1199,
        phone: '041-523-8889',
        sources: ['kakao'],
        sameAs: [],
        kakaoCategory: '의료,건강 > 병원 > 피부과',
        raw: {},
      },
    ])
    mockDetectCategory.mockResolvedValue({
      category: 'dermatology', tier: 1, confidence: 0.95, needsReview: false,
    })

    const { searchPlaceUnified } = await import('@/lib/actions/register-place')
    const result = await searchPlaceUnified('차앤박피부과 천안')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(1)
    const c = result.data[0]
    expect(c.detectedCategorySlug).toBe('dermatology')
    expect(c.detectedCategoryTier).toBe(1)
    expect(c.detectedCategoryConfidence).toBeCloseTo(0.95, 2)
    expect(c.detectedCitySlug).toBe('cheonan') // "천안시" 주소에서 추론
    expect(mockDetectCategory).toHaveBeenCalledOnce()
  })

  it('좌표 유효하면서 detect 실패한 경우 → detectedCitySlug 는 주소 기반 동작', async () => {
    mockUnifiedSearch.mockResolvedValue([
      {
        kakaoPlaceId: 'k1', displayName: '이상한업체',
        roadAddress: '충남 천안시 서북구 불당25로 1',
        jibunAddress: null, latitude: 36.8, longitude: 127.1,
        phone: null, sources: ['kakao'], sameAs: [], raw: {},
      },
    ])
    mockDetectCategory.mockResolvedValue({ category: null, tier: null, confidence: 0, needsReview: true })
    const { searchPlaceUnified } = await import('@/lib/actions/register-place')
    const result = await searchPlaceUnified('x')
    if (!result.success) return
    expect(result.data[0].detectedCitySlug).toBe('cheonan') // "천안시" 주소 파싱
  })

  it('detect 실패 (null) → detectedCategorySlug=null + needsReview 반영', async () => {
    mockUnifiedSearch.mockResolvedValue([
      {
        kakaoPlaceId: 'k1',
        displayName: '이상한업체',
        roadAddress: '어딘가',
        jibunAddress: null,
        latitude: 0, longitude: 0,
        phone: null,
        sources: ['kakao'],
        sameAs: [],
        raw: {},
      },
    ])
    mockDetectCategory.mockResolvedValue({
      category: null, tier: null, confidence: 0, needsReview: true,
    })

    const { searchPlaceUnified } = await import('@/lib/actions/register-place')
    const result = await searchPlaceUnified('x')
    if (!result.success) return
    expect(result.data[0].detectedCategorySlug).toBeNull()
    expect(result.data[0].detectedCitySlug).toBeNull() // "어딘가" 에는 "천안시" 없음
  })
})

describe('enrichPlace', () => {
  it('Google details null → 에러', async () => {
    mockGetPlaceDetails.mockResolvedValue(null)
    mockSearchKakao.mockResolvedValue(null)
    const { enrichPlace } = await import('@/lib/actions/register-place')
    const result = await enrichPlace('x', '이름')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('상세 정보')
  })

  it('Google 성공 + Kakao URL 매칭', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      name: '테스트', nameEn: 'Test', rating: 4.5, reviewCount: 100,
      phone: '041-000-0000', openingHours: ['월요일: 09:00 ~ 18:00'],
      reviews: [{ text: '좋아요', rating: 5 }],
    })
    mockSearchKakao.mockResolvedValue({ placeUrl: 'http://place.map.kakao.com/x' })
    const { enrichPlace } = await import('@/lib/actions/register-place')
    const result = await enrichPlace('gp1', '테스트')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('테스트')
      expect(result.data.rating).toBe(4.5)
      expect(result.data.kakaoMapUrl).toBe('http://place.map.kakao.com/x')
      expect(result.data.reviews).toHaveLength(1)
    }
  })
})

describe('getAdminOptions', () => {
  it('cities/sectors/categories 3개 키 반환', async () => {
    const { getAdminOptions } = await import('@/lib/actions/register-place')
    const opts = await getAdminOptions()
    expect(Array.isArray(opts.cities)).toBe(true)
    expect(Array.isArray(opts.sectors)).toBe(true)
    expect(Array.isArray(opts.categories)).toBe(true)
    expect(opts.cities.length).toBeGreaterThan(0)
    expect(opts.categories[0]).toHaveProperty('slug')
    expect(opts.categories[0]).toHaveProperty('sector')
  })
})

describe('searchPlace (legacy Google 단일)', () => {
  it('성공 시 결과 배열 반환', async () => {
    mockSearchByText.mockResolvedValue([
      { placeId: 'g1', name: '테스트', address: '주소' },
    ])
    const { searchPlace } = await import('@/lib/actions/register-place')
    const result = await searchPlace('테스트', '천안')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toHaveLength(1)
  })

  it('null 반환 시 에러', async () => {
    mockSearchByText.mockResolvedValue(null)
    const { searchPlace } = await import('@/lib/actions/register-place')
    const result = await searchPlace('x', '천안')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Google Places')
  })
})
