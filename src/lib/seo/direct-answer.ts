// T-123 — Direct Answer Block 유틸.
// 철학: "모든 페이지의 H1 바로 아래에 40~80자 내의 자기완결형 요약문(Direct Answer Block)"
// AI 가 이 한 문장만 읽고도 답을 만들 수 있어야 한다.

export const DAB_MIN = 40
export const DAB_MAX = 80
const FALLBACK = 'AI Place 는 ChatGPT·Claude·Gemini 에서 추천되는 로컬 업체 디렉토리입니다.'

/**
 * 문자열이 Direct Answer Block 규격(40~80자)인지.
 */
export function isValidDirectAnswer(text: string | null | undefined): boolean {
  if (!text) return false
  const len = [...text].length
  return len >= DAB_MIN && len <= DAB_MAX
}

/**
 * 문자열을 Direct Answer Block 규격으로 정규화.
 * - 80자 초과: 자르고 … 추가
 * - 40자 미만: fallback 을 이어붙여 최소 보장
 * - 범위 내: 그대로 반환
 */
export function clampDirectAnswer(text: string, fallback: string = FALLBACK): string {
  const chars = [...(text ?? '')]
  if (chars.length > DAB_MAX) {
    return chars.slice(0, DAB_MAX - 1).join('') + '…'
  }
  if (chars.length >= DAB_MIN) {
    return chars.join('')
  }
  // 너무 짧음 — fallback 을 이어붙여 최소 40자 보장.
  // 제공된 fallback 도 짧다면 기본 FALLBACK 을 덧붙여 40자 달성.
  let padded = (chars.join('') + ' ' + fallback).trim()
  if ([...padded].length < DAB_MIN) {
    padded = (padded + ' ' + FALLBACK).trim()
  }
  const paddedChars = [...padded]
  if (paddedChars.length > DAB_MAX) {
    return paddedChars.slice(0, DAB_MAX - 1).join('') + '…'
  }
  return padded
}
