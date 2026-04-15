/**
 * /about 페이지 TDD 테스트
 * - generatePerson() JSON-LD 구조 검증
 * - generateProfilePage() JSON-LD 구조 검증
 * - 저자 데이터 일관성 검증 (author-card ↔ jsonld)
 */
import { describe, it, expect } from 'vitest'
import { generatePerson, generateProfilePage, generateArticle } from '@/lib/jsonld'

// ===== 1. generatePerson JSON-LD =====
describe('generatePerson()', () => {
  it('Person 스키마 필수 필드를 포함', () => {
    const person = generatePerson()

    expect(person['@context']).toBe('https://schema.org')
    expect(person['@type']).toBe('Person')
    expect(person['@id']).toBe('https://aiplace.kr/about#person')
    expect(person.name).toBe('이지수')
    expect(person.jobTitle).toBe('AI Place 큐레이터')
    expect(person.url).toBe('https://aiplace.kr/about')
  })

  it('worksFor가 Organization @id를 참조', () => {
    const person = generatePerson()

    expect(person.worksFor).toBeDefined()
    expect(person.worksFor['@type']).toBe('Organization')
    expect(person.worksFor['@id']).toBe('https://aiplace.kr/#organization')
  })

  it('description이 존재하고 비어있지 않음', () => {
    const person = generatePerson()

    expect(person.description).toBeTruthy()
    expect(typeof person.description).toBe('string')
    expect(person.description.length).toBeGreaterThan(10)
  })
})

// ===== 2. generateProfilePage JSON-LD =====
describe('generateProfilePage()', () => {
  it('ProfilePage 스키마 필수 필드를 포함', () => {
    const page = generateProfilePage()

    expect(page['@context']).toBe('https://schema.org')
    expect(page['@type']).toBe('ProfilePage')
    expect(page['@id']).toBe('https://aiplace.kr/about')
    expect(page.name).toBeTruthy()
    expect(page.description).toBeTruthy()
  })

  it('mainEntity가 Person @id를 참조', () => {
    const page = generateProfilePage()

    expect(page.mainEntity).toBeDefined()
    expect(page.mainEntity['@id']).toBe('https://aiplace.kr/about#person')
  })

  it('dateModified가 유효한 날짜 형식', () => {
    const page = generateProfilePage()

    expect(page.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ===== 3. 저자 데이터 일관성 =====
describe('저자 데이터 일관성', () => {
  it('generatePerson과 generateArticle의 저자 정보 일치', () => {
    const person = generatePerson()
    const article = generateArticle({
      title: 'test',
      description: 'test',
      lastUpdated: '2026-04-16',
      url: 'https://aiplace.kr/test',
    })

    expect(article.author.name).toBe(person.name)
    expect(article.author.jobTitle).toBe(person.jobTitle)
    expect(article.author.url).toBe(person.url)
  })
})
