import { describe, it, expect } from 'vitest'
import {
  validatePlaceDraft,
  type PlaceDraft,
} from '@/lib/admin/place-validation'

function baseDraft(overrides: Partial<PlaceDraft> = {}): PlaceDraft {
  return {
    name: '수피부과',
    city: 'cheonan',
    category: 'dermatology',
    slug: 'su-dermatology',
    description: '수피부과는 천안에서 운영 중인 피부과 전문 클리닉입니다.',
    address: '충남 천안시 동남구 ...',
    phone: '041-555-1234',
    hours: [{ day: 'Mo', open: '10:00', close: '19:00', closed: false }],
    services: [{ name: '여드름 치료', description: '여드름 전문', priceRange: '5-10만원' }],
    faqs: [{ question: '예약이 필요한가요?', answer: '네, 전화나 온라인 예약이 가능합니다.' }],
    tags: ['여드름', '레이저'],
    sameAs: ['https://place.naver.com/place/123'],
    ...overrides,
  }
}

describe('validatePlaceDraft — required fields', () => {
  it('passes a complete draft with no errors', () => {
    const r = validatePlaceDraft(baseDraft())
    expect(Object.keys(r.errors)).toEqual([])
  })

  it('flags missing name', () => {
    const r = validatePlaceDraft(baseDraft({ name: '  ' }))
    expect(r.errors.name).toBeTruthy()
  })

  it('flags missing city / category / slug', () => {
    const r = validatePlaceDraft(baseDraft({ city: '', category: '', slug: '' }))
    expect(r.errors.city).toBeTruthy()
    expect(r.errors.category).toBeTruthy()
    expect(r.errors.slug).toBeTruthy()
  })

  it('flags invalid slug format', () => {
    const r = validatePlaceDraft(baseDraft({ slug: '대문자_슬래시' }))
    expect(r.errors.slug).toMatch(/슬러그/)
  })

  it('flags too-short description', () => {
    const r = validatePlaceDraft(baseDraft({ description: '짧아요' }))
    expect(r.errors.description).toBeTruthy()
  })

  it('flags missing address and phone', () => {
    const r = validatePlaceDraft(baseDraft({ address: '', phone: '' }))
    expect(r.errors.address).toBeTruthy()
    expect(r.errors.phone).toBeTruthy()
  })

  it('flags invalid phone', () => {
    const r = validatePlaceDraft(baseDraft({ phone: 'abc' }))
    expect(r.errors.phone).toBeTruthy()
  })

  it('flags when no FAQ is fully filled', () => {
    const r = validatePlaceDraft(baseDraft({ faqs: [{ question: '', answer: '' }] }))
    expect(r.errors.faqs).toBeTruthy()
  })
})

describe('validatePlaceDraft — warnings', () => {
  it('warns when opening hours are empty', () => {
    const r = validatePlaceDraft(baseDraft({ hours: [] }))
    expect(r.warnings.some((w) => w.includes('영업시간'))).toBe(true)
  })

  it('warns when services are empty', () => {
    const r = validatePlaceDraft(baseDraft({ services: [{ name: '', description: '', priceRange: '' }] }))
    expect(r.warnings.some((w) => w.includes('서비스'))).toBe(true)
  })

  it('warns when tags are empty', () => {
    const r = validatePlaceDraft(baseDraft({ tags: [] }))
    expect(r.warnings.some((w) => w.includes('태그'))).toBe(true)
  })

  it('warns when sameAs is empty', () => {
    const r = validatePlaceDraft(baseDraft({ sameAs: [] }))
    expect(r.warnings.some((w) => w.toLowerCase().includes('sameas') || w.includes('외부'))).toBe(true)
  })
})

describe('validatePlaceDraft — completeness', () => {
  it('is 100 for a complete draft', () => {
    expect(validatePlaceDraft(baseDraft()).completeness).toBe(100)
  })

  it('is 0 for an empty draft', () => {
    const empty: PlaceDraft = {
      name: '',
      city: '',
      category: '',
      slug: '',
      description: '',
      address: '',
      phone: '',
      hours: [],
      services: [{ name: '', description: '', priceRange: '' }],
      faqs: [{ question: '', answer: '' }],
      tags: [],
      sameAs: [],
    }
    expect(validatePlaceDraft(empty).completeness).toBe(0)
  })

  it('is between 0 and 100 for partial drafts', () => {
    const r = validatePlaceDraft(baseDraft({ hours: [], services: [{ name: '', description: '', priceRange: '' }], tags: [], sameAs: [] }))
    expect(r.completeness).toBeGreaterThan(0)
    expect(r.completeness).toBeLessThan(100)
  })
})
