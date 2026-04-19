// T-113 — 대표 리뷰 하이라이트 + Review JSON-LD.
// SCHEMA_DATA_DICTIONARY §2.9.2 + T-086 컴플라이언스 (50자 제한, 출처).

import { describe, it, expect } from 'vitest'
import { generateReviewJsonLd, pickFeaturedReviews } from '@/lib/jsonld/review'

describe('pickFeaturedReviews', () => {
  it('reviewSummaries 중 sampleQuote 길이 50~200자, 최대 2개 선택', () => {
    const summaries = [
      { source: 'Google', positiveThemes: [], negativeThemes: [], sampleQuote: '짧은 리뷰', lastChecked: '2026-04-10' },
      { source: 'Google', positiveThemes: [], negativeThemes: [], sampleQuote: '적당한 길이의 리뷰 문장입니다. 전문의 선생님이 친절하시고 시술 결과도 만족스러웠습니다. 추천합니다.', lastChecked: '2026-04-10' },
      { source: '네이버', positiveThemes: [], negativeThemes: [], sampleQuote: '두 번째 리뷰입니다. 상담 과정이 체계적이었고 사후 관리까지 꼼꼼히 안내받았으며 친절도 최고였습니다. 감사합니다.', lastChecked: '2026-04-10' },
      { source: '카카오', positiveThemes: [], negativeThemes: [], sampleQuote: '세 번째 리뷰', lastChecked: '2026-04-10' },
    ]
    const featured = pickFeaturedReviews(summaries)
    expect(featured).toHaveLength(2)
    // 50자 이상만
    for (const f of featured) {
      expect([...f.sampleQuote!].length).toBeGreaterThanOrEqual(50)
    }
  })

  it('sampleQuote 없는 항목은 제외', () => {
    const summaries = [
      { source: 'A', positiveThemes: [], negativeThemes: [], lastChecked: '2026-04-10' },
      { source: 'B', positiveThemes: [], negativeThemes: [], sampleQuote: undefined, lastChecked: '2026-04-10' },
    ]
    expect(pickFeaturedReviews(summaries)).toHaveLength(0)
  })

  it('200자 초과 리뷰는 제외 (요약 블록 가독성)', () => {
    const long = '가'.repeat(250)
    const summaries = [
      { source: 'A', positiveThemes: [], negativeThemes: [], sampleQuote: long, lastChecked: '2026-04-10' },
    ]
    expect(pickFeaturedReviews(summaries)).toHaveLength(0)
  })

  it('빈 배열/undefined 는 []', () => {
    expect(pickFeaturedReviews([])).toEqual([])
    expect(pickFeaturedReviews(undefined)).toEqual([])
  })
})

describe('generateReviewJsonLd', () => {
  it('Review 타입 + publisher + itemReviewed', () => {
    const review = generateReviewJsonLd({
      body: '전문의 선생님이 친절하시고 시술 결과도 만족스러웠습니다. 추천합니다.',
      source: 'Google',
      datePublished: '2026-04-10',
      itemReviewedId: 'https://aiplace.kr/cheonan/dermatology/dr-evers#place',
    })
    expect(review['@type']).toBe('Review')
    expect(review.publisher).toMatchObject({ '@type': 'Organization', name: 'Google' })
    expect(review.itemReviewed['@id']).toContain('dr-evers')
    expect(review.reviewBody).toContain('전문의')
    expect(review.author['@type']).toBe('Person')
    expect(review.datePublished).toBe('2026-04-10')
  })

  it('body 50자 초과 시 50자 + ... 로 잘라냄 (T-086 컴플라이언스)', () => {
    const long = '가'.repeat(80)
    const review = generateReviewJsonLd({
      body: long,
      source: 'Google',
      itemReviewedId: 'id',
    })
    expect([...review.reviewBody as string].length).toBeLessThanOrEqual(51) // 50 + …
  })

  it('datePublished 미지정 시 필드 생략', () => {
    const review = generateReviewJsonLd({
      body: '좋았습니다',
      source: 'Google',
      itemReviewedId: 'id',
    })
    expect(review.datePublished).toBeUndefined()
  })
})
