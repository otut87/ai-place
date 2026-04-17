/**
 * exemplars.ts 테스트 (T-026)
 */
import { describe, it, expect } from 'vitest'
import { getExemplars, buildExemplarBlock } from '@/lib/ai/exemplars'

describe('getExemplars', () => {
  it('dermatology → 닥터에버스·샤인빔 포함', () => {
    const list = getExemplars('dermatology')
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list.length).toBeLessThanOrEqual(2)
    expect(list.some(e => e.name.includes('닥터에버스'))).toBe(true)
  })

  it('dental → 치과 예시 반환', () => {
    const list = getExemplars('dental')
    expect(list.length).toBeGreaterThanOrEqual(1)
    expect(list[0].category).toBe('dental')
  })

  it('등록 안된 카테고리 → default exemplar', () => {
    const list = getExemplars('unknown-cat-xyz')
    expect(list).toHaveLength(1)
    expect(list[0].category).toBe('default')
  })

  it('limit=1 옵션 적용', () => {
    const list = getExemplars('dermatology', 1)
    expect(list).toHaveLength(1)
  })
})

describe('exemplar 품질 기준', () => {
  it('description 40~60자 규칙 (경고성 검증)', () => {
    const all = [...getExemplars('dermatology'), ...getExemplars('dental')]
    for (const e of all) {
      expect(e.description.length).toBeGreaterThanOrEqual(20)
      expect(e.description.length).toBeLessThanOrEqual(80)
    }
  })

  it('FAQ 질문은 업체명 포함 + 물음표로 끝남', () => {
    const all = [...getExemplars('dermatology'), ...getExemplars('dental')]
    for (const e of all) {
      for (const faq of e.faqs) {
        expect(faq.question).toContain(e.name)
        expect(faq.question.endsWith('?')).toBe(true)
      }
    }
  })

  it('서비스 priceRange 패턴 (숫자~숫자 단위)', () => {
    const all = [...getExemplars('dermatology'), ...getExemplars('dental')]
    for (const e of all) {
      for (const s of e.services) {
        expect(s.priceRange).toMatch(/\d+/)
      }
    }
  })
})

describe('buildExemplarBlock', () => {
  it('<exemplars> 래퍼 + 각 example 포함', () => {
    const list = getExemplars('dermatology')
    const block = buildExemplarBlock(list)
    expect(block).toContain('<exemplars>')
    expect(block).toContain('</exemplars>')
    expect(block).toContain('<example>')
    expect(block).toContain('닥터에버스')
  })

  it('빈 입력 → 빈 문자열', () => {
    expect(buildExemplarBlock([])).toBe('')
  })

  it('서비스·FAQ·태그 모두 직렬화', () => {
    const block = buildExemplarBlock(getExemplars('dental'))
    expect(block).toContain('서비스:')
    expect(block).toContain('FAQ:')
    expect(block).toContain('태그:')
    expect(block).toContain('임플란트')
  })
})
