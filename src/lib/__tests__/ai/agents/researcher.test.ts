// T-197 — Researcher 테스트 (deterministic, mock 불필요).
import { describe, it, expect } from 'vitest'
import { buildResearchPack } from '@/lib/ai/agents/researcher'
import type { Place } from '@/lib/types'

function mkPlace(overrides: Partial<Place> & { slug: string }): Place {
  return {
    city: 'cheonan', category: 'dermatology', description: '',
    address: '', services: [], faqs: [], tags: [],
    rating: 4.5, reviewCount: 10,
    name: overrides.slug,
    ...overrides,
  }
}

describe('buildResearchPack', () => {
  it('빈 places → 빈 pack', () => {
    const r = buildResearchPack([])
    expect(r.reviewHighlights).toEqual([])
    expect(r.priceBands).toEqual([])
    expect(r.channels).toEqual({})
  })

  it('services 에서 priceRange 추출', () => {
    const places = [mkPlace({
      slug: 'a',
      services: [
        { name: '여드름 치료', priceRange: '30,000~50,000원' },
        { name: '리프팅', priceRange: '100,000원' },
        { name: '상담', priceRange: null as unknown as string }, // null 제외
      ],
    })]
    const r = buildResearchPack(places)
    expect(r.priceBands).toContain('여드름 치료: 30,000~50,000원')
    expect(r.priceBands.length).toBe(2)
  })

  it('reviewSummaries positiveThemes 를 highlights 로', () => {
    const p: Place & { reviewSummaries?: Array<{ positiveThemes: string[] }> } = {
      ...mkPlace({ slug: 'a' }),
      reviewSummaries: [
        { positiveThemes: ['친절한 상담', '청결한 시설'] },
      ],
    }
    const r = buildResearchPack([p])
    expect(r.reviewHighlights).toContain('친절한 상담')
    expect(r.reviewHighlights).toContain('청결한 시설')
  })

  it('강점·추천 대상·채널 추출', () => {
    const p = mkPlace({
      slug: 'a',
      strengths: ['전문의 다수', '야간 진료'],
      recommendedFor: ['직장인', '학생'],
      naverPlaceUrl: 'https://naver.x',
      kakaoMapUrl: 'https://kakao.x',
      googleBusinessUrl: 'https://google.x',
      phone: '041-123-4567',
    })
    const r = buildResearchPack([p])
    expect(r.strengths).toContain('전문의 다수')
    expect(r.recommendedFor).toContain('직장인')
    expect(r.channels.naver).toBe('https://naver.x')
    expect(r.channels.kakao).toBe('https://kakao.x')
    expect(r.contact).toBe('041-123-4567')
  })

  it('openingHours 첫 업체 대표값 (string[] 타입)', () => {
    const places = [
      mkPlace({ slug: 'a', openingHours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'] }),
      mkPlace({ slug: 'b', openingHours: ['Mo-Su 10:00-20:00'] }),
    ]
    const r = buildResearchPack(places)
    expect(r.hoursBand).toMatch(/Mo-Fr|Sa/)
  })

  it('specialties 는 medicalSpecialty + services 합집합', () => {
    const p = {
      ...mkPlace({
        slug: 'a',
        services: [
          { name: '여드름 치료' },
          { name: '리프팅' },
        ],
      }),
      medicalSpecialty: ['Dermatology', 'Cosmetic'],
    } as Place & { medicalSpecialty?: string[] }
    const r = buildResearchPack([p])
    expect(r.specialties).toContain('Dermatology')
    expect(r.specialties).toContain('여드름 치료')
  })
})
