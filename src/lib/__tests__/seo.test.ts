import { describe, it, expect } from 'vitest'

describe('robots.txt', () => {
  it('should allow all AI search crawlers', async () => {
    const { generateRobotsTxt } = await import('@/lib/seo')
    const robots = generateRobotsTxt('https://aiplace.kr')

    // 검색·답변용 크롤러 (GEO 딥리서치 §5.1 — 필수 허용)
    expect(robots).toContain('User-agent: OAI-SearchBot')
    expect(robots).toContain('User-agent: ChatGPT-User')
    expect(robots).toContain('User-agent: PerplexityBot')
    expect(robots).toContain('User-agent: Claude-User')
    expect(robots).toContain('User-agent: Claude-SearchBot')
    expect(robots).toContain('User-agent: Googlebot')

    // 학습용 크롤러 (허용)
    expect(robots).toContain('User-agent: GPTBot')
    expect(robots).toContain('User-agent: ClaudeBot')
    expect(robots).toContain('User-agent: Google-Extended')

    // Allow 지시
    expect(robots).toContain('Allow: /')

    // Sitemap 참조
    expect(robots).toContain('Sitemap: https://aiplace.kr/sitemap.xml')
  })

  it('should disallow admin and api paths', async () => {
    const { generateRobotsTxt } = await import('@/lib/seo')
    const robots = generateRobotsTxt('https://aiplace.kr')

    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /api')
  })
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
    expect(profiles.length).toBe(5)
  })

  it('should set correct priorities', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    const main = entries.find(e => e.url === 'https://aiplace.kr')
    expect(main?.priority).toBe(1.0)

    const listing = entries.find(e => e.url.endsWith('/cheonan/dermatology'))
    expect(listing?.priority).toBe(0.9)

    const profile = entries.find(e => e.url.includes('/soo-derm'))
    expect(profile?.priority).toBe(0.8)
  })

  it('should include lastModified dates', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    entries.forEach(entry => {
      expect(entry.lastModified).toBeDefined()
    })
  })

  it('should include comparison page URLs', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    const compEntries = entries.filter(e => e.url.includes('/compare/'))
    expect(compEntries.length).toBe(3)
    compEntries.forEach(e => {
      expect(e.priority).toBe(0.85)
      expect(e.changeFrequency).toBe('weekly')
    })
  })

  it('should include guide page URLs', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    const guideEntries = entries.filter(e => e.url.includes('/guide/'))
    expect(guideEntries.length).toBe(1)
    guideEntries.forEach(e => {
      expect(e.priority).toBe(0.9)
      expect(e.changeFrequency).toBe('weekly')
    })
  })

  it('should include keyword page URLs', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://aiplace.kr')

    const kwEntries = entries.filter(e => e.url.includes('/k/'))
    expect(kwEntries.length).toBeGreaterThanOrEqual(5)
    kwEntries.forEach(e => {
      expect(e.priority).toBe(0.85)
      expect(e.changeFrequency).toBe('weekly')
    })
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
