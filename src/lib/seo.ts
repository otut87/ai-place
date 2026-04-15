// AI Place — SEO/GEO Utilities
// robots.txt, sitemap, BreadcrumbList 생성
// GEO 딥리서치 §5.1, §5.3, §5.4 기반

import { getAllPlaces, getCities, getCategories, getAllComparisonTopics, getAllGuidePages, getAllKeywordPages } from './data.supabase'

// robots.txt는 app/robots.ts에서 Next.js MetadataRoute로 처리.

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

  // 비교 페이지
  const comparisonTopics = await getAllComparisonTopics()
  for (const topic of comparisonTopics) {
    entries.push({
      url: `${baseUrl}/compare/${topic.city}/${topic.category}/${topic.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    })
  }

  // 가이드 페이지
  const guidePagesList = await getAllGuidePages()
  for (const guide of guidePagesList) {
    entries.push({
      url: `${baseUrl}/guide/${guide.city}/${guide.category}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    })
  }

  // 키워드 랜딩 페이지
  const keywordPagesList = await getAllKeywordPages()
  for (const kw of keywordPagesList) {
    entries.push({
      url: `${baseUrl}/${kw.city}/${kw.category}/k/${kw.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
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
