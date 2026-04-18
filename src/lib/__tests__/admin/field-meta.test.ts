import { describe, it, expect } from 'vitest'
import {
  FIELD_META_FIELDS,
  isMetaField,
  buildFieldMeta,
  mergeFieldMeta,
  parseFieldMeta,
  summarizeSource,
  type FieldMeta,
  type FieldMetaEntry,
} from '@/lib/admin/field-meta'

describe('FIELD_META_FIELDS / isMetaField', () => {
  it('주요 AI 대상 필드만 포함', () => {
    expect(FIELD_META_FIELDS).toContain('description')
    expect(FIELD_META_FIELDS).toContain('services')
    expect(FIELD_META_FIELDS).toContain('faqs')
    expect(FIELD_META_FIELDS).toContain('tags')
    expect(FIELD_META_FIELDS).toContain('recommendation_note')
  })
  it('화이트리스트 외는 false', () => {
    expect(isMetaField('description')).toBe(true)
    expect(isMetaField('status')).toBe(false)
    expect(isMetaField('owner_id')).toBe(false)
    expect(isMetaField('')).toBe(false)
  })
})

describe('buildFieldMeta', () => {
  it('AI source + confidence 구성', () => {
    const m = buildFieldMeta('description', { source: 'ai:sonnet-4-6', confidence: 0.82 })
    expect(m.description?.source).toBe('ai:sonnet-4-6')
    expect(m.description?.confidence).toBe(0.82)
    expect(m.description?.generated_at).toBeDefined()
  })
  it('수동 source', () => {
    const m = buildFieldMeta('services', { source: 'manual' })
    expect(m.services?.source).toBe('manual')
    // manual 은 confidence 생략
    expect(m.services?.confidence).toBeUndefined()
  })
  it('허용되지 않은 필드 → 빈 객체', () => {
    expect(buildFieldMeta('status' as never, { source: 'manual' })).toEqual({})
  })
  it('confidence 범위 밖 → 클램프', () => {
    expect(buildFieldMeta('tags', { source: 'ai:x', confidence: 1.5 }).tags?.confidence).toBe(1)
    expect(buildFieldMeta('tags', { source: 'ai:x', confidence: -0.5 }).tags?.confidence).toBe(0)
  })
})

describe('mergeFieldMeta', () => {
  it('기존 메타 + 신규 병합', () => {
    const prev: FieldMeta = {
      description: { source: 'manual', generated_at: '2026-04-01' },
      services: { source: 'manual', generated_at: '2026-04-01' },
    }
    const patch: FieldMeta = {
      description: { source: 'ai:sonnet-4-6', confidence: 0.8, generated_at: '2026-04-18' },
    }
    const merged = mergeFieldMeta(prev, patch)
    expect(merged.description?.source).toBe('ai:sonnet-4-6')
    // services 는 유지
    expect(merged.services?.source).toBe('manual')
  })
  it('null 들어오면 기존 그대로', () => {
    const prev: FieldMeta = { description: { source: 'manual', generated_at: '2026-04-01' } }
    expect(mergeFieldMeta(prev, null)).toEqual(prev)
  })
})

describe('parseFieldMeta', () => {
  it('JSON 문자열·오브젝트 둘 다 파싱', () => {
    expect(parseFieldMeta({ description: { source: 'manual', generated_at: 'x' } })).not.toBeNull()
    expect(parseFieldMeta(null)).toEqual({})
    expect(parseFieldMeta(undefined)).toEqual({})
  })
  it('비정상 값은 빈 객체', () => {
    expect(parseFieldMeta('not-json')).toEqual({})
    expect(parseFieldMeta(123)).toEqual({})
  })
  it('화이트리스트 필드만 통과', () => {
    const parsed = parseFieldMeta({
      description: { source: 'ai:x', generated_at: 't' },
      bogus: { source: 'ai:x', generated_at: 't' },
    })
    expect(parsed.description).toBeDefined()
    expect((parsed as Record<string, unknown>).bogus).toBeUndefined()
  })
})

describe('summarizeSource', () => {
  it('AI 소스는 라벨 + confidence', () => {
    const m: FieldMetaEntry = { source: 'ai:sonnet-4-6', confidence: 0.82, generated_at: 't' }
    expect(summarizeSource(m)).toContain('AI')
    expect(summarizeSource(m)).toContain('0.82')
  })
  it('manual 은 "수동"', () => {
    expect(summarizeSource({ source: 'manual', generated_at: 't' })).toContain('수동')
  })
  it('undefined → 빈 문자열', () => {
    expect(summarizeSource(undefined)).toBe('')
  })
})
