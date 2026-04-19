// T-113 — Review JSON-LD + featured reviews 테스트 (대표 경로 커버).
import { describe, it, expect } from 'vitest'
import { generateReviewJsonLd, pickFeaturedReviews } from '@/lib/jsonld/review'

describe('T-113 Review module', () => {
  it('generateReviewJsonLd: Review + Person author + publisher', () => {
    const r = generateReviewJsonLd({
      body: '이 클리닉은 전문의 선생님이 상주하시고 서비스가 매우 만족스럽습니다.',
      source: 'Google',
      itemReviewedId: 'https://aiplace.kr/cheonan/dermatology/dr-evers#place',
      datePublished: '2026-04-10',
      authorName: '홍길동',
      ratingValue: 5,
    })
    expect(r['@type']).toBe('Review')
    expect(r.reviewBody).toBeTruthy()
    expect(r.author['@type']).toBe('Person')
    expect(r.publisher['@type']).toBe('Organization')
    expect(r.reviewRating.ratingValue).toBe(5)
  })

  it('pickFeaturedReviews: 50-200자 2개 필터', () => {
    const featured = pickFeaturedReviews([
      { source: 'Google', positiveThemes: [], negativeThemes: [], sampleQuote: '짧음', lastChecked: '2026-04-10' },
      { source: 'Google', positiveThemes: [], negativeThemes: [], sampleQuote: '적절한 길이의 리뷰입니다. 상담 과정이 친절하고 사후 관리까지 체계적이었습니다. 정말 만족합니다.', lastChecked: '2026-04-10' },
    ])
    expect(featured).toHaveLength(1)
  })
})
