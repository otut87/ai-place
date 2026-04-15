/**
 * GEO / SEO / AEO 런칭 체크리스트 하네스
 *
 * 부록 A · 런칭 체크리스트 전항목 기반.
 * [기술 기초] + [페이지별] + [콘텐츠] + [llms.txt] 검증.
 * 이 테스트가 실패하면 배포 불가.
 */
import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// ═══════════════════════════════════════════════
// [기술 기초] robots.ts, sitemap.ts, IndexNow, llms.txt, generateStaticParams
// ═══════════════════════════════════════════════
describe('[기술 기초]', () => {
  // --- robots.ts: AI 크롤러 Allow ---
  describe('robots.ts — AI 크롤러 Allow', () => {
    const REQUIRED_BOTS = [
      'GPTBot', 'ClaudeBot', 'PerplexityBot', 'OAI-SearchBot',
      'ChatGPT-User', 'Claude-SearchBot', 'Google-Extended',
    ]

    it('robots.ts 파일 존재', () => {
      expect(existsSync(join(process.cwd(), 'src/app/robots.ts'))).toBe(true)
    })

    it('필수 AI 봇이 모두 Allow 설정', async () => {
      const robotsMod = await import('@/app/robots')
      const robots = robotsMod.default()
      const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules]
      const allowedAgents = rules
        .filter((r: { allow?: string | string[] }) => {
          const allow = Array.isArray(r.allow) ? r.allow : [r.allow]
          return allow.some(a => a === '/')
        })
        .map((r: { userAgent?: string | string[] }) =>
          Array.isArray(r.userAgent) ? r.userAgent : [r.userAgent]
        )
        .flat()

      for (const bot of REQUIRED_BOTS) {
        expect(allowedAgents, `${bot} 누락`).toContain(bot)
      }
    })

    it('sitemap URL 포함', async () => {
      const robotsMod = await import('@/app/robots')
      const robots = robotsMod.default()
      expect(robots.sitemap).toContain('sitemap.xml')
    })
  })

  // --- sitemap.ts ---
  describe('sitemap.ts', () => {
    it('sitemap.ts 파일 존재', () => {
      expect(existsSync(join(process.cwd(), 'src/app/sitemap.ts'))).toBe(true)
    })
  })

  // --- generateStaticParams ---
  describe('generateStaticParams 구현', () => {
    const PAGES_WITH_PARAMS = [
      'src/app/[city]/[category]/page.tsx',
      'src/app/[city]/[category]/[slug]/page.tsx',
      'src/app/compare/[city]/[category]/[topic]/page.tsx',
      'src/app/guide/[city]/[category]/page.tsx',
    ]

    for (const page of PAGES_WITH_PARAMS) {
      it(`${page}에 generateStaticParams 존재`, () => {
        const filepath = join(process.cwd(), page)
        expect(existsSync(filepath), `파일 없음: ${page}`).toBe(true)
        const content = readFileSync(filepath, 'utf-8')
        expect(content, `generateStaticParams 누락: ${page}`).toContain('generateStaticParams')
      })
    }
  })

  // --- IndexNow ---
  describe('IndexNow', () => {
    it('IndexNow 키 파일 존재 (public/*.txt)', () => {
      const publicDir = join(process.cwd(), 'public')
      const files = existsSync(publicDir)
        ? readdirSync(publicDir).filter((f: string) => /^[a-f0-9]{32}\.txt$/.test(f))
        : []
      expect(files.length, 'IndexNow 키 파일 없음 (public/{key}.txt)').toBeGreaterThan(0)
    })
  })

  // --- llms.txt ---
  describe('llms.txt', () => {
    it('llms.txt 동적 라우트 존재', () => {
      expect(existsSync(join(process.cwd(), 'src/app/llms.txt/route.ts'))).toBe(true)
    })

    it('llms.txt 라우트가 GET 함수를 export', async () => {
      const mod = await import('@/app/llms.txt/route')
      expect(typeof mod.GET).toBe('function')
    })
  })
})

