// T-248 — 페이지네이션 헬퍼.

/**
 * 페이지 번호 리스트 (생략 부호 포함). 항상 첫·끝, 현재 양옆 1개, 갭은 '...'.
 *
 * 예:
 *   total ≤ 7  → [1..total] 그대로
 *   total=10 current=5 → [1, '...', 4, 5, 6, '...', 10]
 *   total=10 current=1 → [1, 2, '...', 10]
 *   total=10 current=10 → [1, '...', 9, 10]
 */
export function pageNumbers(current: number, total: number): Array<number | '...'> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: Array<number | '...'> = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) result.push('...')
  for (let i = left; i <= right; i++) result.push(i)
  if (right < total - 1) result.push('...')
  result.push(total)
  return result
}
