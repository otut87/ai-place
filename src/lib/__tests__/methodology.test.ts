// T-125 — /about/methodology 조사 방법론 페이지 테스트.
import { describe, it, expect } from 'vitest'
import {
  getMethodologyFaqs,
  getMethodologySources,
  getMethodologyUpdateCadence,
  getEeatCriteria,
} from '@/lib/methodology'

describe('T-125 methodology module', () => {
  it('getMethodologyFaqs: 최소 4개 FAQ 반환 (AEO)', () => {
    const faqs = getMethodologyFaqs()
    expect(faqs.length).toBeGreaterThanOrEqual(4)
    faqs.forEach(f => {
      expect(f.question.length).toBeGreaterThan(5)
      expect(f.answer.length).toBeGreaterThan(20)
    })
  })

  it('getMethodologySources: 출처 4종(공식·지도·리뷰·AI) 포함', () => {
    const sources = getMethodologySources()
    const labels = sources.map(s => s.label).join(' ')
    expect(labels).toMatch(/공식/)
    expect(labels).toMatch(/지도|Google|Kakao/)
    expect(labels).toMatch(/리뷰/)
    sources.forEach(s => {
      expect(s.purpose.length).toBeGreaterThan(10)
    })
  })

  it('getMethodologyUpdateCadence: 주·월·분기 갱신 주기 포함', () => {
    const cadence = getMethodologyUpdateCadence()
    const periods = cadence.map(c => c.period).join(' ')
    expect(periods).toMatch(/주/)
    expect(periods).toMatch(/월|분기/)
  })

  it('getEeatCriteria: Experience/Expertise/Authoritativeness/Trustworthiness 4축', () => {
    const e = getEeatCriteria()
    expect(e).toHaveLength(4)
    const axes = e.map(x => x.axis).join(' ')
    expect(axes).toContain('Experience')
    expect(axes).toContain('Expertise')
    expect(axes).toContain('Authoritativeness')
    expect(axes).toContain('Trustworthiness')
  })
})
