// IP geolocation → AI Place city slug 매핑 (T-246).
//
// Vercel Edge 가 자동 주입하는 `x-vercel-ip-city` 헤더(URL-encoded 도시명) 또는
// 동등한 헤더(Cloudflare cf-ipcity 등) 를 받아 우리 service 의 city slug 로 변환.
//
// 한국 IP 의 한계: ISP 라우팅으로 실제 위치와 다른 도시(주로 서울/대전 허브)로
// 잡히는 경우가 흔함. 따라서 이 매핑은 "초기 추천값" 으로만 사용하고, 사용자가
// 헤더의 City Picker 로 수동 변경 가능.

const IP_CITY_TO_SLUG: Record<string, string> = {
  // Cheonan
  cheonan: 'cheonan',
  'cheonan-si': 'cheonan',
  'cheonan si': 'cheonan',
  '천안': 'cheonan',
  '천안시': 'cheonan',

  // Asan
  asan: 'asan',
  'asan-si': 'asan',
  'asan si': 'asan',
  '아산': 'asan',
  '아산시': 'asan',
}

/**
 * IP 도시명(헤더값) → city slug.
 * 모르면 null 반환 — 호출처에서 'all' 폴백 결정.
 *
 * 입력: URL-decoded 또는 raw 헤더값. 'Cheonan-si', 'Cheonan%20si', '천안시' 등.
 */
export function ipCityToSlug(ipCity: string | null | undefined): string | null {
  if (!ipCity) return null
  let normalized: string
  try {
    normalized = decodeURIComponent(ipCity).toLowerCase().trim()
  } catch {
    normalized = ipCity.toLowerCase().trim()
  }
  return IP_CITY_TO_SLUG[normalized] ?? null
}

/**
 * 헤더 모음에서 IP 도시 단서 추출 (Vercel · Cloudflare · 일반화).
 */
export function readIpCityFromHeaders(getHeader: (name: string) => string | null): string | null {
  return (
    getHeader('x-vercel-ip-city') ??
    getHeader('cf-ipcity') ??
    getHeader('x-ip-city') ??
    null
  )
}
