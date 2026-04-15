import { describe, it, expect } from 'vitest'

describe('Data Repository', () => {
  describe('getPlaces', () => {
    it('should return places filtered by city and category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      expect(Array.isArray(places)).toBe(true)
      expect(places.length).toBeGreaterThan(0)
      places.forEach(place => {
        expect(place.city).toBe('cheonan')
        expect(place.category).toBe('dermatology')
      })
    })

    it('should return empty array for unknown city', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('nonexistent', 'dermatology')
      expect(places).toEqual([])
    })

    it('should return empty array for unknown category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'nonexistent')
      expect(places).toEqual([])
    })
  })

  describe('getPlaceBySlug', () => {
    it('should return a place by city, category, and slug', async () => {
      const { getPlaceBySlug } = await import('@/lib/data')
      const places = await import('@/lib/data').then(m => m.getPlaces('cheonan', 'dermatology'))
      if (places.length > 0) {
        const place = await getPlaceBySlug('cheonan', 'dermatology', places[0].slug)
        expect(place).toBeDefined()
        expect(place?.slug).toBe(places[0].slug)
        expect(place?.name).toBeTruthy()
      }
    })

    it('should return undefined for unknown slug', async () => {
      const { getPlaceBySlug } = await import('@/lib/data')
      const place = await getPlaceBySlug('cheonan', 'dermatology', 'nonexistent-slug')
      expect(place).toBeUndefined()
    })
  })

  describe('getCities', () => {
    it('should return all cities', async () => {
      const { getCities } = await import('@/lib/data')
      const cities = await getCities()
      expect(Array.isArray(cities)).toBe(true)
      expect(cities.length).toBeGreaterThan(0)
      cities.forEach(city => {
        expect(city.slug).toBeTruthy()
        expect(city.name).toBeTruthy()
      })
    })
  })

  describe('getCategories', () => {
    it('should return all categories', async () => {
      const { getCategories } = await import('@/lib/data')
      const categories = await getCategories()
      expect(Array.isArray(categories)).toBe(true)
      expect(categories.length).toBeGreaterThan(0)
      categories.forEach(cat => {
        expect(cat.slug).toBeTruthy()
        expect(cat.name).toBeTruthy()
      })
    })
  })

  describe('getAllPlaces', () => {
    it('should return all places', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      const allPlaces = await getAllPlaces()
      expect(Array.isArray(allPlaces)).toBe(true)
      expect(allPlaces.length).toBeGreaterThan(0)
    })
  })

  describe('slug uniqueness', () => {
    it('should have unique slugs per city+category', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      const slugs = places.map(p => p.slug)
      const uniqueSlugs = new Set(slugs)
      expect(slugs.length).toBe(uniqueSlugs.size)
    })
  })

  describe('expanded FAQs (GEO §4.3 — 최소 5개/업체)', () => {
    it('should have at least 5 FAQs per place', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      places.forEach(place => {
        expect(place.faqs.length).toBeGreaterThanOrEqual(5)
      })
    })

    it('should have FAQs in real search query format', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      places.forEach(place => {
        place.faqs.forEach(faq => {
          // 질문은 ?로 끝나야 함
          expect(faq.question).toMatch(/\?$/)
          // 답변은 최소 20자 이상 (구체적 답변)
          expect(faq.answer.length).toBeGreaterThanOrEqual(20)
        })
      })
    })
  })

  describe('getComparisonTopics', () => {
    it('should return topics for cheonan/dermatology', async () => {
      const { getComparisonTopics } = await import('@/lib/data')
      const topics = await getComparisonTopics('cheonan', 'dermatology')
      expect(topics.length).toBe(3)
      topics.forEach(t => {
        expect(t.slug).toBeTruthy()
        expect(t.name).toBeTruthy()
        expect(t.city).toBe('cheonan')
        expect(t.category).toBe('dermatology')
      })
    })

    it('should return empty for unknown city', async () => {
      const { getComparisonTopics } = await import('@/lib/data')
      const topics = await getComparisonTopics('nonexistent', 'dermatology')
      expect(topics).toEqual([])
    })
  })

  describe('getComparisonPage', () => {
    it('should return full comparison data', async () => {
      const { getComparisonPage } = await import('@/lib/data')
      const page = await getComparisonPage('cheonan', 'dermatology', 'acne-treatment')
      expect(page).toBeDefined()
      expect(page!.topic.slug).toBe('acne-treatment')
      expect(page!.summary.length).toBeGreaterThanOrEqual(30)
      expect(page!.entries.length).toBeGreaterThanOrEqual(2)
      expect(page!.statistics.length).toBeGreaterThanOrEqual(3)
      expect(page!.faqs.length).toBeGreaterThanOrEqual(5)
      expect(page!.sources.length).toBeGreaterThanOrEqual(2)
      expect(page!.lastUpdated).toBeTruthy()
    })

    it('should return undefined for unknown topic', async () => {
      const { getComparisonPage } = await import('@/lib/data')
      const page = await getComparisonPage('cheonan', 'dermatology', 'nonexistent')
      expect(page).toBeUndefined()
    })

    it('entries should have required fields', async () => {
      const { getComparisonPage } = await import('@/lib/data')
      const page = await getComparisonPage('cheonan', 'dermatology', 'acne-treatment')
      page!.entries.forEach(entry => {
        expect(entry.placeSlug).toBeTruthy()
        expect(entry.placeName).toBeTruthy()
        expect(entry.methods.length).toBeGreaterThan(0)
        expect(entry.priceRange).toBeTruthy()
        expect(entry.pros.length).toBeGreaterThan(0)
      })
    })
  })

  describe('getGuidePage', () => {
    it('should return guide data for cheonan/dermatology', async () => {
      const { getGuidePage } = await import('@/lib/data')
      const guide = await getGuidePage('cheonan', 'dermatology')
      expect(guide).toBeDefined()
      expect(guide!.title).toBeTruthy()
      expect(guide!.summary.length).toBeGreaterThanOrEqual(30)
      expect(guide!.sections.length).toBeGreaterThanOrEqual(5)
      expect(guide!.statistics.length).toBeGreaterThanOrEqual(3)
      expect(guide!.faqs.length).toBeGreaterThanOrEqual(5)
      expect(guide!.sources.length).toBeGreaterThanOrEqual(2)
    })

    it('should return undefined for unknown city', async () => {
      const { getGuidePage } = await import('@/lib/data')
      const guide = await getGuidePage('nonexistent', 'dermatology')
      expect(guide).toBeUndefined()
    })

    it('guide sections should have headings and content', async () => {
      const { getGuidePage } = await import('@/lib/data')
      const guide = await getGuidePage('cheonan', 'dermatology')
      guide!.sections.forEach(section => {
        expect(section.heading).toBeTruthy()
        expect(section.content.length).toBeGreaterThanOrEqual(20)
      })
    })
  })

  describe('getAllComparisonTopics', () => {
    it('should return all topics', async () => {
      const { getAllComparisonTopics } = await import('@/lib/data')
      const topics = await getAllComparisonTopics()
      expect(topics.length).toBe(3)
    })
  })

  describe('getAllGuidePages', () => {
    it('should return all guides', async () => {
      const { getAllGuidePages } = await import('@/lib/data')
      const guides = await getAllGuidePages()
      expect(guides.length).toBe(1)
    })
  })

  describe('getCategoryFaqs', () => {
    it('should return category-level FAQs for cheonan/dermatology', async () => {
      const { getCategoryFaqs } = await import('@/lib/data')
      const faqs = await getCategoryFaqs('cheonan', 'dermatology')
      expect(faqs.length).toBeGreaterThanOrEqual(5)
      expect(faqs.length).toBeLessThanOrEqual(7)
    })

    it('should contain category-level questions, not business-specific', async () => {
      const { getCategoryFaqs } = await import('@/lib/data')
      const faqs = await getCategoryFaqs('cheonan', 'dermatology')
      faqs.forEach(faq => {
        expect(faq.question).toMatch(/\?$/)
        expect(faq.answer.length).toBeGreaterThanOrEqual(20)
        // 개별 업체명이 질문에 포함되면 안 됨 (카테고리 레벨)
        expect(faq.question).not.toMatch(/예단|클린스킨|피부사랑|봄피부과|하늘피부과/)
      })
    })

    it('should return empty for unknown city/category', async () => {
      const { getCategoryFaqs } = await import('@/lib/data')
      const faqs = await getCategoryFaqs('nonexistent', 'dermatology')
      expect(faqs).toEqual([])
    })
  })

  // --- CRITICAL 1: sameAs URLs ---
  describe('sameAs URLs (CRITICAL §5.3)', () => {
    it('all places should have at least one sameAs URL', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      places.forEach(place => {
        const hasSameAs = place.naverPlaceUrl || place.kakaoMapUrl
        expect(hasSameAs).toBeTruthy()
      })
    })
  })

  // --- CRITICAL 4: lastUpdated field ---
  describe('lastUpdated field (CRITICAL §4.2)', () => {
    it('all places should have lastUpdated', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      places.forEach(place => {
        expect(place.lastUpdated).toBeTruthy()
        expect(place.lastUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      })
    })
  })

  // --- P1: KeywordPage ---
  describe('getKeywordPage', () => {
    it('should return keyword page data', async () => {
      const { getKeywordPage } = await import('@/lib/data')
      const page = await getKeywordPage('cheonan', 'dermatology', 'acne')
      expect(page).toBeDefined()
      expect(page!.title).toBeTruthy()
      expect(page!.summary.length).toBeGreaterThanOrEqual(30)
      expect(page!.relatedPlaceSlugs.length).toBeGreaterThanOrEqual(2)
      expect(page!.faqs.length).toBeGreaterThanOrEqual(5)
      expect(page!.statistics.length).toBeGreaterThanOrEqual(3)
    })

    it('should return undefined for unknown keyword', async () => {
      const { getKeywordPage } = await import('@/lib/data')
      const page = await getKeywordPage('cheonan', 'dermatology', 'nonexistent')
      expect(page).toBeUndefined()
    })
  })

  describe('getAllKeywordPages', () => {
    it('should return all keyword pages', async () => {
      const { getAllKeywordPages } = await import('@/lib/data')
      const pages = await getAllKeywordPages()
      expect(pages.length).toBeGreaterThanOrEqual(5)
    })

    it('keyword pages should target real search queries', async () => {
      const { getAllKeywordPages } = await import('@/lib/data')
      const pages = await getAllKeywordPages()
      pages.forEach(page => {
        expect(page.targetQuery).toBeTruthy()
        expect(page.targetQuery).toMatch(/천안/)
      })
    })
  })

  describe('getGuidesForPlace', () => {
    it('가이드에서 참조된 업체는 결과 반환', async () => {
      const { getGuidesForPlace } = await import('@/lib/data')
      const guides = await getGuidesForPlace('soo-derm')
      expect(guides.length).toBeGreaterThan(0)
      expect(guides[0].city).toBe('cheonan')
    })

    it('참조되지 않은 업체는 빈 배열', async () => {
      const { getGuidesForPlace } = await import('@/lib/data')
      const guides = await getGuidesForPlace('nonexistent-slug')
      expect(guides).toEqual([])
    })
  })

  describe('getComparisonsForPlace', () => {
    it('비교 페이지에 포함된 업체는 결과 반환', async () => {
      const { getComparisonsForPlace } = await import('@/lib/data')
      const comps = await getComparisonsForPlace('soo-derm')
      expect(comps.length).toBeGreaterThan(0)
    })

    it('포함되지 않은 업체는 빈 배열', async () => {
      const { getComparisonsForPlace } = await import('@/lib/data')
      const comps = await getComparisonsForPlace('nonexistent-slug')
      expect(comps).toEqual([])
    })
  })

  describe('Recommendation fields in seed data', () => {
    it('피부과 시드 데이터에 추천 필드가 있음', async () => {
      const { getPlaces } = await import('@/lib/data')
      const places = await getPlaces('cheonan', 'dermatology')
      places.forEach(place => {
        expect(place.recommendedFor).toBeDefined()
        expect(place.recommendedFor!.length).toBeGreaterThan(0)
        expect(place.strengths).toBeDefined()
        expect(place.strengths!.length).toBeGreaterThan(0)
        expect(place.placeType).toBeTruthy()
        expect(place.recommendationNote).toBeTruthy()
      })
    })
  })
})
