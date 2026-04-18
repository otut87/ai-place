// T-063 — ConfirmNameModal 의 match 로직 순수 함수.
// UI 밖에서 단위 테스트 가능하게 분리.

export function confirmNameMatches(typed: string, expected: string): boolean {
  return typed.trim() === expected.trim() && expected.trim().length > 0
}
