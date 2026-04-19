// T-062 — 검수 큐 순수 로직.
// 반려 사유 enum + 쿼리 파라미터 파서.
// T-093 — 검수 타입 (place | blog) 분기.

export const REJECT_REASONS = ['fact_error', 'tone', 'seo', 'duplicate', 'other'] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export const REVIEW_TYPES = ['place', 'blog'] as const
export type ReviewType = (typeof REVIEW_TYPES)[number]

const REJECT_REASON_SET: ReadonlySet<string> = new Set(REJECT_REASONS)
const REVIEW_TYPE_SET: ReadonlySet<string> = new Set(REVIEW_TYPES)

export function isRejectReason(value: unknown): value is RejectReason {
  return typeof value === 'string' && REJECT_REASON_SET.has(value)
}

export function isReviewType(value: unknown): value is ReviewType {
  return typeof value === 'string' && REVIEW_TYPE_SET.has(value)
}

export function rejectReasonLabel(reason: RejectReason): string {
  switch (reason) {
    case 'fact_error': return '사실 오류'
    case 'tone': return '톤매너 부적합'
    case 'seo': return 'SEO 부적합'
    case 'duplicate': return '중복'
    case 'other': return '기타'
  }
}

export function reviewTypeLabel(type: ReviewType): string {
  return type === 'place' ? '업체' : '블로그'
}

/**
 * 검수 큐 URL 쿼리 파서.
 *   ?type=place|blog   검수 타입 탭
 *   ?place=<id>        선택된 업체
 *   ?blog=<slug>       선택된 블로그
 */
export function parseReviewParams(raw: Record<string, string | string[] | undefined>): {
  type: ReviewType
  placeId?: string
  blogSlug?: string
} {
  const rawType = Array.isArray(raw.type) ? raw.type[0] : raw.type
  const type: ReviewType = isReviewType(rawType) ? rawType : 'place'

  const p = Array.isArray(raw.place) ? raw.place[0] : raw.place
  const b = Array.isArray(raw.blog) ? raw.blog[0] : raw.blog

  const placeId = p && !/[\\/..]/.test(p) ? p : undefined
  const blogSlug = b && !/[\\/..]/.test(b) ? b : undefined

  return { type, placeId, blogSlug }
}
