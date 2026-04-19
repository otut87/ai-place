// T-CP1 — 의료 카테고리 정책 가드.
// 근거: 추가리뷰 §4 리스크 2 — 의료광고법상 가격 명시·치료효과 보장·비교우위 표현 제한.
// 적용: 피부과·치과·한의원·성형외과·내과 등 의료 업종에서
//  1) 서비스 가격은 "상담 문의" 강제
//  2) 시술명·설명에 금칙어 포함 시 플래그
//  3) 업체 상세에 참고 문구 강제 노출

export const MEDICAL_CATEGORIES = new Set<string>([
  'dermatology',
  'dental',
  'orient-medicine',
  'oriental-medicine',
  'plastic-surgery',
  'internal-medicine',
  'ophthalmology',
  'otolaryngology',
  'orthopedics',
  'urology',
  'obstetrics',
  'psychiatry',
])

export function isMedicalCategory(slug: string | null | undefined): boolean {
  if (!slug) return false
  return MEDICAL_CATEGORIES.has(slug)
}

/**
 * 의료광고 금칙어 — 비교우위·치료효과 보장·최상급 표현.
 * 포함 시 서버 액션에서 저장을 거부하고 어드민에게 치환을 요구.
 */
// \b 는 한글에 적용되지 않아 문자열 내 부분 일치 기반으로 검출.
const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /최고|1위|최초|유일/, reason: '최상급·비교우위 표현 금지' },
  { pattern: /완치|100%|보장|확실/, reason: '치료효과 보장 표현 금지' },
  { pattern: /안전(?!성)/, reason: '"안전" 단독 표현 금지 (→ "안전성" 은 허용)' },
  { pattern: /부작용\s*없/, reason: '"부작용 없음" 보장 금지' },
]

export interface MedicalViolation {
  reason: string
  match: string
}

export function findMedicalViolations(text: string): MedicalViolation[] {
  const out: MedicalViolation[] = []
  for (const rule of PROHIBITED_PATTERNS) {
    const m = text.match(rule.pattern)
    if (m) out.push({ reason: rule.reason, match: m[0] })
  }
  return out
}

/** 저장 가드: 의료 카테고리 + 가격 필드 → "상담 문의" 강제 변환. */
export function enforceConsultPrice<T extends { price?: string | number | null }>(
  category: string | null,
  service: T,
): T {
  if (!isMedicalCategory(category)) return service
  if (service.price == null || service.price === '') return service
  return { ...service, price: '상담 문의' }
}

/** 업체 상세에 노출할 참고 문구 (T-004 재사용). */
export const MEDICAL_DISCLAIMER =
  '본 페이지의 정보는 일반적 안내이며, 개인별 의학적 상태·적응증은 반드시 의료진 상담 후 결정하시기 바랍니다.'
