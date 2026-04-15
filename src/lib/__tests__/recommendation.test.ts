/**
 * generateRecommendation 단위 테스트
 * Mock: auth, @anthropic-ai/sdk
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(() => ({ id: 'user-123', email: 'admin@test.com' })),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

// Mock supabase (needed for module loading)
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => ({ insert: vi.fn() })),
  })),
}))

// Mock google-places
vi.mock('@/lib/google-places', () => ({
  searchPlaceByText: vi.fn(),
  getPlaceDetails: vi.fn(),
}))

// Mock naver-kakao
vi.mock('@/lib/naver-kakao-search', () => ({
  searchKakaoPlace: vi.fn(),
}))

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('generateRecommendation', () => {
  const input = {
    name: '수피부과의원',
    category: 'dermatology',
    address: '충남 천안시 서북구 동서대로 125-3',
    services: [{ name: '여드름치료' }, { name: '피부레이저' }],
    rating: 4.3,
    reviewCount: 210,
  }

  it('성공 시 추천 데이터 반환', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify({
          recommendedFor: ['여드름 치료 필요한 분', '건강보험 적용 원하는 분'],
          strengths: ['피부질환 중심 진료', '전문의 3명'],
          placeType: '질환치료형',
          recommendationNote: '천안에서 피부질환 보험 진료가 필요하다면 추천되는 피부과.',
        }),
      }],
    })

    const { generateRecommendation } = await import('@/lib/actions/register-place')
    const result = await generateRecommendation(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recommendedFor).toHaveLength(2)
      expect(result.data.strengths).toHaveLength(2)
      expect(result.data.placeType).toBe('질환치료형')
      expect(result.data.recommendationNote).toBeTruthy()
    }
  })

  it('JSON이 코드블록으로 감싸진 경우에도 파싱', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '```json\n{"recommendedFor":["A"],"strengths":["B"],"placeType":"종합형","recommendationNote":"테스트"}\n```',
      }],
    })

    const { generateRecommendation } = await import('@/lib/actions/register-place')
    const result = await generateRecommendation(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recommendedFor).toEqual(['A'])
    }
  })

  it('불완전 JSON (일부 필드 누락) → 빈 배열로 폴백', async () => {
    mockCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: '{"placeType":"종합형","recommendationNote":"테스트"}',
      }],
    })

    const { generateRecommendation } = await import('@/lib/actions/register-place')
    const result = await generateRecommendation(input)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.recommendedFor).toEqual([])
      expect(result.data.strengths).toEqual([])
      expect(result.data.placeType).toBe('종합형')
    }
  })

  it('JSON 파싱 불가 → 에러', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })

    const { generateRecommendation } = await import('@/lib/actions/register-place')
    const result = await generateRecommendation(input)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('파싱')
  })

  it('API 호출 실패 → 에러', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'))

    const { generateRecommendation } = await import('@/lib/actions/register-place')
    const result = await generateRecommendation(input)

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('실패')
  })
})
