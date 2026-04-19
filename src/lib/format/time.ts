// T-122 — 날짜 렌더 유틸. 철학: "<time datetime="YYYY-MM-DD">".
// 빌드 시각 폴백을 금지하고, 실제 데이터 updated_at 을 단일 소스로 쓰기 위한 헬퍼.

/**
 * ISO datetime 또는 YYYY-MM-DD 를 YYYY-MM-DD 로 정규화.
 * 유효하지 않은 입력은 null.
 */
export function toIsoDate(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = input.trim()
  if (!trimmed) return null
  // 이미 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // ISO 8601 datetime
  const d = new Date(trimmed)
  if (isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * 여러 updated_at 중 가장 최신을 YYYY-MM-DD 로 반환. 모두 유효하지 않으면 null.
 * sitemap lastModified · 페이지 상단 "최종 업데이트" 공통 계산용.
 */
export function latestUpdatedAt(inputs: Array<string | null | undefined>): string | null {
  const valid = inputs
    .map(i => toIsoDate(i))
    .filter((d): d is string => d !== null)
  if (valid.length === 0) return null
  return valid.sort().at(-1) ?? null
}
