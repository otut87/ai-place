import { describe, it, expect } from 'vitest'
import type { Place, FAQ } from '@/lib/types'

const mockPlace: Place = {
  slug: 'pretty-clinic',
  name: '천안예쁜피부과',
  nameEn: 'Cheonan Pretty Dermatology',
  city: 'cheonan',
  category: 'dermatology',
  description: '천안시 서북구 불당동 위치. 여드름, 피부 레이저, 보톡스 전문 피부과.',
  address: '충남 천안시 서북구 불당동 123-4',
  phone: '+82-41-555-1234',
  openingHours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
  imageUrl: 'https://example.com/photo.jpg',
  rating: 4.5,
  reviewCount: 23,
  services: [
    { name: '여드름치료', description: '압출+레이저 병행', priceRange: '5-10만원' },
    { name: '피부레이저', description: '프락셀, IPL', priceRange: '10-20만원' },
  ],
  faqs: [
    { question: '천안예쁜피부과 여드름 치료 비용은?', answer: '5-10만원 정도입니다.' },
    { question: '주차 가능한가요?', answer: '네, 건물 내 주차장이 있습니다.' },
  ],
  tags: ['여드름', '레이저', '보톡스'],
  latitude: 36.8,
  longitude: 127.1,
}

describe('JSON-LD Generation', () => {
  describe('generateLocalBusiness', () => {
    it('should generate valid LocalBusiness JSON-LD', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace)

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld['@type']).toBe('MedicalClinic')
      expect(jsonld.name).toBe('천안예쁜피부과')
      expect(jsonld.description).toBeTruthy()
      expect(jsonld.address).toBeDefined()
      expect(jsonld.telephone).toBe('+82-41-555-1234')
    })

    it('should include geo coordinates when available', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace)

      expect(jsonld.geo).toBeDefined()
      expect(jsonld.geo?.latitude).toBe(36.8)
      expect(jsonld.geo?.longitude).toBe(127.1)
    })

    it('should handle missing optional fields', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const minimalPlace: Place = {
        slug: 'test',
        name: '테스트',
        city: 'cheonan',
        category: 'dermatology',
        description: '테스트 설명',
        address: '천안시 테스트동',
        services: [],
        faqs: [],
        tags: [],
      }
      const jsonld = generateLocalBusiness(minimalPlace)

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld.name).toBe('테스트')
      expect(jsonld.telephone).toBeUndefined()
      expect(jsonld.geo).toBeUndefined()
    })

    it('should include sameAs when naver/kakao URLs exist', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const placeWithUrls: Place = {
        ...mockPlace,
        naverPlaceUrl: 'https://map.naver.com/v5/entry/place/12345',
        kakaoMapUrl: 'https://place.map.kakao.com/67890',
      }
      const jsonld = generateLocalBusiness(placeWithUrls)

      expect(jsonld.sameAs).toBeDefined()
      expect(jsonld.sameAs).toHaveLength(2)
      expect(jsonld.sameAs).toContain('https://map.naver.com/v5/entry/place/12345')
    })

    it('should not include sameAs when no external URLs', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace)
      expect(jsonld.sameAs).toBeUndefined()
    })

    it('should include aggregateRating when rating exists', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace)

      expect(jsonld.aggregateRating).toBeDefined()
      expect(jsonld.aggregateRating?.ratingValue).toBe(4.5)
      expect(jsonld.aggregateRating?.reviewCount).toBe(23)
    })
  })

  describe('generateItemList', () => {
    it('should generate valid ItemList JSON-LD', async () => {
      const { generateItemList } = await import('@/lib/jsonld')
      const jsonld = generateItemList([mockPlace], '천안 피부과 추천 목록')

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld['@type']).toBe('ItemList')
      expect(jsonld.name).toBe('천안 피부과 추천 목록')
      expect(jsonld.numberOfItems).toBe(1)
      expect(jsonld.itemListElement).toHaveLength(1)
      expect(jsonld.itemListElement[0].position).toBe(1)
    })

    it('should use LocalBusiness fallback for unknown category', async () => {
      const { generateItemList } = await import('@/lib/jsonld')
      const unknownCatPlace: Place = { ...mockPlace, category: 'unknown-cat' }
      const jsonld = generateItemList([unknownCatPlace], '테스트')
      expect(jsonld.itemListElement[0].item['@type']).toBe('LocalBusiness')
    })

    it('should omit aggregateRating from item when rating is null', async () => {
      const { generateItemList } = await import('@/lib/jsonld')
      const noRatingPlace: Place = { ...mockPlace, rating: undefined, reviewCount: undefined }
      const jsonld = generateItemList([noRatingPlace], '테스트')
      expect(jsonld.itemListElement[0].item.aggregateRating).toBeUndefined()
    })

    it('should handle empty list', async () => {
      const { generateItemList } = await import('@/lib/jsonld')
      const jsonld = generateItemList([], '빈 목록')

      expect(jsonld.numberOfItems).toBe(0)
      expect(jsonld.itemListElement).toHaveLength(0)
    })
  })

  describe('generateFAQPage', () => {
    it('should generate valid FAQPage JSON-LD', async () => {
      const { generateFAQPage } = await import('@/lib/jsonld')
      const faqs: FAQ[] = [
        { question: '질문1?', answer: '답변1' },
        { question: '질문2?', answer: '답변2' },
      ]
      const jsonld = generateFAQPage(faqs)

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld['@type']).toBe('FAQPage')
      expect(jsonld.mainEntity).toHaveLength(2)
      expect(jsonld.mainEntity[0]['@type']).toBe('Question')
      expect(jsonld.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    })

    it('should handle empty FAQ list', async () => {
      const { generateFAQPage } = await import('@/lib/jsonld')
      const jsonld = generateFAQPage([])

      expect(jsonld.mainEntity).toHaveLength(0)
    })
  })

  describe('generateArticle', () => {
    it('should generate valid Article JSON-LD', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const jsonld = generateArticle({
        title: '천안 피부과 여드름 치료 비교',
        description: '천안 지역 피부과의 여드름 치료 방법과 비용을 비교합니다.',
        lastUpdated: '2026-04-14',
        url: 'https://aiplace.kr/compare/cheonan/dermatology/acne-treatment',
      })

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld['@type']).toBe('Article')
      expect(jsonld.headline).toBe('천안 피부과 여드름 치료 비교')
      expect(jsonld.description).toBeTruthy()
      expect(jsonld.dateModified).toBe('2026-04-14')
      expect(jsonld.author['@type']).toBe('Person')
      expect(jsonld.author.name).toBeTruthy()
      expect(jsonld.mainEntityOfPage).toBe('https://aiplace.kr/compare/cheonan/dermatology/acne-treatment')
    })
  })

  describe('generateWebSite', () => {
    it('should generate valid WebSite JSON-LD', async () => {
      const { generateWebSite } = await import('@/lib/jsonld')
      const jsonld = generateWebSite('https://aiplace.kr')

      expect(jsonld['@context']).toBe('https://schema.org')
      expect(jsonld['@type']).toBe('WebSite')
      expect(jsonld.name).toBe('AI Place')
      expect(jsonld.url).toBe('https://aiplace.kr')
    })
  })

  // --- P0: Person author in Article schema ---
  describe('generateArticle Person author (P0 §4.1 E-E-A-T)', () => {
    it('should use Person type for author', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const jsonld = generateArticle({
        title: 'Test',
        description: 'Test desc',
        lastUpdated: '2026-04-14',
        url: 'https://aiplace.kr/test',
      })
      expect(jsonld.author['@type']).toBe('Person')
      expect(jsonld.author.name).toBeTruthy()
    })

    it('should keep Organization as publisher', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const jsonld = generateArticle({
        title: 'Test',
        description: 'Test desc',
        lastUpdated: '2026-04-14',
        url: 'https://aiplace.kr/test',
      })
      expect(jsonld.publisher['@type']).toBe('Organization')
    })
  })

  // --- CRITICAL 5: @id + mainEntityOfPage ---
  describe('LocalBusiness @id and mainEntityOfPage (CRITICAL §5.3)', () => {
    it('should include @id with canonical URL', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace, 'https://aiplace.kr/cheonan/dermatology/pretty-clinic')
      expect(jsonld['@id']).toBe('https://aiplace.kr/cheonan/dermatology/pretty-clinic')
    })

    it('should include mainEntityOfPage', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace, 'https://aiplace.kr/cheonan/dermatology/pretty-clinic')
      expect(jsonld.mainEntityOfPage).toBe('https://aiplace.kr/cheonan/dermatology/pretty-clinic')
    })
  })

  // --- HIGH 9: openingHoursSpecification ---
  describe('openingHoursSpecification (HIGH §9.1)', () => {
    it('should convert string openingHours to structured format', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const jsonld = generateLocalBusiness(mockPlace, 'https://aiplace.kr/cheonan/dermatology/pretty-clinic')
      expect(jsonld.openingHoursSpecification).toBeDefined()
      expect(Array.isArray(jsonld.openingHoursSpecification)).toBe(true)
      expect(jsonld.openingHoursSpecification.length).toBeGreaterThan(0)
      const spec = jsonld.openingHoursSpecification[0]
      expect(spec['@type']).toBe('OpeningHoursSpecification')
      expect(spec.dayOfWeek).toBeDefined()
      expect(spec.opens).toBeDefined()
      expect(spec.closes).toBeDefined()
    })
  })
})
