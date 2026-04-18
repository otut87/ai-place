export type BulkAction = 'activate' | 'reject' | 'delete'

const BULK_ACTIONS: ReadonlySet<BulkAction> = new Set(['activate', 'reject', 'delete'])

export function parseBulkAction(value: unknown): BulkAction | null {
  if (typeof value !== 'string') return null
  return BULK_ACTIONS.has(value as BulkAction) ? (value as BulkAction) : null
}

export function partitionIds(
  selected: readonly string[],
  allowed: Iterable<string>,
): { valid: string[]; invalid: string[] } {
  const allowedSet = allowed instanceof Set ? (allowed as Set<string>) : new Set(allowed)
  const seen = new Set<string>()
  const valid: string[] = []
  const invalid: string[] = []
  for (const id of selected) {
    if (seen.has(id)) continue
    seen.add(id)
    if (allowedSet.has(id)) valid.push(id)
    else invalid.push(id)
  }
  return { valid, invalid }
}

export interface BulkResult {
  successes: number
  failures: number
}

export function summarizeBulkResult({ successes, failures }: BulkResult): string {
  if (successes === 0 && failures === 0) return '처리된 항목이 없습니다'
  if (failures === 0) return `${successes}개 처리 완료`
  if (successes === 0) return `${failures}개 모두 실패`
  return `${successes}개 성공 · ${failures}개 실패`
}
