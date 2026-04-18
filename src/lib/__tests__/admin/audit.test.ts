import { describe, it, expect } from 'vitest'
import {
  diffUpdate,
  isAuditableField,
  summarizeAction,
  AUDITABLE_FIELDS,
  AUDIT_ACTIONS,
  type AuditAction,
} from '@/lib/admin/audit'

describe('AUDITABLE_FIELDS 상수', () => {
  it('주요 업체 필드를 포함', () => {
    expect(AUDITABLE_FIELDS).toContain('name')
    expect(AUDITABLE_FIELDS).toContain('description')
    expect(AUDITABLE_FIELDS).toContain('status')
    expect(AUDITABLE_FIELDS).toContain('tags')
    expect(AUDITABLE_FIELDS).toContain('phone')
    expect(AUDITABLE_FIELDS).toContain('images')
  })
})

describe('isAuditableField', () => {
  it('화이트리스트 필드 허용', () => {
    expect(isAuditableField('name')).toBe(true)
    expect(isAuditableField('status')).toBe(true)
  })
  it('화이트리스트 외 필드 거부', () => {
    expect(isAuditableField('unknown')).toBe(false)
    expect(isAuditableField('')).toBe(false)
    expect(isAuditableField(undefined)).toBe(false)
  })
})

describe('diffUpdate', () => {
  it('변경된 필드만 반환', () => {
    const before = { name: 'A', description: 'old desc', phone: '010' }
    const after = { name: 'A', description: 'new desc', phone: '010' }
    const diffs = diffUpdate(before, after)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].field).toBe('description')
    expect(diffs[0].before).toBe('old desc')
    expect(diffs[0].after).toBe('new desc')
  })

  it('배열 필드도 JSON 동등 비교', () => {
    const before = { tags: ['a', 'b'] }
    const after = { tags: ['a', 'b', 'c'] }
    const diffs = diffUpdate(before, after)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].after).toEqual(['a', 'b', 'c'])
  })

  it('동일 배열은 diff 없음', () => {
    const before = { tags: ['a', 'b'] }
    const after = { tags: ['a', 'b'] }
    expect(diffUpdate(before, after)).toHaveLength(0)
  })

  it('화이트리스트 외 필드는 무시', () => {
    const before = { name: 'A', secret: 'x' }
    const after = { name: 'A', secret: 'y' }
    expect(diffUpdate(before, after)).toHaveLength(0)
  })

  it('null ↔ value 전환도 감지', () => {
    const before = { phone: null }
    const after = { phone: '010' }
    const diffs = diffUpdate(before, after)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].before).toBeNull()
    expect(diffs[0].after).toBe('010')
  })
})

describe('summarizeAction', () => {
  it('각 action 에 한국어 요약 반환', () => {
    const actions: AuditAction[] = ['create', 'update', 'status', 'delete', 'restore']
    for (const a of actions) {
      expect(summarizeAction(a)).not.toBe('')
    }
  })
  it('status 변경은 before/after 요약 포함', () => {
    const s = summarizeAction('status', { before: 'pending', after: 'active' })
    expect(s).toContain('pending')
    expect(s).toContain('active')
  })
  it('update 는 필드명 포함', () => {
    const s = summarizeAction('update', { field: 'name' })
    expect(s).toContain('name')
  })
})

describe('AUDIT_ACTIONS 상수', () => {
  it('5종 액션 모두 포함', () => {
    expect(AUDIT_ACTIONS).toEqual(['create', 'update', 'status', 'delete', 'restore'])
  })
})
