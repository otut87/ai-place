/**
 * GEO / SEO / AEO 하네스 — 울타리 테스트
 *
 * 모든 페이지 유형(6종)이 GEO/SEO/AEO 체크리스트를 통과하는지 검증.
 * 이 테스트가 실패하면 배포 불가.
 */
import { describe, it, expect } from 'vitest'

// --- JSON-LD 함수 테스트 ---

describe('GEO/SEO/AEO 하네스', () => {
  // ===========================================
  // 1. JSON-LD @id 검증
  // ===========================================
  describe('JSON-LD @id 필수 포함', () => {
    it('generateArticle should include @id', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const result = generateArticle({
        title: 'Test',
        description: 'Test desc',
        lastUpdated: '2026-04-15',
        url: 'https://aiplace.kr/test',
      })
      expect(result['@id']).toBe('https://aiplace.kr/test')
    })

    it('generateWebSite should include @id', async () => {
      const { generateWebSite } = await import('@/lib/jsonld')
      const result = generateWebSite('https://aiplace.kr')
      expect(result['@id']).toBeDefined()
      expect(result['@id']).toContain('aiplace.kr')
    })

    it('generateLocalBusiness should include @id when pageUrl provided', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 'test', name: 'Test', city: 'cheonan', category: 'dermatology',
        description: 'Test', address: 'Test addr', services: [], faqs: [], tags: [],
      }
      const result = generateLocalBusiness(place, 'https://aiplace.kr/cheonan/dermatology/test')
      expect(result['@id']).toBe('https://aiplace.kr/cheonan/dermatology/test')
    })
  })

  // ===========================================
  // 2. E-E-A-T WebPage 래퍼 검증
  // ===========================================
  describe('E-E-A-T WebPage 래퍼', () => {
    it('generateWebPage should include author (Person) and publisher (Organization)', async () => {
      const { generateWebPage } = await import('@/lib/jsonld')
      const result = generateWebPage({
        url: 'https://aiplace.kr/cheonan/dermatology/test',
        name: 'Test Page',
        description: 'Test description',
        lastUpdated: '2026-04-15',
      })

      expect(result['@type']).toBe('WebPage')
      expect(result['@id']).toBe('https://aiplace.kr/cheonan/dermatology/test')
      expect(result.author).toBeDefined()
      expect(result.author['@type']).toBe('Person')
      expect(result.author.name).toBeTruthy()
      expect(result.publisher).toBeDefined()
      expect(result.publisher['@type']).toBe('Organization')
      expect(result.publisher.name).toBeTruthy()
      expect(result.dateModified).toBe('2026-04-15')
    })

    it('generateWebPage should omit dateModified when not provided', async () => {
      const { generateWebPage } = await import('@/lib/jsonld')
      const result = generateWebPage({
        url: 'https://aiplace.kr/test',
        name: 'Test',
        description: 'Test',
      })
      expect(result.dateModified).toBeUndefined()
    })
  })

  // ===========================================
  // 3. Article E-E-A-T 검증 (비교/가이드/키워드)
  // ===========================================
  describe('Article E-E-A-T', () => {
    it('generateArticle should have Person author + Organization publisher', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const result = generateArticle({
        title: 'Test', description: 'Test', lastUpdated: '2026-04-15',
        url: 'https://aiplace.kr/test',
      })
      expect(result.author['@type']).toBe('Person')
      expect(result.publisher['@type']).toBe('Organization')
    })
  })

  // ===========================================
  // 4. Google Places API — googleMapsUri 반환 검증
  // ===========================================
  describe('Google Places API — googleMapsUri', () => {
    it('PlaceDetailsResult should include googleMapsUri field', async () => {
      const { vi } = await import('vitest')

      const mockResponse = {
        displayName: { text: 'Test Clinic' },
        rating: 4.5,
        userRatingCount: 100,
        reviews: [],
        photos: [],
        googleMapsUri: 'https://maps.google.com/?cid=12345',
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }))

      const { getPlaceDetails } = await import('@/lib/google-places')
      const result = await getPlaceDetails('ChIJ_test')

      expect(result).not.toBeNull()
      expect(result!.googleMapsUri).toBe('https://maps.google.com/?cid=12345')

      vi.unstubAllGlobals()
    })
  })

  // ===========================================
  // 5. 데이터 계층 — Place에 googlePlaceId 필수
  // ===========================================
  describe('데이터 완전성', () => {
    it('모든 업체에 googlePlaceId가 존재해야 함', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const places = await getAllPlaces()

      for (const place of places) {
        expect(place.googlePlaceId, `${place.name}에 googlePlaceId 누락`).toBeTruthy()
      }
    })

    it('모든 업체에 sameAs URL이 최소 1개 존재해야 함', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const places = await getAllPlaces()

      for (const place of places) {
        const hasSameAs = place.naverPlaceUrl || place.kakaoMapUrl || place.googleBusinessUrl
        expect(hasSameAs, `${place.name}에 sameAs URL 없음`).toBeTruthy()
      }
    })

    it('모든 업체에 FAQ가 최소 1개 존재해야 함', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const places = await getAllPlaces()

      for (const place of places) {
        expect(place.faqs.length, `${place.name}에 FAQ 없음`).toBeGreaterThan(0)
      }
    })

    it('모든 업체에 lastUpdated가 존재해야 함', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const places = await getAllPlaces()

      for (const place of places) {
        expect(place.lastUpdated, `${place.name}에 lastUpdated 누락`).toBeTruthy()
      }
    })
  })

  // ===========================================
  // 6. JSON-LD 스키마 — priceRange가 Offer에 없어야 함
  // ===========================================
  describe('JSON-LD schema.org 호환성', () => {
    it('Offer에 priceRange를 사용하지 않아야 함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 'test', name: 'Test', city: 'cheonan', category: 'dermatology',
        description: 'Test', address: 'Test', services: [
          { name: 'Service', priceRange: '5-10만원' },
        ], faqs: [], tags: [],
      }
      const result = generateLocalBusiness(place)
      const offers = result.hasOfferCatalog?.itemListElement ?? []
      for (const offer of offers) {
        expect(offer.priceRange).toBeUndefined()
      }
    })

    it('MedicalClinic에 dateModified를 사용하지 않아야 함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 'test', name: 'Test', city: 'cheonan', category: 'dermatology',
        description: 'Test', address: 'Test', services: [], faqs: [], tags: [],
        lastUpdated: '2026-04-15',
      }
      const result = generateLocalBusiness(place)
      expect(result.dateModified).toBeUndefined()
    })
  })
})
