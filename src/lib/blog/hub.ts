// T-097 — 블로그 도시/섹터 허브용 그룹핑 유틸.
// /blog/[city] 는 섹터별 그룹, /blog/[city]/[sector] 는 카테고리별 그룹.

import type { BlogPostSummary } from '@/lib/types'

export interface SectorGroup {
  sector: string
  posts: BlogPostSummary[]
}

export interface CategoryGroup {
  category: string
  posts: BlogPostSummary[]
}

function sortByPublishedDesc(a: BlogPostSummary, b: BlogPostSummary): number {
  const at = a.publishedAt ?? ''
  const bt = b.publishedAt ?? ''
  if (bt > at) return 1
  if (bt < at) return -1
  return 0
}

export function groupBlogPostsBySector(posts: BlogPostSummary[]): SectorGroup[] {
  const order: string[] = []
  const buckets = new Map<string, BlogPostSummary[]>()
  for (const p of posts) {
    const key = p.sector
    if (!buckets.has(key)) {
      order.push(key)
      buckets.set(key, [])
    }
    buckets.get(key)!.push(p)
  }
  return order.map(sector => ({
    sector,
    posts: [...buckets.get(sector)!].sort(sortByPublishedDesc),
  }))
}

export function groupBlogPostsByCategory(posts: BlogPostSummary[]): CategoryGroup[] {
  const order: string[] = []
  const buckets = new Map<string, BlogPostSummary[]>()
  for (const p of posts) {
    const key = p.category ?? 'uncategorized'
    if (!buckets.has(key)) {
      order.push(key)
      buckets.set(key, [])
    }
    buckets.get(key)!.push(p)
  }
  return order.map(category => ({
    category,
    posts: [...buckets.get(category)!].sort(sortByPublishedDesc),
  }))
}
