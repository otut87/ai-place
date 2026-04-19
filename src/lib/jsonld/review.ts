// T-113 — 대표 리뷰 2개 하이라이트 + Review JSON-LD 생성.
// SCHEMA_DATA_DICTIONARY §2.9.2 + T-086 저작권 컴플라이언스 (50자 제한, 출처 강제).

import type { ReviewSummary } from '@/lib/types'

/**
 * reviewSummaries 중 sampleQuote 길이 50~200자인 것 상위 최대 2개.
 * - 50자 미만: 너무 짧아 AI 인용 가치 낮음
 * - 200자 초과: 하이라이트 박스 가독성 저하
 */
export function pickFeaturedReviews(
  summaries: ReviewSummary[] | undefined,
): ReviewSummary[] {
  if (!summaries || summaries.length === 0) return []
  return summaries
    .filter(s => {
      if (!s.sampleQuote) return false
      const len = [...s.sampleQuote].length
      return len >= 50 && len <= 200
    })
    .slice(0, 2)
}

export interface ReviewJsonLdArgs {
  body: string
  source: string            // "Google", "네이버", "카카오" 등
  itemReviewedId: string    // 업체 @id
  datePublished?: string    // ISO 8601
  authorName?: string       // 닉네임 (공개 UGC만)
  ratingValue?: number      // 1~5
}

/**
 * Schema.org Review JSON-LD 생성.
 * T-086: reviewBody 는 50자 + … 로 하드 제한 (저작권 안전).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateReviewJsonLd(args: ReviewJsonLdArgs): Record<string, any> {
  const { body, source, itemReviewedId, datePublished, authorName, ratingValue } = args
  const chars = [...body]
  const truncated = chars.length > 50 ? chars.slice(0, 50).join('') + '…' : body

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonld: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    reviewBody: truncated,
    author: {
      '@type': 'Person',
      name: authorName ?? '공개 리뷰어',
    },
    publisher: {
      '@type': 'Organization',
      name: source,
    },
    itemReviewed: {
      '@id': itemReviewedId,
    },
  }

  if (datePublished) {
    jsonld.datePublished = datePublished
  }
  if (typeof ratingValue === 'number') {
    jsonld.reviewRating = {
      '@type': 'Rating',
      ratingValue,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return jsonld
}
