import { describe, it, expect } from 'vitest'
import { scorePlaceAeo, toGrade } from '@/lib/owner/place-aeo-score'
import type { Place } from '@/lib/types'

const NOW = new Date('2026-04-22T00:00:00Z')

const fullPlace: Pick<
  Place,
  'name' | 'address' | 'phone' | 'lastUpdated' | 'faqs' | 'reviewSummaries' | 'reviewCount'
  | 'images' | 'imageUrl' | 'openingHours' | 'services'
> = {
  name: '예쁜피부과',
  address: '천안시 불당동 1',
  phone: '+82-41-000-0000',
  lastUpdated: '2026-03-01',
  faqs: [
    { question: 'q1', answer: 'a1' },
    { question: 'q2', answer: 'a2' },
    { question: 'q3', answer: 'a3' },
  ],
  reviewSummaries: [
    { source: 'Google', positiveThemes: ['친절'], negativeThemes: [], lastChecked: '2026-03-01' },
  ],
  reviewCount: 12,
  images: [
    { url: '/a.jpg', alt: 'a', type: 'exterior' },
    { url: '/b.jpg', alt: 'b', type: 'interior' },
    { url: '/c.jpg', alt: 'c', type: 'treatment' },
  ],
  openingHours: ['Mo-Fr 09:00-18:00'],
  services: [{ name: '여드름치료' }],
}

describe('place-aeo-score', () => {
  it('모든 필드 완비 + 언급 2회 → 100점 · A', () => {
    const r = scorePlaceAeo({ place: fullPlace, mentionCount: 2, now: NOW })
    expect(r.score).toBe(100)
    expect(r.grade).toBe('A')
    expect(r.rules.every(x => x.passed)).toBe(true)
    expect(r.missingTotal).toBe(0)
  })

  it('FAQ 0개 → -20 → 80점 · B', () => {
    const r = scorePlaceAeo({
      place: { ...fullPlace, faqs: [] },
      mentionCount: 1,
      now: NOW,
    })
    expect(r.score).toBe(80)
    expect(r.grade).toBe('B')
    const faq = r.rules.find(x => x.id === 'faq-count')!
    expect(faq.passed).toBe(false)
    expect(faq.detail).toBe('현재 0개')
  })

  it('FAQ 10개 초과 → FAIL', () => {
    const r = scorePlaceAeo({
      place: {
        ...fullPlace,
        faqs: Array.from({ length: 11 }, (_, i) => ({ question: `q${i}`, answer: `a${i}` })),
      },
      mentionCount: 1,
      now: NOW,
    })
    expect(r.rules.find(x => x.id === 'faq-count')!.passed).toBe(false)
    expect(r.score).toBe(80)
  })

  it('phone 누락 → JSON-LD 감점 -20', () => {
    const r = scorePlaceAeo({
      place: { ...fullPlace, phone: '' },
      mentionCount: 1,
      now: NOW,
    })
    const rule = r.rules.find(x => x.id === 'jsonld-basics')!
    expect(rule.passed).toBe(false)
    expect(rule.detail).toContain('전화')
    expect(r.score).toBe(80)
  })

  it('lastUpdated 181일 전 → freshness FAIL', () => {
    const old = new Date(NOW.getTime() - 181 * 86_400_000).toISOString().slice(0, 10)
    const r = scorePlaceAeo({
      place: { ...fullPlace, lastUpdated: old },
      mentionCount: 1,
      now: NOW,
    })
    expect(r.rules.find(x => x.id === 'freshness')!.passed).toBe(false)
    expect(r.score).toBe(90)
  })

  it('사진 2장 → photos FAIL, imageUrl 만 있으면 1장 취급', () => {
    const twoImages = scorePlaceAeo({
      place: { ...fullPlace, images: fullPlace.images?.slice(0, 2) },
      mentionCount: 1,
      now: NOW,
    })
    expect(twoImages.rules.find(x => x.id === 'photos-3')!.passed).toBe(false)
    expect(twoImages.rules.find(x => x.id === 'photos-3')!.detail).toBe('2장')

    const legacy = scorePlaceAeo({
      place: { ...fullPlace, images: [], imageUrl: '/x.jpg' },
      mentionCount: 1,
      now: NOW,
    })
    expect(legacy.rules.find(x => x.id === 'photos-3')!.detail).toBe('1장')
  })

  it('언급 0회 → mentioned FAIL', () => {
    const r = scorePlaceAeo({ place: fullPlace, mentionCount: 0, now: NOW })
    const rule = r.rules.find(x => x.id === 'mentioned-in-content')!
    expect(rule.passed).toBe(false)
    expect(rule.detail).toBe('아직 언급 없음')
    expect(r.score).toBe(90)
  })

  it('리뷰 요약 없어도 reviewCount>0 이면 pass', () => {
    const r = scorePlaceAeo({
      place: { ...fullPlace, reviewSummaries: [], reviewCount: 5 },
      mentionCount: 1,
      now: NOW,
    })
    expect(r.rules.find(x => x.id === 'review-summary')!.passed).toBe(true)
  })

  it('최악 — 빈 업체 → 0점 · D', () => {
    const r = scorePlaceAeo({
      place: {
        name: '', address: '', phone: '',
        faqs: [], images: [], openingHours: [], services: [],
      },
      mentionCount: 0,
      now: NOW,
    })
    expect(r.score).toBe(0)
    expect(r.grade).toBe('D')
    expect(r.missingTotal).toBe(100)
  })

  it('grade 경계값', () => {
    expect(toGrade(85)).toBe('A')
    expect(toGrade(84)).toBe('B')
    expect(toGrade(75)).toBe('B')
    expect(toGrade(74)).toBe('C')
    expect(toGrade(60)).toBe('C')
    expect(toGrade(59)).toBe('D')
    expect(toGrade(0)).toBe('D')
  })
})
