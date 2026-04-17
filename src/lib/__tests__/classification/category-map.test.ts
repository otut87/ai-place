/**
 * category-map.ts 테스트 (T-015)
 * 매핑 함수들의 상세 테스트는 category-detector.test.ts 에 있고,
 * 여기는 매핑 테이블 자체의 일관성을 검증.
 */
import { describe, it, expect } from 'vitest'
import { KAKAO_CATEGORY_MAP, GOOGLE_TYPE_MAP, mapKakaoCategory, mapGoogleTypes } from '@/lib/classification/category-map'

describe('KAKAO_CATEGORY_MAP', () => {
  it('모든 value 가 category slug 규칙 (소문자-하이픈)', () => {
    for (const slug of Object.values(KAKAO_CATEGORY_MAP)) {
      expect(slug).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('의료 카테고리 다수 포함 (dermatology/dental/...)', () => {
    const vals = Object.values(KAKAO_CATEGORY_MAP)
    expect(vals).toContain('dermatology')
    expect(vals).toContain('dental')
    expect(vals).toContain('pharmacy')
  })

  it('mapKakaoCategory 재확인 — 직접 매칭', () => {
    expect(mapKakaoCategory('의료,건강 > 병원 > 치과')).toBe('dental')
  })
})

describe('GOOGLE_TYPE_MAP', () => {
  it('값은 slug 또는 null (세부 분류 필요 신호)', () => {
    for (const v of Object.values(GOOGLE_TYPE_MAP)) {
      if (v !== null) expect(v).toMatch(/^[a-z][a-z0-9-]*$/)
    }
  })

  it('restaurant/doctor/hospital 는 null (Tier 3 필요)', () => {
    expect(GOOGLE_TYPE_MAP.restaurant).toBeNull()
    expect(GOOGLE_TYPE_MAP.doctor).toBeNull()
    expect(GOOGLE_TYPE_MAP.hospital).toBeNull()
  })

  it('mapGoogleTypes 재확인', () => {
    expect(mapGoogleTypes(['dermatologist'])).toBe('dermatology')
    expect(mapGoogleTypes(['doctor'])).toBeNull()
  })
})
