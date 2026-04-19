// T-124 — authors.ts 단일 저자 소스 테스트.
import { describe, it, expect } from 'vitest'
import { getDefaultAuthor, authorToPersonJsonLd } from '@/lib/authors'

describe('getDefaultAuthor', () => {
  it('이지수 큐레이터 정보', () => {
    const a = getDefaultAuthor()
    expect(a.name).toBe('이지수')
    expect(a.jobTitle).toContain('큐레이터')
    expect(a.id).toContain('#person')
    expect(a.url).toContain('/about')
  })
})

describe('authorToPersonJsonLd', () => {
  it('Schema.org Person 형식으로 변환', () => {
    const p = authorToPersonJsonLd(getDefaultAuthor())
    expect(p['@type']).toBe('Person')
    expect(p['@id']).toBeTruthy()
    expect(p.name).toBe('이지수')
    expect(p.jobTitle).toBeTruthy()
    expect(p.url).toBeTruthy()
  })
})
