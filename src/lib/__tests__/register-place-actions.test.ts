/**
 * register-place Server Actions 단위 테스트
 * Mock: auth, google-places, supabase server client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({ id: 'user-123', email: 'admin@test.com' })),
  requireAuthForAction: vi.fn(() => ({ id: 'user-123', email: 'admin@test.com' })),
  requireLoggedInForAction: vi.fn(() => ({ id: 'user-123', email: 'admin@test.com' })),
}))

// Mock google-places
const mockSearchPlaceByText = vi.fn()
const mockGetPlaceDetails = vi.fn()
vi.mock('@/lib/google-places', () => ({
  searchPlaceByText: (...args: unknown[]) => mockSearchPlaceByText(...args),
  getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
}))

// Mock supabase server client
// insert() 는 체이닝 가능한 builder 를 반환해야 함 — .select('id').single() 으로 id 회수.
const mockInsert = vi.fn()
const mockSelect = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: (...args: unknown[]) => {
        const result = mockInsert(...args)
        // mockInsert 가 Promise 반환 시 이를 resolve 하여 체이닝 builder 생성
        return {
          select: (_cols: string) => {
            const single = vi.fn(async () => {
              const r = await result
              return {
                data: r?.error ? null : { id: 'inserted-id' },
                error: r?.error ?? null,
              }
            })
            return { single }
          },
          // await insert(...) 패턴 지원 (레거시 테스트)
          then: async (resolve: (v: unknown) => void) => resolve(await result),
        }
      },
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: mockSelect,
        })),
      })),
    })),
  })),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

// ===== searchPlace =====
describe('searchPlace', () => {
  it('성공 시 검색 결과 반환', async () => {
    mockSearchPlaceByText.mockResolvedValue([
      { placeId: 'ChIJ1', name: '테스트', address: '천안시', rating: 4.5, reviewCount: 100 },
    ])

    const { searchPlace } = await import('@/lib/actions/register-place')
    const result = await searchPlace('테스트', '천안')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.length).toBe(1)
      expect(result.data[0].placeId).toBe('ChIJ1')
    }
  })

  it('실패 시 에러 반환', async () => {
    mockSearchPlaceByText.mockResolvedValue(null)

    const { searchPlace } = await import('@/lib/actions/register-place')
    const result = await searchPlace('없는', '천안')

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('검색')
    }
  })
})

// ===== enrichPlace =====
describe('enrichFromGoogle (Phase 11 — 이름+주소로 매칭)', () => {
  it('Google Text Search + Details 성공 시 matched=true + 상세 반환', async () => {
    mockSearchPlaceByText.mockResolvedValue([
      { placeId: 'ChIJ1', name: '테스트의원', address: '충남 천안시 서북구 테스트로 1' },
    ])
    mockGetPlaceDetails.mockResolvedValue({
      name: '테스트의원',
      rating: 4.5,
      reviewCount: 100,
      googleMapsUri: 'https://maps.google.com/?cid=123',
      reviews: [{ text: '좋아요', rating: 5, relativeTime: '1달 전' }],
      photoRefs: [],
    })

    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({
      name: '테스트의원',
      address: '충남 천안시 서북구 테스트로 1',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.matched).toBe(true)
      expect(result.data.googlePlaceId).toBe('ChIJ1')
      expect(result.data.rating).toBe(4.5)
      expect(result.data.googleMapsUri).toBe('https://maps.google.com/?cid=123')
    }
  })

  it('Google 검색 결과 없음 → matched=false (에러 아님, 진행 가능)', async () => {
    mockSearchPlaceByText.mockResolvedValue([])

    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({
      name: '존재하지않는업체',
      address: '충남 천안시 테스트',
    })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.matched).toBe(false)
  })

  it('Details 조회 실패 시 matched=false', async () => {
    mockSearchPlaceByText.mockResolvedValue([
      { placeId: 'ChIJ1', name: 'X', address: 'Y' },
    ])
    mockGetPlaceDetails.mockResolvedValue(null)

    const { enrichFromGoogle } = await import('@/lib/actions/register-place')
    const result = await enrichFromGoogle({ name: 'X', address: 'Y' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.matched).toBe(false)
  })
})

// ===== registerPlace validation =====
const validInput = {
  city: 'cheonan',
  category: 'dermatology',
  googlePlaceId: 'ChIJtest',
  name: '테스트의원',
  slug: 'test-clinic',
  description: '천안시 서북구 위치. 피부과 전문의 3명이 진료하는 피부과 전문 의원입니다.',
  address: '충남 천안시 서북구 테스트로 1',
  services: [{ name: '여드름치료' }],
  faqs: [
    { question: '예약은 어떻게 하나요?', answer: '전화로 예약 가능합니다.' },
    { question: '토요일 진료하나요?', answer: '네, 09:00~13:00 운영합니다.' },
    { question: '주차가 가능한가요?', answer: '건물 내 주차장 이용 가능합니다.' },
  ],
  tags: ['여드름', '레이저'],
}

describe('registerPlace validation', () => {
  it('description 30자 미만 → 에러', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, description: '짧은 설명' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('짧습니다')
  })

  it('FAQ 3개 미만 → 에러', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, faqs: [{ question: 'Q?', answer: 'A' }] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('3개')
  })

  it('FAQ 물음표 없음 → 에러', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({
      ...validInput,
      faqs: [
        { question: '질문1?', answer: 'A' },
        { question: '질문2?', answer: 'A' },
        { question: '물음표없음', answer: 'A' },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('물음표')
  })

  it('서비스 0개 → 에러', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, services: [] })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('서비스')
  })

  it('외부 ID 모두 없음(googlePlace/kakao/naver) + manual=false → 에러 (T-020)', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({
      ...validInput,
      googlePlaceId: undefined,
      kakaoPlaceId: undefined,
      naverPlaceId: undefined,
      manual: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('외부 ID')
  })

  it('manual=true 면 외부 ID 없어도 validation 통과 (T-020)', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    try {
      const result = await registerPlace({
        ...validInput,
        googlePlaceId: undefined,
        manual: true,
      })
      if (!result.success) expect(result.error).not.toContain('외부 ID')
    } catch (err) {
      // DB layer 에서 예외 발생하면 validation 단계는 통과한 것
      expect(String(err)).not.toContain('외부 ID')
    }
  })
})

// ===== registerPlace 성공/실패 =====
describe('registerPlace DB insert', () => {
  it('성공 시 slug 반환', async () => {
    mockSelect.mockResolvedValue({ data: [] })
    mockInsert.mockResolvedValue({ error: null })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace(validInput)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('test-clinic')
  })

  it('슬러그 중복 시 에러 반환', async () => {
    mockSelect.mockResolvedValue({ data: [{ slug: 'test-clinic' }] })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace(validInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('이미 사용 중')
  })

  it('DB 에러 시 실패 반환', async () => {
    mockSelect.mockResolvedValue({ data: [] })
    mockInsert.mockResolvedValue({ error: { message: 'duplicate key' } })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace(validInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('실패')
  })
})
