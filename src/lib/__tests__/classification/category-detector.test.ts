/**
 * category-detector.ts 테스트 (T-015)
 * Tier 1 Kakao → Tier 2 Google → Tier 3 Haiku LLM 폴백.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockHaikuDetect } = vi.hoisted(() => ({ mockHaikuDetect: vi.fn() }))
vi.mock('@/lib/classification/llm-detector', () => ({
  detectCategoryViaLLM: mockHaikuDetect,
}))

import { detectCategory } from '@/lib/classification/category-detector'
import { mapKakaoCategory, mapGoogleTypes } from '@/lib/classification/category-map'

beforeEach(() => { mockHaikuDetect.mockReset() })

describe('mapKakaoCategory', () => {
  it('정확 매칭 → 올바른 slug', () => {
    expect(mapKakaoCategory('의료,건강 > 병원 > 피부과')).toBe('dermatology')
    expect(mapKakaoCategory('의료,건강 > 병원 > 치과')).toBe('dental')
  })

  it('fuzzy — 마지막 세그먼트 매칭 fallback', () => {
    expect(mapKakaoCategory('알 수 없는 > 병원 > 피부과')).toBe('dermatology')
  })

  it('매칭 없음 → null', () => {
    expect(mapKakaoCategory('완전히 > 다른 > 카테고리')).toBeNull()
  })

  it('빈 값 → null', () => {
    expect(mapKakaoCategory('')).toBeNull()
  })
})

describe('mapGoogleTypes', () => {
  it('첫 유효 매핑 반환', () => {
    expect(mapGoogleTypes(['dermatologist', 'doctor'])).toBe('dermatology')
  })

  it('모두 null (세부 필요) → null', () => {
    expect(mapGoogleTypes(['doctor', 'hospital'])).toBeNull()
  })

  it('빈 배열 → null', () => {
    expect(mapGoogleTypes([])).toBeNull()
  })
})

describe('detectCategory — Tier 1 Kakao 우선', () => {
  it('Kakao 카테고리 매칭 성공 → LLM 호출 안 함', async () => {
    const result = await detectCategory({
      kakaoCategory: '의료,건강 > 병원 > 피부과',
      googleTypes: [],
      name: '테스트',
    })
    expect(result.category).toBe('dermatology')
    expect(result.tier).toBe(1)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(mockHaikuDetect).not.toHaveBeenCalled()
  })
})

describe('detectCategory — Tier 2 Google 폴백', () => {
  it('Kakao 실패 but Google dermatologist → dermatology', async () => {
    const result = await detectCategory({
      kakaoCategory: null,
      googleTypes: ['dermatologist', 'doctor'],
      name: '테스트',
    })
    expect(result.category).toBe('dermatology')
    expect(result.tier).toBe(2)
    expect(mockHaikuDetect).not.toHaveBeenCalled()
  })
})

describe('detectCategory — Tier 3 LLM 폴백', () => {
  it('Kakao/Google 모두 실패 → LLM 호출', async () => {
    mockHaikuDetect.mockResolvedValue({ category: 'restaurant', confidence: 0.85 })
    const result = await detectCategory({
      kakaoCategory: null,
      googleTypes: ['restaurant'],
      name: '테스트 식당',
    })
    expect(mockHaikuDetect).toHaveBeenCalled()
    expect(result.category).toBe('restaurant')
    expect(result.tier).toBe(3)
    expect(result.confidence).toBe(0.85)
  })

  it('LLM confidence < 0.8 → needsReview=true', async () => {
    mockHaikuDetect.mockResolvedValue({ category: 'bakery', confidence: 0.6 })
    const result = await detectCategory({
      kakaoCategory: null,
      googleTypes: [],
      name: '모호한 업체명',
    })
    expect(result.needsReview).toBe(true)
  })

  it('LLM 실패 → null 결과 + needsReview', async () => {
    mockHaikuDetect.mockResolvedValue(null)
    const result = await detectCategory({
      kakaoCategory: null,
      googleTypes: [],
      name: 'X',
    })
    expect(result.category).toBeNull()
    expect(result.needsReview).toBe(true)
  })
})
