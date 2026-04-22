// T-193 — 카테고리별 금칙 표현 상수.
// Phase 3 medical-law-checker 에서도 동일 상수를 재사용한다 (banned-phrases 는 단일 소스).
//
// 원칙:
// - SUPERLATIVES: 광고성 과장. 전체 카테고리 적용.
// - MEDICAL_FORBIDDEN: 의료법 56조 · 의료광고 금지 표현.
// - LEGAL_FORBIDDEN / TAX_FORBIDDEN: 변호사법·세무사법 고지 우회 표현.
// - AI_CLICHES: Claude/GPT 류 상투어. WARN 수준.
// - NEGATIVE_WORDS: 비방/디스 표현. 평점·리뷰 제약을 푼 대신 중립 서술 강제.

export const SUPERLATIVES = [
  '최고의',
  '1위',
  '완벽한',
  '100%',
  '무조건',
  '절대',
  '단연',
  '유일한',
]

export const MEDICAL_FORBIDDEN = [
  '보장된 효과',
  '즉각적 치료',
  '완전한 치유',
  '부작용 없음',
  '완치',
  '반드시 낫',
  '부작용 전혀',
]

export const LEGAL_FORBIDDEN = [
  '반드시 승소',
  '100% 성공',
  '승소 보장',
]

export const TAX_FORBIDDEN = [
  '반드시 절세',
  '세금 면제 보장',
  '무조건 환급',
]

export const AI_CLICHES = [
  '다양한',
  '효과적인',
  '중요한',
  '혁신적인',
  '최적의',
]

export const NEGATIVE_WORDS = [
  '최악',
  '실망',
  '피해야 할',
  '사기',
  '함량 미달',
  '거르세요',
  '쓰레기',
  '엉망',
]

/** sector(또는 category) → 추가 금칙어 리스트 매핑. */
const SECTOR_FORBIDDEN: Record<string, string[]> = {
  medical: MEDICAL_FORBIDDEN,
  legal: LEGAL_FORBIDDEN,
  tax: TAX_FORBIDDEN,
}

/** 섹터별 FAIL 금칙어 전체 (SUPERLATIVES + sector-specific). */
export function getBannedPhrasesForSector(sector?: string): string[] {
  const sectorExtra = sector ? SECTOR_FORBIDDEN[sector] ?? [] : []
  return [...SUPERLATIVES, ...sectorExtra]
}