// ═══════════════════════════════════════════════
// [페이지별] JSON-LD, metadata, heading, Direct Answer, sameAs, alt, freshness, E-E-A-T
// ═══════════════════════════════════════════════
describe('[페이지별]', () => {
  // --- generateMetadata (title, description, canonical, OG) ---
  // validate-pages.ts에서 빌드 후 HTML 검증. 여기서는 JSON-LD 함수 단위 검증.

  // --- JSON-LD: LocalBusiness(subtype) + FAQPage + BreadcrumbList + Review ---
  describe('JSON-LD: LocalBusiness subtype', () => {
    it('dermatology → MedicalClinic', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'cheonan', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place)['@type']).toBe('MedicalClinic')
    })

    it('hairsalon → BeautySalon', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'hairsalon', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place)['@type']).toBe('BeautySalon')
    })

    it('unknown category → LocalBusiness fallback', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'unknown', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place)['@type']).toBe('LocalBusiness')
    })
  })

  describe('JSON-LD: FAQPage', () => {
    it('FAQ 배열 → FAQPage schema 생성', async () => {
      const { generateFAQPage } = await import('@/lib/jsonld')
      const result = generateFAQPage([
        { question: '질문1', answer: '답변1' },
        { question: '질문2', answer: '답변2' },
      ])
      expect(result['@type']).toBe('FAQPage')
      expect(result.mainEntity).toHaveLength(2)
      expect(result.mainEntity[0]['@type']).toBe('Question')
      expect(result.mainEntity[0].acceptedAnswer['@type']).toBe('Answer')
    })
  })

  describe('JSON-LD: @id 필수', () => {
    it('generateArticle에 @id 포함', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const result = generateArticle({ title: 'T', description: 'D', lastUpdated: '2026-04-15', url: 'https://aiplace.kr/test' })
      expect(result['@id']).toBe('https://aiplace.kr/test')
    })

    it('generateWebSite에 @id 포함', async () => {
      const { generateWebSite } = await import('@/lib/jsonld')
      expect(generateWebSite('https://aiplace.kr')['@id']).toContain('aiplace.kr')
    })

    it('generateLocalBusiness에 @id (pageUrl 제공 시)', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place, 'https://aiplace.kr/x')['@id']).toBe('https://aiplace.kr/x')
    })
  })

  describe('JSON-LD: Review(aggregateRating)', () => {
    it('rating + reviewCount 있을 때 aggregateRating 포함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [], rating: 4.5, reviewCount: 100 }
      const result = generateLocalBusiness(place)
      expect(result.aggregateRating).toBeDefined()
      expect(result.aggregateRating['@type']).toBe('AggregateRating')
      expect(result.aggregateRating.ratingValue).toBe(4.5)
      expect(result.aggregateRating.reviewCount).toBe(100)
      expect(result.aggregateRating.bestRating).toBe(5)
    })

    it('rating 없을 때 aggregateRating 미포함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place).aggregateRating).toBeUndefined()
    })
  })

  // --- sameAs: 네이버플레이스·카카오맵·GBP ---
  describe('sameAs (네이버·카카오·GBP)', () => {
    it('sameAs URL이 JSON-LD에 포함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a',
        services: [], faqs: [], tags: [],
        naverPlaceUrl: 'https://naver.me/xxx',
        kakaoMapUrl: 'https://place.map.kakao.com/123',
        googleBusinessUrl: 'https://maps.google.com/?cid=456',
      }
      const result = generateLocalBusiness(place)
      expect(result.sameAs).toContain('https://naver.me/xxx')
      expect(result.sameAs).toContain('https://place.map.kakao.com/123')
      expect(result.sameAs).toContain('https://maps.google.com/?cid=456')
    })

    it('sameAs URL 없으면 sameAs 필드 미포함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = { slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [] }
      expect(generateLocalBusiness(place).sameAs).toBeUndefined()
    })
  })

  // --- 저자 바이라인 Person schema ---
  describe('E-E-A-T: 저자 바이라인 Person schema', () => {
    it('WebPage에 Person author + Organization publisher', async () => {
      const { generateWebPage } = await import('@/lib/jsonld')
      const result = generateWebPage({ url: 'https://aiplace.kr/test', name: 'T', description: 'D', lastUpdated: '2026-04-15' })
      expect(result.author['@type']).toBe('Person')
      expect(result.author.name).toBeTruthy()
      expect(result.author.jobTitle).toBeTruthy()
      expect(result.publisher['@type']).toBe('Organization')
      expect(result.publisher['@id']).toBeTruthy()
    })

    it('Article에 Person author + Organization publisher', async () => {
      const { generateArticle } = await import('@/lib/jsonld')
      const result = generateArticle({ title: 'T', description: 'D', lastUpdated: '2026-04-15', url: 'https://aiplace.kr/test' })
      expect(result.author['@type']).toBe('Person')
      expect(result.publisher['@type']).toBe('Organization')
    })

    it('WebPage에 dateModified 미제공 시 omit', async () => {
      const { generateWebPage } = await import('@/lib/jsonld')
      const result = generateWebPage({ url: 'https://aiplace.kr/test', name: 'T', description: 'D' })
      expect(result.dateModified).toBeUndefined()
    })
  })

  // --- JSON-LD schema.org 호환성 (하지 말아야 할 것) ---
  describe('JSON-LD 금지 패턴', () => {
    it('Offer에 priceRange 사용하지 않아야 함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a',
        services: [{ name: 'S', priceRange: '5-10만원' }], faqs: [], tags: [],
      }
      const offers = generateLocalBusiness(place).hasOfferCatalog?.itemListElement ?? []
      for (const offer of offers) {
        expect(offer.priceRange).toBeUndefined()
      }
    })

    it('MedicalClinic에 dateModified 사용하지 않아야 함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a',
        services: [], faqs: [], tags: [], lastUpdated: '2026-04-15',
      }
      expect(generateLocalBusiness(place).dateModified).toBeUndefined()
    })
  })

  // --- OpeningHoursSpecification ---
  describe('OpeningHoursSpecification 변환', () => {
    it('영업시간 → OpeningHoursSpecification 배열 생성', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a',
        services: [], faqs: [], tags: [], openingHours: ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'],
      }
      const result = generateLocalBusiness(place)
      expect(result.openingHoursSpecification).toBeDefined()
      expect(result.openingHoursSpecification.length).toBeGreaterThanOrEqual(6) // Mo~Fr(5) + Sa(1)
      expect(result.openingHoursSpecification[0].dayOfWeek).toBe('Monday')
    })
  })

  // --- geo 좌표 ---
  describe('GeoCoordinates', () => {
    it('위도/경도 → GeoCoordinates 포함', async () => {
      const { generateLocalBusiness } = await import('@/lib/jsonld')
      const place = {
        slug: 't', name: 'T', city: 'c', category: 'dermatology', description: 'd', address: 'a',
        services: [], faqs: [], tags: [], latitude: 36.8185, longitude: 127.1135,
      }
      const result = generateLocalBusiness(place)
      expect(result.geo['@type']).toBe('GeoCoordinates')
      expect(result.geo.latitude).toBe(36.8185)
    })
  })

  // --- ItemList ---
  describe('ItemList (카테고리 목록)', () => {
    it('places 배열 → ItemList 생성', async () => {
      const { generateItemList } = await import('@/lib/jsonld')
      const places = [
        { slug: 'a', name: 'A', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [], rating: 4.5, reviewCount: 10 },
        { slug: 'b', name: 'B', city: 'c', category: 'dermatology', description: 'd', address: 'a', services: [], faqs: [], tags: [] },
      ]
      const result = generateItemList(places, '천안 피부과')
      expect(result['@type']).toBe('ItemList')
      expect(result.numberOfItems).toBe(2)
      expect(result.itemListElement[0].position).toBe(1)
      expect(result.itemListElement[0].item['@type']).toBe('MedicalClinic')
    })
  })
})

