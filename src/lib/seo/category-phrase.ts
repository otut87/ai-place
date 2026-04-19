// T-102 — 업종별 메타 description / DAB 문구 유틸.
// 검수 리뷰 #7: "1곳인데 '단비 등의 메뉴'" 어색 문구 해결.
// 철학: "모든 업종에 동일한 메타 템플릿을 사용하지 않는다."

/**
 * 업체 이름 목록 + descriptor → 자연스러운 "등의" 문구 조립.
 * - 0곳: 빈 문자열
 * - 1~2곳: "X의 메뉴" / "X, Y의 메뉴" (등 제거)
 * - 3곳 이상: "X, Y 등의 메뉴" (상위 2개만 나열)
 */
export function formatDABExampleClause(names: string[], descriptor: string): string {
  if (names.length === 0) return ''
  if (names.length <= 2) {
    return `${names.join(', ')}의 ${descriptor}`
  }
  const top = names.slice(0, 2)
  return `${top.join(', ')} 등의 ${descriptor}`
}

/**
 * 섹터별 meta descriptor (업종사전 기준). 의료에만 "진료"가 등장하도록 강제.
 * 신규 섹터 추가 시 이 테이블에 행 추가.
 */
const SECTOR_DESCRIPTOR: Record<string, string> = {
  medical: '진료 과목, 전문 분야',
  beauty: '전문 시술, 가격대',
  living: '서비스 종류, 가격대',
  auto: '수리 분야, 가격대',
  education: '교육 과정, 수강료',
  professional: '전문 분야, 상담 방식',
  pet: '서비스 종류, 가격대',
  wedding: '서비스 종류, 가격대',
  leisure: '프로그램, 가격대',
  food: '메뉴, 분위기',
}

export function resolveCategoryDescriptor(sectorOrCategorySlug: string): string {
  return SECTOR_DESCRIPTOR[sectorOrCategorySlug] ?? '전문 분야, 서비스'
}
