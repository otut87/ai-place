import { describe, it, expect, vi } from 'vitest'

// sitemap 테스트: DB 없이 시드 데이터 기반으로 검증
// data.supabase의 getAllPlaces/getPlaces를 시드 데이터로 mock
vi.mock('@/lib/data.supabase', async () => {
  const seed = await vi.importActual<typeof import('@/lib/data')>('@/lib/data')
  return { ...seed }
})

describe('sitemap generation', () => {
  it('should include all static and dynamic pages', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    expect(entries.length).toBeGreaterThan(0)

    // 메인 페이지
    const main = entries.find(e => e.url === 'https://aiplace.kr')
    expect(main).toBeDefined()

    // 리스트 페이지
    const listing = entries.find(e => e.url.includes('/cheonan/dermatology'))
    expect(listing).toBeDefined()
    expect(listing?.changeFrequency).toBe('weekly')

    // 프로필 페이지들 (compare/guide 제외)
    const profiles = entries.filter(e =>
      e.url.match(/\/cheonan\/dermatology\/[^/]+$/) &&
      !e.url.includes('/compare/') &&
      !e.url.includes('/guide/')
    )
    expect(profiles.length).toBe(4)
  })

  it('should set correct priorities', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    const main = entries.find(e => e.url === 'https://aiplace.kr')
    expect(main?.priority).toBe(1.0)

    const listing = entries.find(e => e.url.endsWith('/cheonan/dermatology'))
    expect(listing?.priority).toBe(0.9)

    const profile = entries.find(e => e.url.includes('/dr-evers'))
    expect(profile?.priority).toBe(0.8)
  })

  it('should include lastModified dates', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    entries.forEach(entry => {
      expect(entry.lastModified).toBeDefined()
    })
  })

  // T-010g: keyword/compare/guide 라우트가 /blog 로 통합됨.
  // 이전 sitemap 검증은 /blog/[city]/[sector]/[slug] 로 대체.
  it('should include /blog home URL', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')
    const blogHome = entries.find(e => e.url === 'https://aiplace.kr/blog')
    expect(blogHome).toBeDefined()
    expect(blogHome?.priority).toBe(0.9)
  })

  it('should NOT include legacy /k/, /compare/, /guide/ URLs (T-010g)', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')
    expect(entries.filter(e => e.url.includes('/compare/'))).toHaveLength(0)
    expect(entries.filter(e => e.url.includes('/guide/'))).toHaveLength(0)
    expect(entries.filter(e => e.url.includes('/k/'))).toHaveLength(0)
  })
})

describe('BreadcrumbList JSON-LD', () => {
  it('should generate valid BreadcrumbList', async () => {
    const { generateBreadcrumbList } = await import('@/lib/seo')
    const crumbs = generateBreadcrumbList([
      { name: '홈', url: 'https://aiplace.kr' },
      { name: '천안', url: 'https://aiplace.kr/cheonan' },
      { name: '피부과', url: 'https://aiplace.kr/cheonan/dermatology' },
    ])

    expect(crumbs['@context']).toBe('https://schema.org')
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement).toHaveLength(3)
    expect(crumbs.itemListElement[0].position).toBe(1)
    expect(crumbs.itemListElement[2].position).toBe(3)
  })
})