// ═══════════════════════════════════════════════
// [콘텐츠] 데이터 품질 — 통계·출처·FAQ·sameAs·lastUpdated·googlePlaceId
// ═══════════════════════════════════════════════
describe('[콘텐츠] 데이터 품질', () => {
  describe('업체 (Place) 필수 필드', () => {
    it('모든 업체에 googlePlaceId 존재', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        expect(place.googlePlaceId, `${place.name}: googlePlaceId 누락`).toBeTruthy()
      }
    })

    it('모든 업체에 sameAs URL 최소 1개', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        const has = place.naverPlaceUrl || place.kakaoMapUrl || place.googleBusinessUrl
        expect(has, `${place.name}: sameAs 없음`).toBeTruthy()
      }
    })

    it('모든 업체에 FAQ 최소 3개 (실제 검색어 형태)', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        expect(place.faqs.length, `${place.name}: FAQ ${place.faqs.length}개 (최소 3개)`).toBeGreaterThanOrEqual(3)
        // FAQ question이 물음표로 끝나는지 (검색어 형태)
        for (const faq of place.faqs) {
          expect(faq.question, `FAQ 형식 오류: ${faq.question}`).toMatch(/\?$/)
        }
      }
    })

    it('모든 업체에 lastUpdated 존재 (ISO 8601)', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        expect(place.lastUpdated, `${place.name}: lastUpdated 누락`).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    })

    it('모든 업체에 서비스 최소 1개', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        expect(place.services.length, `${place.name}: 서비스 없음`).toBeGreaterThan(0)
      }
    })

    it('모든 업체에 위도/경도 존재', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        expect(place.latitude, `${place.name}: 위도 누락`).toBeDefined()
        expect(place.longitude, `${place.name}: 경도 누락`).toBeDefined()
      }
    })
  })

  describe('비교 페이지 콘텐츠 품질', () => {
    it('비교 페이지에 통계 최소 3개', async () => {
      const { getAllComparisonTopics, getComparisonPage } = await import('@/lib/data')
      const topics = await getAllComparisonTopics()
      for (const topic of topics) {
        const page = await getComparisonPage(topic.city, topic.category, topic.slug)
        expect(page, `비교 페이지 없음: ${topic.slug}`).toBeDefined()
        expect(page!.statistics.length, `${topic.slug}: 통계 ${page!.statistics.length}개 (최소 3개)`).toBeGreaterThanOrEqual(3)
      }
    })

    it('비교 페이지에 외부 출처 최소 2개', async () => {
      const { getAllComparisonTopics, getComparisonPage } = await import('@/lib/data')
      const topics = await getAllComparisonTopics()
      for (const topic of topics) {
        const page = await getComparisonPage(topic.city, topic.category, topic.slug)
        expect(page!.sources.length, `${topic.slug}: 출처 ${page!.sources.length}개 (최소 2개)`).toBeGreaterThanOrEqual(2)
      }
    })

    it('비교 페이지에 FAQ 최소 5개', async () => {
      const { getAllComparisonTopics, getComparisonPage } = await import('@/lib/data')
      const topics = await getAllComparisonTopics()
      for (const topic of topics) {
        const page = await getComparisonPage(topic.city, topic.category, topic.slug)
        expect(page!.faqs.length, `${topic.slug}: FAQ ${page!.faqs.length}개 (최소 5개)`).toBeGreaterThanOrEqual(5)
      }
    })
  })

  describe('가이드 페이지 콘텐츠 품질', () => {
    it('가이드에 통계 최소 3개', async () => {
      const { getAllGuidePages } = await import('@/lib/data')
      const guides = await getAllGuidePages()
      for (const guide of guides) {
        expect(guide.statistics.length, `가이드 통계 ${guide.statistics.length}개 (최소 3개)`).toBeGreaterThanOrEqual(3)
      }
    })

    it('가이드에 외부 출처 최소 2개', async () => {
      const { getAllGuidePages } = await import('@/lib/data')
      const guides = await getAllGuidePages()
      for (const guide of guides) {
        expect(guide.sources.length, `가이드 출처 ${guide.sources.length}개 (최소 2개)`).toBeGreaterThanOrEqual(2)
      }
    })

    it('가이드에 FAQ 최소 5개', async () => {
      const { getAllGuidePages } = await import('@/lib/data')
      const guides = await getAllGuidePages()
      for (const guide of guides) {
        expect(guide.faqs.length, `가이드 FAQ ${guide.faqs.length}개 (최소 5개)`).toBeGreaterThanOrEqual(5)
      }
    })
  })

  // --- Direct Answer Block 40~60자 ---
  describe('Direct Answer Block (summary 40~60자)', () => {
    it('비교 페이지 summary 40~60자', async () => {
      const { getAllComparisonTopics, getComparisonPage } = await import('@/lib/data')
      const topics = await getAllComparisonTopics()
      for (const topic of topics) {
        const page = await getComparisonPage(topic.city, topic.category, topic.slug)
        const len = page!.summary.length
        expect(len, `${topic.slug}: summary ${len}자 "${page!.summary}" (40~60자 필요)`).toBeGreaterThanOrEqual(40)
        expect(len, `${topic.slug}: summary ${len}자 (60자 초과)`).toBeLessThanOrEqual(60)
      }
    })

    it('가이드 페이지 summary 40~60자', async () => {
      const { getAllGuidePages } = await import('@/lib/data')
      for (const guide of await getAllGuidePages()) {
        const len = guide.summary.length
        expect(len, `가이드 summary ${len}자 "${guide.summary}" (40~60자 필요)`).toBeGreaterThanOrEqual(40)
        expect(len, `가이드 summary ${len}자 (60자 초과)`).toBeLessThanOrEqual(60)
      }
    })

    it('키워드 페이지 summary 40~60자', async () => {
      const { getAllKeywordPages } = await import('@/lib/data')
      for (const kw of await getAllKeywordPages()) {
        const len = kw.summary.length
        expect(len, `${kw.slug}: summary ${len}자 "${kw.summary}" (40~60자 필요)`).toBeGreaterThanOrEqual(40)
        expect(len, `${kw.slug}: summary ${len}자 (60자 초과)`).toBeLessThanOrEqual(60)
      }
    })

    it('업체 description 40~60자', async () => {
      const { getAllPlaces } = await import('@/lib/data')
      for (const place of await getAllPlaces()) {
        const len = place.description.length
        expect(len, `${place.name}: description ${len}자 (40~60자 필요)`).toBeGreaterThanOrEqual(40)
        expect(len, `${place.name}: description ${len}자 (60자 초과)`).toBeLessThanOrEqual(60)
      }
    })
  })
})

