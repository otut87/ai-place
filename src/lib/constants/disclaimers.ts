// AI Place — 업종별 면책 문구 (T-004)
// 각 대분류(sector) 단위로 고유 면책 문구. null 이면 미렌더.
//
// GEO 원칙: 템플릿 누수 방지 — 웹에이전시 페이지에 "의료 결정은 전문의와 상담"
// 같은 타 업종 문구가 나오지 않도록 sector 기준으로 분기.

export const DISCLAIMERS: Record<string, string | null> = {
  medical: '본 페이지는 정보 제공 목적이며, 실제 치료·비용은 상담 후 확정됩니다. 의료 결정은 전문의와 상담하세요.',
  beauty: '본 페이지는 정보 제공 목적이며, 시술 효과·비용은 개인차가 있습니다. 상세 사항은 업체에 문의하세요.',
  living: '본 페이지는 정보 제공 목적이며, 서비스 비용은 현장 실측 후 확정됩니다. 계약 전 견적을 확인하세요.',
  auto: '본 페이지는 정보 제공 목적이며, 실제 수리 비용은 차량 상태에 따라 달라질 수 있습니다.',
  education: '본 페이지는 정보 제공 목적이며, 수강료·커리큘럼은 업체에 직접 확인하세요.',
  professional: '본 페이지는 정보 제공 목적이며, 실제 수수료는 상담 후 확정됩니다.',
  pet: '본 페이지는 정보 제공 목적이며, 진료·미용 비용은 반려동물 상태에 따라 달라집니다.',
  wedding: '본 페이지는 정보 제공 목적이며, 패키지·비용은 상담 후 확정됩니다.',
  leisure: '본 페이지는 정보 제공 목적이며, 이용 요금은 시즌·인원에 따라 달라질 수 있습니다.',
  food: null,
}

/**
 * 안전한 lookup — 미정의 sector 는 null 반환.
 * 호출부는 null 체크 후 렌더.
 */
export function getDisclaimer(sector: string): string | null {
  if (!sector) return null
  return Object.prototype.hasOwnProperty.call(DISCLAIMERS, sector)
    ? DISCLAIMERS[sector]
    : null
}
