// 평점 표기 유틸 (T-009)
// AEO 원칙: 모든 페이지에서 동일한 평점 포맷을 사용 — 답변박스 인용 일관성.

export type RatingSource = 'google' | 'naver' | 'mixed'

const SOURCE_LABEL: Record<RatingSource, string> = {
  google: 'Google',
  naver: 'Naver',
  mixed: '',
}

/**
 * "★ 4.5 · 리뷰 178건 (Google)" 형식 출력.
 * - 평점 소수점 1자리 고정 (반올림)
 * - review count 0 은 "리뷰 없음"
 * - mixed 소스는 출처 생략
 */
export function formatRatingLine(
  rating: number,
  count: number,
  source: RatingSource,
): string {
  // Math.round 로 반올림 (toFixed 는 banker's rounding 때문에 4.55 → "4.5")
  const ratingStr = (Math.round(rating * 10) / 10).toFixed(1)
  const reviewStr = count <= 0 ? '리뷰 없음' : `리뷰 ${count}건`
  const srcLabel = SOURCE_LABEL[source]
  const suffix = srcLabel ? ` (${srcLabel})` : ''
  return `★ ${ratingStr} · ${reviewStr}${suffix}`
}