// ═══════════════════════════════════════════════
// [Google Places API] 연동 검증
// ═══════════════════════════════════════════════
describe('[Google Places API]', () => {
  it('정상 응답 → PlaceDetailsResult 파싱', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        displayName: { text: 'Test' }, rating: 4.5, userRatingCount: 100,
        reviews: [{ text: { text: '좋아요' }, rating: 5, relativePublishTimeDescription: '1주 전' }],
        photos: [{ name: 'places/x/photos/p1' }],
        googleMapsUri: 'https://maps.google.com/?cid=123',
      }),
    }))
    const { getPlaceDetails } = await import('@/lib/google-places')
    const result = await getPlaceDetails('ChIJ_test')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('Test')
    expect(result!.googleMapsUri).toBe('https://maps.google.com/?cid=123')
    expect(result!.reviews).toHaveLength(1)
    expect(result!.photoRefs).toHaveLength(1)
    vi.unstubAllGlobals()
  })

  it('API 에러 → null 반환', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, text: () => Promise.resolve('Forbidden') }))
    const { getPlaceDetails } = await import('@/lib/google-places')
    expect(await getPlaceDetails('bad')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('네트워크 에러 → null 반환', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network')))
    const { getPlaceDetails } = await import('@/lib/google-places')
    expect(await getPlaceDetails('x')).toBeNull()
    vi.unstubAllGlobals()
  })
})
