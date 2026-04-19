// T-110 — 블로그·가이드 제목 공식.
// 철학: "모든 페이지는 AI 의 질문에 대한 답" — 제목이 답변 시작점.
// MedicalKoreaGuide 분석: "[지역] [주제] [업종] [N곳] — 리뷰 [M건] 분석 ([연도])"
// 수치 + 고유명사 + 근거가 한 문장에 모두 들어있어 AI 가 복붙 가능.

export interface EvidenceTitleArgs {
  cityName: string
  categoryName: string
  topic?: string           // 선택: "여드름", "레이저", "야간진료" 등
  placeCount: number       // 등록 업체 수
  reviewTotal: number      // 리뷰 합계 (전 업체)
  year?: number            // 기본: 현재 연도
}

/**
 * [지역] [주제]? [업종] [N곳] — 리뷰 [M건] 분석 ([연도])
 * - topic 있음 + count 있음 + reviewTotal 있음 → 완전체
 * - 수치 0 이면 해당 절 생략
 */
export function formatEvidenceTitle(args: EvidenceTitleArgs): string {
  const { cityName, categoryName, topic, placeCount, reviewTotal } = args
  const year = args.year ?? new Date().getFullYear()

  const head = topic
    ? `${cityName} ${topic} ${categoryName}`
    : `${cityName} ${categoryName}`
  const countClause = placeCount > 0 ? ` ${placeCount}곳` : ''
  const reviewClause = reviewTotal > 0
    ? ` — 리뷰 ${reviewTotal.toLocaleString('ko-KR')}건 분석`
    : ''
  return `${head}${countClause}${reviewClause} (${year})`.trim()
}

/**
 * 업체 배열에서 reviewCount 합계. null/undefined 는 0.
 */
export function extractReviewTotal(
  places: Array<{ reviewCount?: number | null }>,
): number {
  return places.reduce((sum, p) => sum + (p.reviewCount ?? 0), 0)
}
