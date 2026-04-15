/**
 * register-place Server Actions 단위 테스트
 * Mock: auth, google-places, supabase server client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({ id: 'user-123', email: 'admin@test.com' })),
}))

// Mock google-places
const mockSearchPlaceByText = vi.fn()
const mockGetPlaceDetails = vi.fn()
vi.mock('@/lib/google-places', () => ({
  searchPlaceByText: (...args: unknown[]) => mockSearchPlaceByText(...args),
  getPlaceDetails: (...args: unknown[]) => mockGetPlaceDetails(...args),
}))

// Mock supabase server client
const mockInsert = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: mockInsert,
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
describe('enrichPlace', () => {
  it('성공 시 상세 정보 반환', async () => {
    mockGetPlaceDetails.mockResolvedValue({
      name: '테스트의원',
      rating: 4.5,
      reviewCount: 100,
      googleMapsUri: 'https://maps.google.com/?cid=123',
      reviews: [],
      photoRefs: [],
    })

    const { enrichPlace } = await import('@/lib/actions/register-place')
    const result = await enrichPlace('ChIJ1')

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('테스트의원')
      expect(result.data.rating).toBe(4.5)
      expect(result.data.googleMapsUri).toBe('https://maps.google.com/?cid=123')
    }
  })

  it('실패 시 에러 반환', async () => {
    mockGetPlaceDetails.mockResolvedValue(null)

    const { enrichPlace } = await import('@/lib/actions/register-place')
    const result = await enrichPlace('bad-id')

    expect(result.success).toBe(false)
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
  it('description 40자 미만 → 에러', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, description: '짧은 설명' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('40~60자')
  })

  it('description 60자 초과 → 에러', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, description: '가'.repeat(61) })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('40~60자')
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

  it('googlePlaceId 없음 → 에러', async () => {
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace({ ...validInput, googlePlaceId: '' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Google Place ID')
  })
})

// ===== registerPlace 성공/실패 =====
describe('registerPlace DB insert', () => {
  it('성공 시 slug 반환', async () => {
    mockInsert.mockResolvedValue({ error: null })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace(validInput)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.slug).toBe('test-clinic')
  })

  it('DB 에러 시 실패 반환', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'duplicate key' } })
    const { registerPlace } = await import('@/lib/actions/register-place')
    const result = await registerPlace(validInput)
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('실패')
  })
})
