// T-217 — 한국 전화번호 포매터.
// 숫자만 받아서 표준 표기로 변환. 입력 중에도 자연스러운 자동 하이픈.

/**
 * 입력 문자열에서 숫자만 추출.
 */
export function stripNonDigits(s: string): string {
  return s.replace(/\D+/g, '')
}

/**
 * 한국 전화번호를 0XX-XXXX-XXXX 형태로 포매팅.
 * - 02 (서울): 02-XXX-XXXX 또는 02-XXXX-XXXX
 * - 010/011/01X (휴대전화): 010-XXXX-XXXX
 * - 070 (인터넷전화): 070-XXXX-XXXX
 * - 0XX (지역번호): 0XX-XXX-XXXX 또는 0XX-XXXX-XXXX
 * - 15XX/16XX/18XX (대표번호): 15XX-XXXX
 *
 * 입력 중에도 호출 가능 — 완성되지 않은 번호도 부분 포매팅.
 */
export function formatKoreanPhone(input: string): string {
  const digits = stripNonDigits(input)
  if (digits.length === 0) return ''

  // 대표번호 1588/1644/1566/1577/1644/1899 등 15/16/18XX
  if (/^1[5-8]\d{2}/.test(digits)) {
    if (digits.length <= 4) return digits
    return `${digits.slice(0, 4)}-${digits.slice(4, 8)}`
  }

  // 서울 02
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits
    if (digits.length <= 5) return `02-${digits.slice(2)}`
    if (digits.length <= 9) return `02-${digits.slice(2, 5)}-${digits.slice(5)}`
    return `02-${digits.slice(2, 6)}-${digits.slice(6, 10)}`
  }

  // 휴대/인터넷/지역 — 0 시작 3자리
  if (digits.startsWith('0')) {
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
    // 10자리(0XX-XXX-XXXX) 또는 11자리(0XX-XXXX-XXXX)
    if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`
  }

  // 기타(외국/사내번호 등) — 숫자 그대로.
  return digits
}

/**
 * 포맷된 번호가 유효한 형식인지 체크. 입력 길이 제한/검증에 사용.
 */
export function isValidKoreanPhone(input: string): boolean {
  const digits = stripNonDigits(input)
  if (digits.length === 0) return false
  if (/^1[5-8]\d{6}$/.test(digits)) return true // 1588-1234
  if (/^02\d{7,8}$/.test(digits)) return true
  if (/^0(3[1-9]|4[1-4]|5[1-5]|6[1-4])\d{7,8}$/.test(digits)) return true // 지역
  if (/^01[016-9]\d{7,8}$/.test(digits)) return true // 휴대
  if (/^070\d{7,8}$/.test(digits)) return true
  return false
}
