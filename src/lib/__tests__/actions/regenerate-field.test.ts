import { describe, it, expect } from 'vitest'
import {
  buildFeedback,
  isRegenerateField,
  REGENERATE_FIELDS,
} from '@/lib/actions/regenerate-field'

describe('isRegenerateField', () => {
  it('허용 필드', () => {
    expect(isRegenerateField('description')).toBe(true)
    expect(isRegenerateField('services')).toBe(true)
    expect(isRegenerateField('faqs')).toBe(true)
    expect(isRegenerateField('tags')).toBe(true)
  })

  it('거부', () => {
    expect(isRegenerateField('name')).toBe(false)
    expect(isRegenerateField('phone')).toBe(false)
    expect(isRegenerateField('')).toBe(false)
    expect(isRegenerateField(null)).toBe(false)
    expect(isRegenerateField(undefined)).toBe(false)
  })

  it('REGENERATE_FIELDS 스냅샷', () => {
    expect(REGENERATE_FIELDS).toEqual(['description', 'services', 'faqs', 'tags'])
  })
})

describe('buildFeedback', () => {
  it('길이 short → description 2~3문장 힌트', () => {
    const r = buildFeedback({ field: 'description', length: 'short' })
    expect(r).toContain('2~3문장')
  })

  it('길이 long → 5문장 이상 힌트', () => {
    const r = buildFeedback({ field: 'description', length: 'long' })
    expect(r).toContain('5문장')
  })

  it('services 는 length 무시', () => {
    const r = buildFeedback({ field: 'services', length: 'short' })
    expect(r).not.toContain('2~3문장')
  })

  it('tone 포함', () => {
    const r = buildFeedback({ field: 'tags', tone: '간결' })
    expect(r).toContain('어조: 간결')
  })

  it('키워드 여러 개', () => {
    const r = buildFeedback({ field: 'tags', keywords: ['여드름', '리프팅'] })
    expect(r).toContain('여드름, 리프팅')
  })

  it('빈 옵션 → 빈 문자열', () => {
    expect(buildFeedback({ field: 'description' })).toBe('')
  })
})
