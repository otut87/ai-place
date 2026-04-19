// T-112 — 도시 slug → addressRegion (도·광역시) 매핑.
// SCHEMA_DATA_DICTIONARY §2.0.1: addressRegion 은 필수 권장.
// 신규 도시 추가 시 이 테이블에 추가. T-127 LLM 자동 등록 시에도 이 맵 업데이트.

const CITY_REGION: Record<string, string> = {
  // 충청남도
  cheonan: '충청남도',
  asan: '충청남도',
  cheongju: '충청북도',
  // 수도권
  seoul: '서울특별시',
  incheon: '인천광역시',
  suwon: '경기도',
  seongnam: '경기도',
  goyang: '경기도',
  yongin: '경기도',
  // 광역시
  busan: '부산광역시',
  daegu: '대구광역시',
  gwangju: '광주광역시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  // 제주
  jeju: '제주특별자치도',
}

export function getCityAddressRegion(citySlug: string): string | null {
  return CITY_REGION[citySlug] ?? null
}

/**
 * 주소 문자열에서 도시명(또는 구·군)을 추출.
 * "충청남도 천안시 동남구" → "천안시"
 * "서울특별시 강남구 테헤란로" → "강남구" (광역시·특별시는 locality 가 아니므로 구 선호)
 */
export function extractAddressLocality(address: string, fallback: string): string {
  // 1) 광역시/특별시/자치시 뒤의 "구"가 있으면 우선
  const wideCityPattern = /(서울특별시|부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시|세종특별자치시)\s*([가-힣]+구|[가-힣]+군)/
  const wideMatch = address.match(wideCityPattern)
  if (wideMatch) return wideMatch[2]

  // 2) "~시"
  const siMatch = address.match(/([가-힣]+시)/)
  if (siMatch && !/[가-힣]+(특별시|광역시|자치시)/.test(siMatch[1])) return siMatch[1]

  // 3) "~군" 또는 "~구"
  const etcMatch = address.match(/([가-힣]+군|[가-힣]+구)/)
  if (etcMatch) return etcMatch[1]

  return fallback
}
