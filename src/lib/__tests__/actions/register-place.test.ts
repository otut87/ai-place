/**
 * actions/register-place.ts 테스트 — Phase 11 Naver 단일 검색 + Google 보강
 * 대체된 searchPlaceUnified/enrichPlace 테스트는 register-place-actions.test.ts 에 유지.
 * 이 파일은 searchPlaceByNaver / enrichFromGoogle 의 단위 동작 검증에 집중.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: 'u1', email: 'test@test.com' }),
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))

const { mockNaverLocalSearch, mockDetectCategory } = vi.hoisted(() => ({
  mockNaverLocalSearch: vi.fn(),
  mockDetectCategory: vi.fn(),
}))

vi.mock('@/lib/search/naver-local', () => ({ naverLocalSearch: mockNaverLocalSearch }))
vi.mock('@/lib/classification/category-detector', () => ({ detectCategory: mockDetectCategory }))

const { mockSearchByText, mockGetPlaceDetails } = vi.hoisted(() => ({
  mockSearchByText: vi.fn(),
  mockGetPlaceDetails: vi.fn(),
}))
vi.mock('@/lib/google-places', async () => {
  const actual = await vi.importActual<typeof import('@/lib/google-places')>('@/lib/google-places')
  return { ...actual, searchPlaceByText: mockSearchByText, getPlaceDetails: mockGetPlaceDetails }
})

beforeEach(() => {
  mockNaverLocalSearch.mockReset()
  mockDetectCategory.mockReset()
  mockSearchByText.mockReset()
  mockGetPlaceDetails.mockReset()
})

describe('searchPlaceByNaver (Phase 11 — 단일 소스)', () => {
  it('빈 결과 → 성공 + data=[]', async () => {
    mockNaverLocalSearch.mockResolvedValue([])
    const { searchPlaceByNaver } = await import('@/lib/actions/register-place')
    const result = await searchPlaceByNaver('없는업체')
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toEqual([])
    expect(mockDetectCategory).not.toHaveBeenCalled()
  })

  it('각 결과에 detectCategory + cityFromAddress 적용 + 네이버 플레이스 URL 생성', async () => {
    mockNaverLocalSearch.mockResolvedValue([
      {
        title: '차앤박피부과 천안점',
        link: '',
        category: '피부과',
        description: '',
        telephone: '041-523-8889',
        address: '충남 천안시 서북구 불당동 1118',
        roadAddress: '충남 천안시 서북구 불당25로 32',
        latitude: 36.8189,
        longitude: 127.1199,
        raw: {},
      },
    ])
    mockDetectCategory.mockResolvedValue({
      category: 'dermatology', tier: 1, confidence: 0.95, needsReview: false,
    })

    const { searchPlaceByNaver } = await import('@/lib/actions/register-place')
    const result = await searchPlaceByNaver('차앤박피부과 천안')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toHaveLength(1)
    const c = result.data[0]
    expect(c.displayName).toBe('차앤박피부과 천안점')
    expect(c.detectedCategorySlug).toBe('dermatology')
    expect(c.detectedCategoryTier).toBe(1)
    expect(c.detectedCategoryConfidence).toBeCloseTo(0.95, 2)
    expect(c.detectedCitySlug).toBe('cheonan')
    expect(c.phone).toBe('041-523-8889')
    expect(c.naverPlaceUrl).toContain('place/search')
    expect(c.naverPlaceUrl).toContain(encodeURIComponent('차앤박피부과 천안점'))
  })

  it('detect 실패 → detectedCategorySlug=null, detectedCitySlug 는 주소 파싱 유지', async () => {
    mockNaverLocalSearch.mockResolvedValue([
      {
        title: '이상한업체', link: '', category: '',
        description: '', telephone: null,
        address: '알수없는 주소', roadAddress: null,
        latitude: 0, longitude: 0, raw: {},
      },
    ])
    mockDetectCategory.mockResolvedValue({
      category: null, tier: null, confidence: 0, needsReview: true,
    })
    const { searchPlaceByNaver } = await import('@/lib/actions/register-place')
    const result = await searchPlaceByNaver('x')
    if (!result.success) return
    expect(result.data[0].detectedCategorySlug).toBeNull()
    expect(result.data[0].detectedCitySlug).toBeNull()
  })
})

describe('enrichFromGoogle (Phase 11)', () => {
  it('Text Search 결과 없음 → matched=false (에러 아님)', async () => {
    mockSearchByText.mockResolvedValue([])
    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({ name: 'X', address: 'Y' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.matched).toBe(false)
  })

  it('Text Search 성공 + Details 실패 → matched=false', async () => {
    mockSearchByText.mockResolvedValue([{ placeId: 'g1', name: 'X', address: 'Y' }])
    mockGetPlaceDetails.mockResolvedValue(null)
    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({ name: 'X', address: 'Y' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.matched).toBe(false)
  })

  it('Text Search + Details 모두 성공 → matched=true + googlePlaceId', async () => {
    mockSearchByText.mockResolvedValue([{ placeId: 'g1', name: '테스트', address: '충남' }])
    mockGetPlaceDetails.mockResolvedValue({
      name: '테스트', nameEn: 'Test', rating: 4.5, reviewCount: 100,
      phone: '041-000-0000', openingHours: ['월요일: 09:00 ~ 18:00'],
      reviews: [{ text: '좋아요', rating: 5, relativeTime: '1달 전' }],
      photoRefs: [],
      googleMapsUri: 'https://maps.google.com/?cid=1',
    })
    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({ name: '테스트', address: '충남' })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.matched).toBe(true)
    expect(result.data.googlePlaceId).toBe('g1')
    expect(result.data.rating).toBe(4.5)
    expect(result.data.reviews).toHaveLength(1)
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

describe('searchPlace (legacy Google 단일 — 유지)', () => {
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
