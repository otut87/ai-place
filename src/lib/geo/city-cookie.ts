// City 쿠키 헬퍼 (T-246).
// 'aiplace-city' 쿠키 — 값: city slug 또는 'all'.
// 30일 유지. 사용자가 헤더 City Picker 로 변경하면 갱신.

export const CITY_COOKIE_NAME = 'aiplace-city'
export const CITY_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 일
export const CITY_ALL = 'all'

/**
 * 서버 컴포넌트에서 city 쿠키 읽기 (Next 16 async cookies()).
 * 미설정 시 'all' 반환 — 첫 방문 + 미들웨어 미적용 환경 대비.
 */
export async function readCityCookieServer(): Promise<string> {
  const { cookies } = await import('next/headers')
  const store = await cookies()
  return store.get(CITY_COOKIE_NAME)?.value ?? CITY_ALL
}

/**
 * 쿠키 값이 유효한 city slug 또는 'all' 인지 검증.
 * 화이트리스트는 호출처에서 cities 목록 전달.
 */
export function isValidCityValue(value: string | null | undefined, validSlugs: string[]): boolean {
  if (!value) return false
  if (value === CITY_ALL) return true
  return validSlugs.includes(value)
}

/**
 * 클라이언트 측에서 쿠키 설정 (CityPicker 클릭 시).
 * 서버 측은 NextResponse.cookies.set 사용.
 */
export function setCityCookieClient(value: string): void {
  if (typeof document === 'undefined') return
  const maxAge = CITY_COOKIE_MAX_AGE
  document.cookie = `${CITY_COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

/**
 * 클라이언트 측 쿠키 읽기.
 */
export function readCityCookieClient(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${CITY_COOKIE_NAME}=([^;]+)`))
  if (!match) return null
  try {
    return decodeURIComponent(match[2])
  } catch {
    return match[2]
  }
}
