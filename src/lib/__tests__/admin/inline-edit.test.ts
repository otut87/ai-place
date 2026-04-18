import { describe, it, expect } from 'vitest'
import {
  INLINE_FIELDS,
  isInlineField,
  validateInlineField,
  normalizeTagsInput,
  type InlineField,
} from '@/lib/admin/inline-edit'

describe('isInlineField', () => {
  it('accepts whitelisted fields', () => {
    for (const f of INLINE_FIELDS) expect(isInlineField(f)).toBe(true)
  })

  it('rejects anything else', () => {
    expect(isInlineField('status')).toBe(false)
    expect(isInlineField('')).toBe(false)
    expect(isInlineField('__proto__')).toBe(false)
  })
})

describe('validateInlineField — name', () => {
  it('accepts a non-empty trimmed value', () => {
    const r = validateInlineField('name', '  수피부과  ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('수피부과')
  })

  it('rejects an empty value', () => {
    const r = validateInlineField('name', '   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/비어/)
  })

  it('rejects a value longer than 100 chars', () => {
    const r = validateInlineField('name', 'a'.repeat(101))
    expect(r.ok).toBe(false)
  })
})

describe('validateInlineField — phone', () => {
  it('accepts a valid phone with digits / dashes / spaces', () => {
    const r = validateInlineField('phone', '041-555-1234')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('041-555-1234')
  })

  it('strips surrounding whitespace', () => {
    const r = validateInlineField('phone', '  02-123-4567 ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('02-123-4567')
  })

  it('allows empty (clears field)', () => {
    const r = validateInlineField('phone', '')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('')
  })

  it('rejects alphabet characters', () => {
    const r = validateInlineField('phone', 'call-me')
    expect(r.ok).toBe(false)
  })
})

describe('validateInlineField — tags', () => {
  it('splits on commas and returns trimmed unique tags', () => {
    const r = validateInlineField('tags', ' 친절, 깔끔  ,친절')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual(['친절', '깔끔'])
  })

  it('splits on whitespace when no commas', () => {
    const r = validateInlineField('tags', '친절 깔끔 전문')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual(['친절', '깔끔', '전문'])
  })

  it('returns empty array for empty input', () => {
    const r = validateInlineField('tags', '   ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual([])
  })

  it('rejects when > 10 tags', () => {
    const r = validateInlineField('tags', Array.from({ length: 11 }, (_, i) => `t${i}`).join(','))
    expect(r.ok).toBe(false)
  })
})

describe('validateInlineField — rejects unknown field', () => {
  it('rejects non-whitelisted field', () => {
    const r = validateInlineField('status' as InlineField, 'active')
    expect(r.ok).toBe(false)
  })
})

describe('normalizeTagsInput', () => {
  it('handles comma-separated', () => {
    expect(normalizeTagsInput('a, b, c')).toEqual(['a', 'b', 'c'])
  })

  it('handles whitespace-separated', () => {
    expect(normalizeTagsInput('a  b\tc')).toEqual(['a', 'b', 'c'])
  })

  it('drops duplicates (case-sensitive)', () => {
    expect(normalizeTagsInput('친절,깔끔,친절')).toEqual(['친절', '깔끔'])
  })
})
