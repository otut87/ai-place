/**
 * Phase 11 — PlaceReviewBadges
 * "있으면 넣는다" 원칙: 소스별 리뷰수/평점이 있을 때만 배지 렌더.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaceReviewBadges } from '@/components/business/place-review-badges'

function render(props: React.ComponentProps<typeof PlaceReviewBadges>) {
  return renderToStaticMarkup(createElement(PlaceReviewBadges, props))
}

describe('PlaceReviewBadges', () => {
  it('아무 수치도 없으면 null 반환 (빈 문자열)', () => {
    const html = render({ place: {} })
    expect(html).toBe('')
  })

  it('Google 리뷰수 + 평점이 있으면 Google 배지 렌더', () => {
    const html = render({ place: { googleRating: 4.7, googleReviewCount: 23 } })
    expect(html).toContain('Google')
    expect(html).toContain('4.7')
    expect(html).toContain('23')
  })

  it('Naver 리뷰수만 있으면 Naver 배지만 렌더 (평점 없어도 OK)', () => {
    const html = render({ place: { naverReviewCount: 663 } })
    expect(html).toContain('Naver')
    expect(html).toContain('663')
    expect(html).not.toContain('Google')
    expect(html).not.toContain('Kakao')
  })

  it('Kakao 평점만 있고 리뷰수 없으면 Kakao 평점 배지만 렌더', () => {
    const html = render({ place: { kakaoRating: 3.2 } })
    expect(html).toContain('Kakao')
    expect(html).toContain('3.2')
    expect(html).not.toContain('Naver')
  })

  it('Kakao 평점 + 리뷰수 동시에 있으면 한 배지로 병합', () => {
    const html = render({ place: { kakaoRating: 4.1, kakaoReviewCount: 76 } })
    expect(html).toContain('Kakao')
    expect(html).toContain('4.1')
    expect(html).toContain('76')
  })

  it('1만 이상 리뷰는 k 축약 (10000 → 10k)', () => {
    const html = render({ place: { naverReviewCount: 12500 } })
    expect(html).toMatch(/12\.5k/)
  })

  it('fallback rating/reviewCount 는 googleRating 없을 때만 사용', () => {
    const html = render({ place: { fallbackRating: 4.3, fallbackReviewCount: 50 } })
    expect(html).toContain('Google')
    expect(html).toContain('4.3')
    expect(html).toContain('50')
  })

  it('Naver/Kakao 수치가 0 이면 렌더하지 않음', () => {
    const html = render({ place: { naverReviewCount: 0, kakaoReviewCount: 0 } })
    expect(html).toBe('')
  })
})
