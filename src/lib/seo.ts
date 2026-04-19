// AI Place — SEO/GEO Utilities
// robots.txt, sitemap, BreadcrumbList 생성
// GEO 딥리서치 §5.1, §5.3, §5.4 기반

import type { Place } from './types'
import { getAllPlaces, getCities, getCategories } from './data.supabase'
import { getAllActiveBlogPosts } from './blog/data.supabase'

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

  // About 페이지
  entries.push({
    url: `${baseUrl}/about`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.7,
  })

  const cities = await getCities()
  const categories = await getCategories()
  const { getSectors } = await import('./data.supabase')
  const sectors = await getSectors()

  // 업체 프로필 페이지 (sitemap 필터링에도 사용)
  const places = await getAllPlaces()
  const activeCategoryKeys = new Set(places.map(p => `${p.city}/${p.category}`))

  // T-097: 도시 허브 (/[city]) — 업체가 있는 도시만
  const activeCities = new Set(places.map(p => p.city))
  for (const city of cities) {
    if (!activeCities.has(city.slug)) continue
    entries.push({
      url: `${baseUrl}/${city.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    })
  }

  // 도시+카테고리 리스트 페이지 (업체가 있는 카테고리만)
  for (const city of cities) {
    for (const cat of categories) {
      if (!activeCategoryKeys.has(`${city.slug}/${cat.slug}`)) continue
      entries.push({
        url: `${baseUrl}/${city.slug}/${cat.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.9,
      })
    }
  }

  // T-097: 블로그 도시/섹터 허브 — 블로그가 있는 도시/섹터만
  const blogAll = await getAllActiveBlogPosts()
  const blogCities = new Set(blogAll.map(p => p.city))
  for (const city of cities) {
    if (!blogCities.has(city.slug)) continue
    entries.push({
      url: `${baseUrl}/blog/${city.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }
  const blogCitySectorKeys = new Set(blogAll.map(p => `${p.city}/${p.sector}`))
  for (const city of cities) {
    for (const sec of sectors) {
      if (!blogCitySectorKeys.has(`${city.slug}/${sec.slug}`)) continue
      entries.push({
        url: `${baseUrl}/blog/${city.slug}/${sec.slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.75,
      })
    }
  }

  // 업체 프로필 페이지 (T-122: lastModified 를 실제 updated_at 으로)
  for (const place of places) {
    entries.push({
      url: `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
      lastModified: place.lastUpdated ?? now,
      changeFrequency: 'monthly',
      priority: 0.8,
    })
  }

  // 블로그 홈
  entries.push({
    url: `${baseUrl}/blog`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.9,
  })

  // 블로그 글 (T-010g 마이그레이션 후 통합 — keyword/compare/guide 12개)
  // T-122: 개별 updatedAt 노출 원하면 getAllActiveBlogPosts 반환 타입 확장 필요 (현재 최소).
  const blogPosts = blogAll
  for (const p of blogPosts) {
    entries.push({
      url: `${baseUrl}/blog/${p.city}/${p.sector}/${p.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.85,
    })
  }

  // URL 중복 제거
  const seen = new Set<string>()
  return entries.filter(e => {
    if (seen.has(e.url)) return false
    seen.add(e.url)
    return true
  })
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

/**
 * 업체 페이지 breadcrumb (4단계)
 * 홈 › [도시] › [카테고리] › [업체]
 *
 * WO #12: sector 중간 hub("천안 의료") 제거 — 도시명/카테고리명만 노출.
 * placeName 미지정 시 3단계 (홈 › 도시 › 카테고리)
 */
export function buildBusinessBreadcrumb(args: {
  baseUrl: string
  cityName: string
  citySlug: string
  categoryName: string
  categorySlug: string
  placeName?: string
  placeSlug?: string
}): Array<{ name: string; url: string }> {
  const { baseUrl, cityName, citySlug, categoryName, categorySlug, placeName, placeSlug } = args
  const items = [
    { name: '홈', url: baseUrl },
    { name: cityName, url: `${baseUrl}/${citySlug}` },
    { name: categoryName, url: `${baseUrl}/${citySlug}/${categorySlug}` },
  ]
  if (placeName && placeSlug) {
    items.push({
      name: placeName,
      url: `${baseUrl}/${citySlug}/${categorySlug}/${placeSlug}`,
    })
  }
  return items
}

/**
 * 블로그 글 breadcrumb (5단계)
 * 홈 › 블로그 › [도시] › [대분류] › [글]
 *
 * 키워드/비교/가이드 통합 라우트(/blog/[city]/[sector]/[slug])용.
 */
export function buildBlogBreadcrumb(args: {
  baseUrl: string
  cityName: string
  citySlug: string
  sectorName: string
  sectorSlug: string
  title: string
  slug: string
}): Array<{ name: string; url: string }> {
  const { baseUrl, cityName, citySlug, sectorName, sectorSlug, title, slug } = args
  return [
    { name: '홈', url: baseUrl },
    { name: '블로그', url: `${baseUrl}/blog` },
    { name: cityName, url: `${baseUrl}/blog/${citySlug}` },
    { name: sectorName, url: `${baseUrl}/blog/${citySlug}/${sectorSlug}` },
    { name: title, url: `${baseUrl}/blog/${citySlug}/${sectorSlug}/${slug}` },
  ]
}

/**
 * 카테고리 리스팅 Direct Answer Block 생성
 * 상위 업체명 + 평점을 포함한 자기완결형 요약
 */
export function generateCategoryDAB(places: Place[], cityName: string, catName: string, metaDescriptor?: string): string {
  const descriptor = metaDescriptor ?? '전문 분야'

  if (places.length === 0) {
    return `${cityName} 지역 ${catName} 업체 정보를 준비 중입니다.`
  }

  const top = places.slice(0, 3)
  const names = top.map(p => p.name).join(', ')

  const year = new Date().getFullYear()
  return `${year}년 기준 ${cityName} ${catName} ${places.length}곳이 등록되어 있습니다. ${names} 등의 ${descriptor}, 위치, 이용 후기를 정리했습니다.`
}
