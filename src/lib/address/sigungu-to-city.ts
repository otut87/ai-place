// 시군구 코드 → city slug 매핑 (T-016)
// Daum Postcode 가 반환하는 sigunguCode(5자리) 기반.
// 법정동/행정동 코드 참고: https://www.code.go.kr
//
// MVP: 천안만 지원. 타 도시 추가 시 여기 확장.

export const SIGUNGU_TO_CITY: Record<string, string> = {
  '44130': 'cheonan', // 천안시 서북구
  '44131': 'cheonan', // 천안시 동남구
  // TODO: 타 도시 확장 시 추가
}

/** sigunguCode → city slug. 미지원 → null. */
export function sigunguToCity(code: string): string | null {
  if (!code) return null
  return SIGUNGU_TO_CITY[code] ?? null
}

/**
 * 주소 문자열에서 city slug 추론.
 * sigunguCode 가 없을 때 fallback 용 (주소 텍스트 파싱).
 */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null
  // "천안시" 리터럴 매칭 (아산시는 "아산시" 로 "천안시" 와 겹치지 않음)
  if (address.includes('천안시')) return 'cheonan'
  return null
}
