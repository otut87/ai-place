/**
 * data.supabase.ts 테스트 — Supabase fetch + 시드 데이터 폴백 검증
 *
 * 전략:
 * - Supabase 클라이언트를 mock
 * - Supabase 성공 시: DB 데이터 반환 + camelCase 변환 검증
 * - Supabase 실패 시: data.ts 시드 데이터 폴백 검증
 * - 반환값이 GEO/SEO/AEO 하네스 필수 필드를 모두 가져야 함
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Supabase 모듈 — 체이닝 가능한 mock
function createChainMock(resolveValue: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {}
  const handler = () => chain
  chain.select = vi.fn().mockReturnValue(chain)
  chain.eq = vi.fn().mockReturnValue(chain)
  chain.not = vi.fn().mockReturnValue(chain)
  chain.order = vi.fn().mockReturnValue(chain)
  chain.single = vi.fn().mockReturnValue(chain)
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolveValue))
  // Make the chain thenable (awaitable)
  Object.assign(chain, Promise.resolve(resolveValue))
  return { select: vi.fn().mockReturnValue(chain), _chain: chain }
}

const mockFrom = vi.fn(() => createChainMock({ data: null, error: { message: 'default mock' } }))

vi.mock('@/lib/supabase/read-client', () => ({
  getReadClient: vi.fn(() => ({
    from: mockFrom,
  })),
}))

// ===== 1. 모듈 존재 확인 =====
describe('data.supabase.ts 모듈', () => {
  it('모듈이 존재하고 export 함수를 가짐', async () => {
    const mod = await import('@/lib/data.supabase')
    expect(mod.getPlaces).toBeDefined()
    expect(mod.getPlaceBySlug).toBeDefined()
    expect(mod.getCities).toBeDefined()
    expect(mod.getCategories).toBeDefined()
    expect(mod.getAllPlaces).toBeDefined()
  })

  it('data.ts와 동일한 함수 시그니처', async () => {
    const supabaseMod = await import('@/lib/data.supabase')
    const seedMod = await import('@/lib/data')

    // 핵심 함수 5개가 동일하게 존재
    const fns = ['getPlaces', 'getPlaceBySlug', 'getCities', 'getCategories', 'getAllPlaces'] as const
    for (const fn of fns) {
      expect(typeof supabaseMod[fn], `${fn} missing`).toBe('function')
      expect(typeof seedMod[fn], `seed ${fn} missing`).toBe('function')
    }
  })
})

// ===== 2. Supabase 성공 시 DB 데이터 반환 =====
describe('Supabase 성공 시', () => {
  const mockDbPlace = {
    id: '123',
    slug: 'test-clinic',
    name: '테스트의원',
    name_en: 'Test Clinic',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안시 테스트 위치. 피부과 전문의가 진료하는 피부과 전문 의원입니다.',
    address: '충남 천안시 서북구 테스트로 1',
    phone: '+82-41-000-0000',
    opening_hours: ['Mo-Fr 09:00-18:00'],
    image_url: null,
    rating: 4.5,
    review_count: 100,
    services: [{ name: '여드름치료' }],
    faqs: [{ question: '예약은?', answer: '전화로.' }],
    tags: ['여드름'],
    naver_place_url: 'https://naver.me/test',
    kakao_map_url: null,
    google_business_url: null,
    google_place_id: 'ChIJtest',
    review_summaries: null,
    images: null,
    latitude: 36.8,
    longitude: 127.1,
    owner_id: null,
    status: 'active',
    created_at: '2026-04-15T00:00:00Z',
    updated_at: '2026-04-15T12:00:00Z',
  }

  it('getPlaces → snake_case DB row를 camelCase Place로 변환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: [mockDbPlace], error: null }))

    const { getPlaces } = await import('@/lib/data.supabase')
    const result = await getPlaces('cheonan', 'dermatology')

    expect(result.length).toBeGreaterThan(0)
    const place = result[0]
    // camelCase 변환 확인
    expect(place.slug).toBe('test-clinic')
    expect(place.nameEn).toBe('Test Clinic')
    expect(place.googlePlaceId).toBe('ChIJtest')
    expect(place.naverPlaceUrl).toBe('https://naver.me/test')
    expect(place.lastUpdated).toBe('2026-04-15')
  })

  it('getCities → DB cities 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({
      data: [{ id: '1', slug: 'cheonan', name: '천안', name_en: 'Cheonan', created_at: '2026-04-15T00:00:00Z' }],
      error: null,
    }))

    const { getCities } = await import('@/lib/data.supabase')
    const result = await getCities()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].slug).toBe('cheonan')
    expect(result[0].nameEn).toBe('Cheonan')
  })

  it('getPlaceBySlug → DB place 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: [mockDbPlace], error: null }))

    const { getPlaceBySlug } = await import('@/lib/data.supabase')
    const result = await getPlaceBySlug('cheonan', 'dermatology', 'test-clinic')
    expect(result).toBeDefined()
    expect(result!.slug).toBe('test-clinic')
    expect(result!.nameEn).toBe('Test Clinic')
  })

  it('getAllPlaces → DB + 시드 합쳐서 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: [mockDbPlace], error: null }))

    const { getAllPlaces } = await import('@/lib/data.supabase')
    const result = await getAllPlaces()
    // DB 1건 + 시드(slug 중복 제외) 합산
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].slug).toBe('test-clinic')
  })

  it('getCategories → DB categories 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({
      data: [{ id: '1', slug: 'dermatology', name: '피부과', name_en: 'Dermatology', icon: 'Stethoscope', created_at: '2026-04-15T00:00:00Z' }],
      error: null,
    }))

    const { getCategories } = await import('@/lib/data.supabase')
    const result = await getCategories()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].nameEn).toBe('Dermatology')
    expect(result[0].icon).toBe('Stethoscope')
  })
})

// ===== 3. Supabase 실패 시 시드 데이터 폴백 =====
describe('Supabase 실패 시 폴백', () => {
  it('getPlaces → Supabase 에러 시 시드 데이터 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: null, error: { message: 'connection refused' } }))

    const { getPlaces } = await import('@/lib/data.supabase')
    const result = await getPlaces('cheonan', 'dermatology')

    // 폴백: 시드 데이터에서 천안 피부과 4곳 반환
    expect(result.length).toBe(4)
    expect(result[0].city).toBe('cheonan')
    expect(result[0].category).toBe('dermatology')
  })

  it('getCities → Supabase 에러 시 시드 데이터 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: null, error: { message: 'timeout' } }))

    const { getCities } = await import('@/lib/data.supabase')
    const result = await getCities()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].slug).toBe('cheonan')
  })

  it('getAllPlaces → Supabase 에러 시 시드 데이터 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: null, error: { message: 'service unavailable' } }))

    const { getAllPlaces } = await import('@/lib/data.supabase')
    const result = await getAllPlaces()

    // 폴백: 시드 4곳
    expect(result.length).toBe(4)
  })
})

// ===== 4. GEO/SEO/AEO 필수 필드 보장 =====
describe('폴백 데이터 GEO/SEO/AEO 필수 필드', () => {
  beforeEach(() => {
    // 항상 Supabase 실패 → 폴백
    mockFrom.mockReturnValue(createChainMock({ data: null, error: { message: 'forced fallback' } }))
  })

  it('폴백 Place에 googlePlaceId 존재', async () => {
    const { getAllPlaces } = await import('@/lib/data.supabase')
    const places = await getAllPlaces()
    for (const p of places) {
      expect(p.googlePlaceId, `${p.name}: googlePlaceId 누락`).toBeTruthy()
    }
  })

  it('폴백 Place에 sameAs URL 존재', async () => {
    const { getAllPlaces } = await import('@/lib/data.supabase')
    const places = await getAllPlaces()
    for (const p of places) {
      const has = p.naverPlaceUrl || p.kakaoMapUrl || p.googleBusinessUrl
      expect(has, `${p.name}: sameAs 없음`).toBeTruthy()
    }
  })

  it('폴백 Place에 FAQ 최소 3개', async () => {
    const { getAllPlaces } = await import('@/lib/data.supabase')
    const places = await getAllPlaces()
    for (const p of places) {
      expect(p.faqs.length, `${p.name}: FAQ ${p.faqs.length}개`).toBeGreaterThanOrEqual(3)
    }
  })

  it('폴백 Place description 40~60자', async () => {
    const { getAllPlaces } = await import('@/lib/data.supabase')
    const places = await getAllPlaces()
    for (const p of places) {
      expect(p.description.length, `${p.name}: ${p.description.length}자`).toBeGreaterThanOrEqual(40)
      expect(p.description.length).toBeLessThanOrEqual(60)
    }
  })
})

// ===== 5. 패스스루 함수 (시드 데이터 직접 반환) =====
describe('패스스루 함수 (비교/가이드/키워드)', () => {
  it('getComparisonTopics → 시드 데이터 반환', async () => {
    const { getComparisonTopics } = await import('@/lib/data.supabase')
    const topics = await getComparisonTopics('cheonan', 'dermatology')
    expect(topics.length).toBeGreaterThan(0)
    expect(topics[0].city).toBe('cheonan')
  })

  it('getComparisonPage → 시드 데이터 반환', async () => {
    const { getComparisonPage } = await import('@/lib/data.supabase')
    const page = await getComparisonPage('cheonan', 'dermatology', 'acne-treatment')
    expect(page).toBeDefined()
    expect(page!.summary.length).toBeGreaterThanOrEqual(40)
  })

  it('getAllComparisonTopics → 시드 데이터 반환', async () => {
    const { getAllComparisonTopics } = await import('@/lib/data.supabase')
    const topics = await getAllComparisonTopics()
    expect(topics.length).toBeGreaterThanOrEqual(3)
  })

  it('getGuidePage → 시드 데이터 반환', async () => {
    const { getGuidePage } = await import('@/lib/data.supabase')
    const page = await getGuidePage('cheonan', 'dermatology')
    expect(page).toBeDefined()
    expect(page!.faqs.length).toBeGreaterThanOrEqual(5)
  })

  it('getAllGuidePages → 시드 데이터 반환', async () => {
    const { getAllGuidePages } = await import('@/lib/data.supabase')
    const pages = await getAllGuidePages()
    expect(pages.length).toBeGreaterThan(0)
  })

  it('getCategoryFaqs → 시드 데이터 반환', async () => {
    const { getCategoryFaqs } = await import('@/lib/data.supabase')
    const faqs = await getCategoryFaqs('cheonan', 'dermatology')
    expect(faqs.length).toBeGreaterThan(0)
  })

  it('getKeywordPage → 시드 데이터 반환', async () => {
    const { getKeywordPage } = await import('@/lib/data.supabase')
    const page = await getKeywordPage('cheonan', 'dermatology', 'acne')
    expect(page).toBeDefined()
  })

  it('getAllKeywordPages → 시드 데이터 반환', async () => {
    const { getAllKeywordPages } = await import('@/lib/data.supabase')
    const pages = await getAllKeywordPages()
    expect(pages.length).toBeGreaterThan(0)
  })

  it('getPlaceBySlug 폴백 → 시드 데이터 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: null, error: { message: 'fail' } }))
    const { getPlaceBySlug } = await import('@/lib/data.supabase')
    const result = await getPlaceBySlug('cheonan', 'dermatology', 'dr-evers')
    expect(result).toBeDefined()
    expect(result!.slug).toBe('dr-evers')
  })

  it('getCategories 폴백 → 시드 데이터 반환', async () => {
    mockFrom.mockReturnValueOnce(createChainMock({ data: null, error: { message: 'fail' } }))
    const { getCategories } = await import('@/lib/data.supabase')
    const result = await getCategories()
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].slug).toBe('dermatology')
  })
})

describe('Sector/SchemaType 함수 (시드 폴백)', () => {
  it('getSectors → 시드 데이터 반환', async () => {
    const { getSectors } = await import('@/lib/data.supabase')
    const result = await getSectors()
    expect(result.length).toBe(10)
    expect(result[0].schemaType).toBeTruthy()
  })

  it('getSchemaTypeForCategory → sector에서 schemaType 반환', async () => {
    const { getSchemaTypeForCategory } = await import('@/lib/data.supabase')
    expect(await getSchemaTypeForCategory('dermatology')).toBe('MedicalClinic')
    expect(await getSchemaTypeForCategory('hairsalon')).toBe('BeautySalon')
    expect(await getSchemaTypeForCategory('unknown')).toBe('LocalBusiness')
  })
})

describe('역방향 링크 함수 (시드 폴백)', () => {
  it('getGuidesForPlace → 참조된 업체 결과 반환', async () => {
    const { getGuidesForPlace } = await import('@/lib/data.supabase')
    const guides = await getGuidesForPlace('dr-evers')
    expect(guides.length).toBeGreaterThan(0)
  })

  it('getGuidesForPlace → 미참조 업체는 빈 배열', async () => {
    const { getGuidesForPlace } = await import('@/lib/data.supabase')
    const guides = await getGuidesForPlace('nonexistent')
    expect(guides).toEqual([])
  })

  it('getComparisonsForPlace → 참조된 업체 결과 반환', async () => {
    const { getComparisonsForPlace } = await import('@/lib/data.supabase')
    const comps = await getComparisonsForPlace('dr-evers')
    expect(comps.length).toBeGreaterThan(0)
  })
})
