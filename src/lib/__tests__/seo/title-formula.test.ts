// T-110 — 블로그·가이드 제목 공식 테스트.
// 철학: "모든 페이지는 AI 의 질문에 대한 답" — 제목이 답변 시작점.
// MedicalKoreaGuide 분석: "[지역] [주제] [업종] [N곳] — 리뷰 [M건] 분석 ([연도])".

import { describe, it, expect } from 'vitest'
import { formatEvidenceTitle, extractReviewTotal } from '@/lib/seo/title-formula'

describe('formatEvidenceTitle', () => {
  it('업체가 있고 리뷰 합계가 있으면 완전한 공식 적용', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      topic: '여드름',
      categoryName: '피부과',
      placeCount: 4,
      reviewTotal: 2127,
      year: 2026,
    })
    expect(title).toMatch(/천안/)
    expect(title).toMatch(/여드름/)
    expect(title).toMatch(/피부과/)
    expect(title).toMatch(/4곳/)
    expect(title).toMatch(/2,127건/) // 천단위 콤마
    expect(title).toMatch(/2026/)
  })

  it('리뷰 합계 0 이면 "리뷰 M건 분석" 생략', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      topic: '여드름',
      categoryName: '피부과',
      placeCount: 4,
      reviewTotal: 0,
      year: 2026,
    })
    expect(title).toMatch(/4곳/)
    expect(title).not.toMatch(/0건/)
    expect(title).not.toMatch(/리뷰 0/)
  })

  it('placeCount 0 이면 "N곳" 대신 연도만', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      topic: '여드름',
      categoryName: '피부과',
      placeCount: 0,
      reviewTotal: 0,
      year: 2026,
    })
    expect(title).not.toMatch(/0곳/)
    expect(title).toMatch(/2026/)
  })

  it('topic 생략 가능 (카테고리 허브 제목용)', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      categoryName: '피부과',
      placeCount: 4,
      reviewTotal: 2127,
      year: 2026,
    })
    expect(title).toMatch(/천안 피부과/)
    expect(title).toMatch(/4곳/)
  })

  it('연도 미지정 시 현재 연도 사용', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      categoryName: '피부과',
      placeCount: 2,
      reviewTotal: 100,
    })
    expect(title).toMatch(new RegExp(String(new Date().getFullYear())))
  })

  it('reviewTotal 천단위 콤마 포맷 (한국어 ko-KR)', () => {
    const title = formatEvidenceTitle({
      cityName: '천안',
      categoryName: '피부과',
      placeCount: 4,
      reviewTotal: 9406,
      year: 2026,
    })
    expect(title).toContain('9,406')
  })
})

describe('extractReviewTotal', () => {
  it('업체 배열에서 reviewCount 합산', () => {
    const places = [
      { reviewCount: 100 },
      { reviewCount: 200 },
      { reviewCount: null },
      { reviewCount: 50 },
    ]
    expect(extractReviewTotal(places)).toBe(350)
  })

  it('빈 배열 → 0', () => {
    expect(extractReviewTotal([])).toBe(0)
  })

  it('모두 null/undefined → 0', () => {
    expect(extractReviewTotal([{ reviewCount: null }, { reviewCount: undefined }])).toBe(0)
  })
})
