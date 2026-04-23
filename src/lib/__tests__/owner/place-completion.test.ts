// T-219 — 섹션별 완성도 계산기 테스트.

import { describe, it, expect } from 'vitest'
import { calcCompletionItems, sumCompletion } from '@/lib/owner/place-completion'

const BASE = {
  placeId: 'p1',
  name: '', address: '', description: null,
  nameEn: null, phone: null, openingHours: null,
  tags: null, recommendedFor: null, strengths: null,
  services: null, faqs: null, images: null,
  naverPlaceUrl: null, kakaoMapUrl: null, googleBusinessUrl: null,
  homepageUrl: null, blogUrl: null, instagramUrl: null,
}

describe('calcCompletionItems', () => {
  it('모든 필드 비어있음 → 전 항목 muted, 총점 0', () => {
    const items = calcCompletionItems(BASE, '/owner/places/p1')
    expect(items).toHaveLength(7)
    for (const it of items) expect(it.score).toBe(0)
    const sum = sumCompletion(items)
    expect(sum.score).toBe(0)
    expect(sum.percent).toBe(0)
  })

  it('기본 3필드 + 영문명 채움 → 기본 정보 20/20', () => {
    const items = calcCompletionItems({
      ...BASE,
      name: '클린휴', address: '천안 서북구 쌍용로',
      description: '천안 서북구의 피부과 전문 클리닉입니다. 10년 경력, 친절한 상담 제공.',
      nameEn: 'Cleanhue',
    }, '/owner/places/p1')
    const basic = items.find((i) => i.key === 'basic')!
    expect(basic.score).toBe(20)
    expect(basic.level).toBe('good')
  })

  it('전화 + 영업시간 5개 → contact 15/15', () => {
    const items = calcCompletionItems({
      ...BASE,
      phone: '041-123-4567',
      openingHours: ['Mo 09:00-18:00', 'Tu 09:00-18:00', 'We 09:00-18:00', 'Th 09:00-18:00', 'Fr 09:00-18:00'],
    }, '/owner/places/p1')
    const c = items.find((i) => i.key === 'contact')!
    expect(c.score).toBe(15)
  })

  it('서비스 5개 + 가격 모두 등록 → services 20/20', () => {
    const items = calcCompletionItems({
      ...BASE,
      services: Array.from({ length: 5 }, (_, i) => ({
        name: `서비스 ${i + 1}`, description: 'd', priceRange: '5-10만원',
      })),
    }, '/owner/places/p1')
    const s = items.find((i) => i.key === 'services')!
    expect(s.score).toBe(20)
  })

  it('서비스 5개 + 가격 2개만 → 절반만 점수', () => {
    const items = calcCompletionItems({
      ...BASE,
      services: [
        { name: 'A', priceRange: '5만원' },
        { name: 'B', priceRange: '10만원' },
        { name: 'C' }, { name: 'D' }, { name: 'E' },
      ],
    }, '/owner/places/p1')
    const s = items.find((i) => i.key === 'services')!
    // 개수 10 + 가격 (2/5)*10 = 14
    expect(s.score).toBe(14)
    expect(s.level).toBe('warn')
  })

  it('FAQ 3개 → 9/15, 5개 이상 → 15/15', () => {
    const items3 = calcCompletionItems({
      ...BASE,
      faqs: [{ question: 'Q1', answer: 'A1' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }],
    }, '/owner/places/p1')
    expect(items3.find((i) => i.key === 'faq')!.score).toBe(9)

    const items5 = calcCompletionItems({
      ...BASE,
      faqs: Array.from({ length: 5 }, (_, i) => ({ question: `Q${i}`, answer: `A${i}` })),
    }, '/owner/places/p1')
    expect(items5.find((i) => i.key === 'faq')!.score).toBe(15)
  })

  it('외부 링크 6개 모두 채움 → links 10/10', () => {
    const items = calcCompletionItems({
      ...BASE,
      naverPlaceUrl: 'https://naver.me/x',
      kakaoMapUrl: 'https://map.kakao.com/x',
      googleBusinessUrl: 'https://maps.google.com/x',
      homepageUrl: 'https://example.com',
      blogUrl: 'https://blog.naver.com/x',
      instagramUrl: '@x',
    }, '/owner/places/p1')
    const l = items.find((i) => i.key === 'links')!
    expect(l.score).toBe(10)
    expect(l.level).toBe('good')
  })

  it('사진 8장+ → photos 10/10', () => {
    const items = calcCompletionItems({
      ...BASE,
      images: Array.from({ length: 8 }, () => ({ url: 'x', alt: '', type: 'exterior' })),
    }, '/owner/places/p1')
    expect(items.find((i) => i.key === 'photos')!.score).toBe(10)
  })

  it('detail 메시지 — 소개 문구 미달 시 안내', () => {
    const items = calcCompletionItems({
      ...BASE, name: 'X', address: 'Y', description: '짧음',
    }, '/owner/places/p1')
    const basic = items.find((i) => i.key === 'basic')!
    expect(basic.detail).toBe('소개 문구 40자 이상 권장')
  })

  it('href 는 전달한 baseHref 에 앵커 연결', () => {
    const items = calcCompletionItems(BASE, '/owner/places/abc')
    expect(items.find((i) => i.key === 'photos')!.href).toBe('/owner/places/abc#sec-photos')
    expect(items.find((i) => i.key === 'faq')!.href).toBe('/owner/places/abc#sec-faq')
  })
})

describe('sumCompletion', () => {
  it('총점/최대 비율로 percent 계산', () => {
    const items = calcCompletionItems({
      ...BASE,
      name: 'X', address: 'Y', description: 'a'.repeat(40),
      phone: '041-123-4567',
      openingHours: ['Mo 09:00-18:00'],
      services: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      faqs: [{ question: 'Q', answer: 'A' }, { question: 'Q2', answer: 'A2' }, { question: 'Q3', answer: 'A3' }],
      tags: ['a', 'b', 'c'],
      images: Array.from({ length: 4 }, () => ({ url: 'x', alt: '', type: 'exterior' })),
      naverPlaceUrl: 'https://naver.me/x',
      googleBusinessUrl: 'https://maps.google.com/x',
    }, '/owner/places/p1')
    const sum = sumCompletion(items)
    expect(sum.max).toBe(100)
    expect(sum.score).toBeGreaterThan(0)
    expect(sum.percent).toBe(sum.score)
  })
})
