// AI Place — SEO/GEO Utilities
// robots.txt, sitemap, BreadcrumbList 생성
// GEO 딥리서치 §5.1, §5.3, §5.4 기반

import { getAllPlaces, getCities, getCategories } from './data'

/**
 * robots.txt 생성
 * GEO 딥리서치 §5.1: 모든 AI 검색/답변 크롤러를 Allow
 */
export function generateRobotsTxt(baseUrl: string): string {
  return `# AI Place robots.txt
# AI 검색·답변 크롤러 전체 허용 (GEO 최적화)

# 검색·답변용 크롤러 (필수 허용)
User-agent: OAI-SearchBot
Allow: /
Disallow: /admin
Disallow: /api

User-agent: ChatGPT-User
Allow: /
Disallow: /admin
Disallow: /api

User-agent: PerplexityBot
Allow: /
Disallow: /admin
Disallow: /api

User-agent: Claude-User
Allow: /
Disallow: /admin
Disallow: /api

User-agent: Claude-SearchBot
Allow: /
Disallow: /admin
Disallow: /api

User-agent: Googlebot
Allow: /
Disallow: /admin
Disallow: /api

# 학습용 크롤러 (허용)
User-agent: GPTBot
Allow: /
Disallow: /admin
Disallow: /api

User-agent: ClaudeBot
Allow: /
Disallow: /admin
Disallow: /api

User-agent: Google-Extended
Allow: /
Disallow: /admin
Disallow: /api

User-agent: Applebot-Extended
Allow: /
Disallow: /admin
Disallow: /api

User-agent: CCBot
Allow: /
Disallow: /admin
Disallow: /api

# 기본 크롤러
User-agent: *
Allow: /
Disallow: /admin
Disallow: /api

Sitemap: ${baseUrl}/sitemap.xml
`
}

/**
 * Sitemap 엔트리 생성
 * GEO 딥리서치 §8.1: changeFrequency weekly, priority 0.9(카테고리)/0.8(상세)
 */
export interface SitemapEntry {
  url: string
  lastModified: string
  changeFrequency: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority: number
}

export async function generateSitemapEntries(baseUrl: string): Promise<SitemapEntry[]> {
  const now = new Date().toISOString()
  const entries: SitemapEntry[] = []

  // 메인 페이지
  entries.push({
    url: baseUrl,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 1.0,
  })

  const cities = await getCities()
  const categories = await getCategories()

  // 도시+카테고리 리스트 페이지
  for (const city of cities) {
    for (const cat of categories) {
      entries.push({
        url: `${baseUrl}/${city.slug}/${cat.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.9,
      })
    }
  }

  // 업체 프로필 페이지
  const places = await getAllPlaces()
  for (const place of places) {
    entries.push({
      url: `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
  }

  return entries
}

/**
 * BreadcrumbList JSON-LD 생성
 * GEO 딥리서치 §5.3: BreadcrumbList로 페이지 계층 명확화
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function generateBreadcrumbList(items: Array<{ name: string; url: string }>): Record<string, any> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}
