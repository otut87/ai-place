import { describe, it, expect } from 'vitest'

describe('robots.txt', () => {
  it('should allow all AI search crawlers', async () => {
    const { generateRobotsTxt } = await import('@/lib/seo')
    const robots = generateRobotsTxt('https://ai-place.vercel.app')

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
    expect(robots).toContain('Sitemap: https://ai-place.vercel.app/sitemap.xml')
  })

  it('should disallow admin and api paths', async () => {
    const { generateRobotsTxt } = await import('@/lib/seo')
    const robots = generateRobotsTxt('https://ai-place.vercel.app')

    expect(robots).toContain('Disallow: /admin')
    expect(robots).toContain('Disallow: /api')
  })
})

describe('sitemap generation', () => {
  it('should include all static and dynamic pages', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://ai-place.vercel.app')

    expect(entries.length).toBeGreaterThan(0)

    // 메인 페이지
    const main = entries.find(e => e.url === 'https://ai-place.vercel.app')
    expect(main).toBeDefined()

    // 리스트 페이지
    const listing = entries.find(e => e.url.includes('/cheonan/dermatology'))
    expect(listing).toBeDefined()
    expect(listing?.changeFrequency).toBe('weekly')

    // 프로필 페이지들
    const profiles = entries.filter(e => e.url.match(/\/cheonan\/dermatology\/[^/]+$/))
    expect(profiles.length).toBe(5)
  })

  it('should set correct priorities', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://ai-place.vercel.app')

    const main = entries.find(e => e.url === 'https://ai-place.vercel.app')
    expect(main?.priority).toBe(1.0)

    const listing = entries.find(e => e.url.endsWith('/cheonan/dermatology'))
    expect(listing?.priority).toBe(0.9)

    const profile = entries.find(e => e.url.includes('/yedanpibu'))
    expect(profile?.priority).toBe(0.8)
  })

  it('should include lastModified dates', async () => {
    const { generateSitemapEntries } = await import('@/lib/seo')
    const entries = await generateSitemapEntries('https://ai-place.vercel.app')

    entries.forEach(entry => {
      expect(entry.lastModified).toBeDefined()
    })
  })
})

describe('BreadcrumbList JSON-LD', () => {
  it('should generate valid BreadcrumbList', async () => {
    const { generateBreadcrumbList } = await import('@/lib/seo')
    const crumbs = generateBreadcrumbList([
      { name: '홈', url: 'https://ai-place.vercel.app' },
      { name: '천안', url: 'https://ai-place.vercel.app/cheonan' },
      { name: '피부과', url: 'https://ai-place.vercel.app/cheonan/dermatology' },
    ])

    expect(crumbs['@context']).toBe('https://schema.org')
    expect(crumbs['@type']).toBe('BreadcrumbList')
    expect(crumbs.itemListElement).toHaveLength(3)
    expect(crumbs.itemListElement[0].position).toBe(1)
    expect(crumbs.itemListElement[2].position).toBe(3)
  })
})
