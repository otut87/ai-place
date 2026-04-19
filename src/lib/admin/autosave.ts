// T-094 — 자동저장·변경 diff 순수 로직.
// UI 훅은 이 유틸을 사용.

export interface DiffEntry {
  field: string
  before: unknown
  after: unknown
  kind: 'added' | 'removed' | 'changed'
}

export function computeFieldDiff<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fields: (keyof T)[],
): DiffEntry[] {
  const out: DiffEntry[] = []
  for (const key of fields) {
    const b = before[key]
    const a = after[key]
    if (equalsShallow(b, a)) continue
    if (isEmpty(b) && !isEmpty(a)) out.push({ field: String(key), before: b, after: a, kind: 'added' })
    else if (!isEmpty(b) && isEmpty(a)) out.push({ field: String(key), before: b, after: a, kind: 'removed' })
    else out.push({ field: String(key), before: b, after: a, kind: 'changed' })
  }
  return out
}

export function equalsShallow(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((v, i) => equalsShallow(v, b[i]))
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as Record<string, unknown>)
    const bk = Object.keys(b as Record<string, unknown>)
    if (ak.length !== bk.length) return false
    return ak.every(k => equalsShallow((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  }
  return false
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string' && v.trim() === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

/**
 * debounce — 자동저장 훅에서 사용. 마지막 호출만 `delayMs` 후 실행.
 * 취소 가능 (cancel 반환).
 */
export function makeDebouncer<F extends (...args: unknown[]) => void>(fn: F, delayMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  const debounced = (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, delayMs)
  }
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null }
  }
  const flush = (...args: Parameters<F>) => {
    cancel()
    fn(...args)
  }
  return { debounced, cancel, flush }
}
