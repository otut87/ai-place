import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  normalizeRow,
  validateCsvRow,
  summarizeImport,
  CSV_TEMPLATE_HEADERS,
} from '@/lib/admin/csv-import'

describe('parseCsv', () => {
  it('parses a simple header + row', () => {
    const r = parseCsv('name,city,category\n수피부과,cheonan,dermatology')
    expect(r.headers).toEqual(['name', 'city', 'category'])
    expect(r.rows).toEqual([{ name: '수피부과', city: 'cheonan', category: 'dermatology' }])
  })

  it('handles quoted fields with commas', () => {
    const r = parseCsv('name,address\n"수피부과","천안시 동남구, 번영로 1"')
    expect(r.rows[0]).toEqual({ name: '수피부과', address: '천안시 동남구, 번영로 1' })
  })

  it('handles escaped quotes inside fields', () => {
    const r = parseCsv('name,description\n"K","그는 ""좋아요"" 라고 말했다"')
    expect(r.rows[0].description).toBe('그는 "좋아요" 라고 말했다')
  })

  it('handles CRLF line endings', () => {
    const r = parseCsv('name,city\r\na,b\r\nc,d\r\n')
    expect(r.rows).toEqual([
      { name: 'a', city: 'b' },
      { name: 'c', city: 'd' },
    ])
  })

  it('ignores empty trailing lines', () => {
    const r = parseCsv('name\na\n\n\n')
    expect(r.rows).toEqual([{ name: 'a' }])
  })

  it('throws on empty input', () => {
    expect(() => parseCsv('')).toThrow()
  })
})

describe('normalizeRow', () => {
  const cities = ['cheonan']
  const categories = ['dermatology', 'dental']

  it('trims whitespace and lowercases slugs', () => {
    const r = normalizeRow(
      { name: '  수피부과 ', city: ' Cheonan ', category: 'Dermatology', slug: '  SU-DERM  ' },
      { cities, categories },
    )
    expect(r.name).toBe('수피부과')
    expect(r.city).toBe('cheonan')
    expect(r.category).toBe('dermatology')
    expect(r.slug).toBe('su-derm')
  })

  it('splits tags on commas', () => {
    const r = normalizeRow({ tags: '여드름, 레이저, 보톡스' }, { cities, categories })
    expect(r.tags).toEqual(['여드름', '레이저', '보톡스'])
  })

  it('defaults missing optional fields', () => {
    const r = normalizeRow({ name: 'X' }, { cities, categories })
    expect(r.phone).toBe('')
    expect(r.tags).toEqual([])
    expect(r.description).toBe('')
  })
})

describe('validateCsvRow', () => {
  const cities = ['cheonan']
  const categories = ['dermatology']

  it('accepts a fully valid row', () => {
    const normalized = normalizeRow(
      {
        name: '수피부과',
        city: 'cheonan',
        category: 'dermatology',
        slug: 'su-derm',
        address: '천안 동남구',
        phone: '041-000-0000',
        description: '천안의 피부과 전문 클리닉입니다.',
      },
      { cities, categories },
    )
    const r = validateCsvRow(normalized, { cities, categories })
    expect(r.ok).toBe(true)
  })

  it('rejects unknown city', () => {
    const normalized = normalizeRow(
      { name: 'X', city: 'seoul', category: 'dermatology', slug: 'x', address: 'a', phone: '02-0', description: 'long description here' },
      { cities, categories },
    )
    const r = validateCsvRow(normalized, { cities, categories })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('도시'))).toBe(true)
  })

  it('rejects unknown category', () => {
    const normalized = normalizeRow(
      { name: 'X', city: 'cheonan', category: 'martian', slug: 'x', address: 'a', phone: '02-0', description: 'long description here' },
      { cities, categories },
    )
    const r = validateCsvRow(normalized, { cities, categories })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.some((e) => e.includes('업종'))).toBe(true)
  })

  it('rejects bad slug', () => {
    const normalized = normalizeRow(
      { name: 'X', city: 'cheonan', category: 'dermatology', slug: 'NOT OK', address: 'a', phone: '02-0', description: 'long description' },
      { cities, categories },
    )
    const r = validateCsvRow(normalized, { cities, categories })
    expect(r.ok).toBe(false)
  })

  it('accumulates multiple errors', () => {
    const normalized = normalizeRow({ name: '', city: '', category: '', slug: '', address: '', phone: '', description: '' }, { cities, categories })
    const r = validateCsvRow(normalized, { cities, categories })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.length).toBeGreaterThan(3)
  })
})

describe('summarizeImport', () => {
  it('formats an all-success import', () => {
    const s = summarizeImport({ success: 10, failed: 0 })
    expect(s).toBe('10개 등록 완료')
  })

  it('formats partial failure', () => {
    expect(summarizeImport({ success: 7, failed: 3 })).toBe('7개 등록 · 3개 실패')
  })

  it('formats all-failed import', () => {
    expect(summarizeImport({ success: 0, failed: 5 })).toBe('5개 모두 실패')
  })

  it('formats empty import', () => {
    expect(summarizeImport({ success: 0, failed: 0 })).toBe('가져올 행이 없습니다')
  })
})

describe('CSV_TEMPLATE_HEADERS', () => {
  it('includes the required columns', () => {
    for (const h of ['name', 'city', 'category', 'slug', 'address', 'phone', 'description']) {
      expect(CSV_TEMPLATE_HEADERS).toContain(h)
    }
  })
})