// T-010h: Breadcrumb 2종 분리 (WO #12)
describe('buildBusinessBreadcrumb (4단계)', () => {
  const baseUrl = 'https://aiplace.kr'

  it('업체 포함 4단계: 홈 › 천안 › 피부과 › [업체]', async () => {
    const { buildBusinessBreadcrumb } = await import('@/lib/seo')
    const items = buildBusinessBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      categoryName: '피부과', categorySlug: 'dermatology',
      placeName: '차앤박피부과의원 천안점',
      placeSlug: 'chnp-derm-cheonan',
    })
    expect(items).toHaveLength(4)
    expect(items[0]).toEqual({ name: '홈', url: baseUrl })
    expect(items[1]).toEqual({ name: '천안', url: `${baseUrl}/cheonan` })
    expect(items[2]).toEqual({ name: '피부과', url: `${baseUrl}/cheonan/dermatology` })
    expect(items[3]).toEqual({
      name: '차앤박피부과의원 천안점',
      url: `${baseUrl}/cheonan/dermatology/chnp-derm-cheonan`,
    })
  })

  it('업체 없으면 3단계 (홈 › 천안 › 피부과)', async () => {
    const { buildBusinessBreadcrumb } = await import('@/lib/seo')
    const items = buildBusinessBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      categoryName: '피부과', categorySlug: 'dermatology',
    })
    expect(items).toHaveLength(3)
    expect(items[2].name).toBe('피부과')
  })

  it('sector 중간 hub("천안 의료") 미포함 (WO #12)', async () => {
    const { buildBusinessBreadcrumb } = await import('@/lib/seo')
    const items = buildBusinessBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      categoryName: '피부과', categorySlug: 'dermatology',
    })
    const names = items.map(i => i.name)
    expect(names).not.toContain('천안 의료')
    expect(names).not.toContain('의료')
  })

  it('도시명만 표시 ("천안"), 카테고리명만 표시 ("피부과") — 합치지 않음', async () => {
    const { buildBusinessBreadcrumb } = await import('@/lib/seo')
    const items = buildBusinessBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      categoryName: '피부과', categorySlug: 'dermatology',
    })
    expect(items[1].name).toBe('천안')
    expect(items[2].name).toBe('피부과')
  })
})

describe('buildBlogBreadcrumb (5단계)', () => {
  const baseUrl = 'https://aiplace.kr'

  it('5단계: 홈 › 블로그 › 천안 › 의료 › [글]', async () => {
    const { buildBlogBreadcrumb } = await import('@/lib/seo')
    const items = buildBlogBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      sectorName: '의료', sectorSlug: 'medical',
      title: '천안 여드름 피부과 추천',
      slug: 'cheonan-dermatology-acne',
    })
    expect(items).toHaveLength(5)
    expect(items[0]).toEqual({ name: '홈', url: baseUrl })
    expect(items[1]).toEqual({ name: '블로그', url: `${baseUrl}/blog` })
    expect(items[2]).toEqual({ name: '천안', url: `${baseUrl}/blog/cheonan` })
    expect(items[3]).toEqual({ name: '의료', url: `${baseUrl}/blog/cheonan/medical` })
    expect(items[4]).toEqual({
      name: '천안 여드름 피부과 추천',
      url: `${baseUrl}/blog/cheonan/medical/cheonan-dermatology-acne`,
    })
  })

  it('각 항목이 실제 URL 경로 패턴과 일치', async () => {
    const { buildBlogBreadcrumb } = await import('@/lib/seo')
    const items = buildBlogBreadcrumb({
      baseUrl,
      cityName: '천안', citySlug: 'cheonan',
      sectorName: '뷰티', sectorSlug: 'beauty',
      title: 'X', slug: 'x',
    })
    expect(items[3].url).toBe(`${baseUrl}/blog/cheonan/beauty`)
    expect(items[4].url).toBe(`${baseUrl}/blog/cheonan/beauty/x`)
  })
})

describe('breadcrumb builders → JSON-LD 통합', () => {
  it('builder 결과를 generateBreadcrumbList에 그대로 전달 가능', async () => {
    const { buildBusinessBreadcrumb, generateBreadcrumbList } = await import('@/lib/seo')
    const items = buildBusinessBreadcrumb({
      baseUrl: 'https://aiplace.kr',
      cityName: '천안', citySlug: 'cheonan',
      categoryName: '피부과', categorySlug: 'dermatology',
      placeName: '테스트', placeSlug: 'test',
    })
    const jsonld = generateBreadcrumbList(items)
    expect(jsonld['@type']).toBe('BreadcrumbList')
    expect(jsonld.itemListElement).toHaveLength(4)
    expect(jsonld.itemListElement[3].name).toBe('테스트')
  })
})
