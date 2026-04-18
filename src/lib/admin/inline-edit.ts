export const INLINE_FIELDS = ['name', 'phone', 'tags'] as const
export type InlineField = (typeof INLINE_FIELDS)[number]

const INLINE_FIELD_SET: ReadonlySet<string> = new Set(INLINE_FIELDS)

export function isInlineField(value: unknown): value is InlineField {
  return typeof value === 'string' && INLINE_FIELD_SET.has(value)
}

export type ValidatedValue =
  | { field: 'name'; value: string }
  | { field: 'phone'; value: string }
  | { field: 'tags'; value: string[] }

export type ValidationResult =
  | { ok: true; value: ValidatedValue['value'] }
  | { ok: false; error: string }

const NAME_MAX = 100
const PHONE_RE = /^[\d\s\-+()]*$/
const MAX_TAGS = 10

export function normalizeTagsInput(raw: string): string[] {
  if (!raw) return []
  const pieces = raw.includes(',') ? raw.split(',') : raw.split(/\s+/)
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of pieces) {
    const t = p.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

export function validateInlineField(field: InlineField, raw: string): ValidationResult {
  if (!isInlineField(field)) return { ok: false, error: '허용되지 않은 필드입니다.' }

  if (field === 'name') {
    const v = raw.trim()
    if (v.length === 0) return { ok: false, error: '이름은 비어 있을 수 없습니다.' }
    if (v.length > NAME_MAX) return { ok: false, error: `이름은 ${NAME_MAX}자 이내여야 합니다.` }
    return { ok: true, value: v }
  }

  if (field === 'phone') {
    const v = raw.trim()
    if (v.length === 0) return { ok: true, value: '' }
    if (!PHONE_RE.test(v)) return { ok: false, error: '전화번호 형식이 올바르지 않습니다.' }
    return { ok: true, value: v }
  }

  // tags
  const tags = normalizeTagsInput(raw)
  if (tags.length > MAX_TAGS) return { ok: false, error: `태그는 최대 ${MAX_TAGS}개까지 입력할 수 있습니다.` }
  return { ok: true, value: tags }
}
