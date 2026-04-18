import { describe, it, expect } from 'vitest'
import {
  OWNER_EDITABLE_FIELDS,
  isOwnerEditableField,
  canOwnerEdit,
  normalizeOwnerPatch,
  validateOwnerPatch,
} from '@/lib/owner/permissions'

describe('OWNER_EDITABLE_FIELDS', () => {
  it('제한된 화이트리스트만 포함', () => {
    expect(OWNER_EDITABLE_FIELDS).toContain('description')
    expect(OWNER_EDITABLE_FIELDS).toContain('phone')
    expect(OWNER_EDITABLE_FIELDS).toContain('opening_hours')
    expect(OWNER_EDITABLE_FIELDS).toContain('tags')
    // 어드민 전용
    expect(OWNER_EDITABLE_FIELDS).not.toContain('status')
    expect(OWNER_EDITABLE_FIELDS).not.toContain('slug')
    expect(OWNER_EDITABLE_FIELDS).not.toContain('city')
    expect(OWNER_EDITABLE_FIELDS).not.toContain('category')
  })
})

describe('isOwnerEditableField', () => {
  it('허용 필드 true', () => {
    expect(isOwnerEditableField('phone')).toBe(true)
    expect(isOwnerEditableField('description')).toBe(true)
  })
  it('금지 필드 false', () => {
    expect(isOwnerEditableField('status')).toBe(false)
    expect(isOwnerEditableField('owner_id')).toBe(false)
    expect(isOwnerEditableField('unknown')).toBe(false)
  })
})

describe('canOwnerEdit', () => {
  const userEmail = 'owner@x.com'
  it('owner_email 이 같으면 허용', () => {
    expect(canOwnerEdit({ owner_id: null, owner_email: userEmail }, { userId: 'uid', email: userEmail })).toBe(true)
  })
  it('owner_id 가 같으면 허용', () => {
    expect(canOwnerEdit({ owner_id: 'uid', owner_email: 'other@x.com' }, { userId: 'uid', email: 'other2@x.com' })).toBe(true)
  })
  it('둘 다 다르면 거부', () => {
    expect(canOwnerEdit({ owner_id: 'uid-1', owner_email: 'a@x.com' }, { userId: 'uid-2', email: 'b@x.com' })).toBe(false)
  })
  it('place 없음 → 거부', () => {
    expect(canOwnerEdit(null, { userId: 'uid', email: 'a@x.com' })).toBe(false)
  })
})

describe('normalizeOwnerPatch', () => {
  it('허용 필드만 뽑아 반환', () => {
    const patch = normalizeOwnerPatch({
      description: 'new',
      phone: '010-1',
      status: 'active',     // 제거되어야 함
      slug: 'hack',         // 제거되어야 함
    })
    expect(patch).toEqual({ description: 'new', phone: '010-1' })
  })

  it('undefined 값은 제외', () => {
    const patch = normalizeOwnerPatch({ description: undefined, phone: '010' })
    expect(patch).toEqual({ phone: '010' })
  })

  it('빈 객체는 빈 객체', () => {
    expect(normalizeOwnerPatch({})).toEqual({})
  })
})

describe('validateOwnerPatch', () => {
  it('빈 패치 거부', () => {
    const r = validateOwnerPatch({})
    expect(r.ok).toBe(false)
  })

  it('phone 형식 불량 거부', () => {
    const r = validateOwnerPatch({ phone: 'not-a-phone!' })
    expect(r.ok).toBe(false)
  })

  it('description 10자 미만 거부', () => {
    const r = validateOwnerPatch({ description: '짧음' })
    expect(r.ok).toBe(false)
  })

  it('tags 10개 초과 거부', () => {
    const r = validateOwnerPatch({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })
    expect(r.ok).toBe(false)
  })

  it('opening_hours 배열 형식이 아니면 거부', () => {
    const r = validateOwnerPatch({ opening_hours: 'Mo 09-18' as unknown as string[] })
    expect(r.ok).toBe(false)
  })

  it('정상 패치 허용', () => {
    const r = validateOwnerPatch({
      description: '천안 불당 위치. 피부과 전문 진료.',
      phone: '041-123-4567',
      tags: ['천안', '피부과'],
      opening_hours: ['Mo-Fr 09:00-18:00'],
    })
    expect(r.ok).toBe(true)
  })
})
