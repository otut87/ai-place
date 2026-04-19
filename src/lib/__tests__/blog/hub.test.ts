// T-097 — 블로그 도시/섹터 허브 데이터 유틸.
// /blog/[city] 에서 섹터별로 그룹핑, /blog/[city]/[sector] 에서 카테고리별 그룹핑.

import { describe, it, expect } from 'vitest'
import { groupBlogPostsBySector, groupBlogPostsByCategory } from '@/lib/blog/hub'
import type { BlogPostSummary } from '@/lib/types'

const make = (overrides: Partial<BlogPostSummary>): BlogPostSummary => ({
  id: 'id',
  slug: 'slug',
  title: 'Title',
  summary: 'Summary',
  city: 'cheonan',
  sector: 'medical',
  category: 'dermatology',
  postType: 'guide',
  tags: [],
  viewCount: 0,
  publishedAt: '2026-04-10T00:00:00Z',
  ...overrides,
})

describe('groupBlogPostsBySector', () => {
  it('섹터별로 그룹핑되고 섹터 순서는 입력순 유지', () => {
    const posts = [
      make({ sector: 'medical', slug: 'a' }),
      make({ sector: 'food', slug: 'b' }),
      make({ sector: 'medical', slug: 'c' }),
    ]
    const groups = groupBlogPostsBySector(posts)
    expect(groups).toHaveLength(2)
    expect(groups[0].sector).toBe('medical')
    expect(groups[0].posts).toHaveLength(2)
    expect(groups[1].sector).toBe('food')
    expect(groups[1].posts).toHaveLength(1)
  })

  it('각 섹터 내부는 publishedAt DESC 로 정렬된다', () => {
    const posts = [
      make({ sector: 'medical', slug: 'old', publishedAt: '2026-01-01T00:00:00Z' }),
      make({ sector: 'medical', slug: 'new', publishedAt: '2026-04-01T00:00:00Z' }),
    ]
    const groups = groupBlogPostsBySector(posts)
    expect(groups[0].posts.map(p => p.slug)).toEqual(['new', 'old'])
  })

  it('빈 배열은 빈 결과', () => {
    expect(groupBlogPostsBySector([])).toEqual([])
  })
})

describe('groupBlogPostsByCategory', () => {
  it('카테고리별 그룹핑', () => {
    const posts = [
      make({ category: 'dermatology', slug: 'a' }),
      make({ category: 'dental', slug: 'b' }),
      make({ category: 'dermatology', slug: 'c' }),
    ]
    const groups = groupBlogPostsByCategory(posts)
    expect(groups).toHaveLength(2)
    expect(groups.find(g => g.category === 'dermatology')!.posts).toHaveLength(2)
    expect(groups.find(g => g.category === 'dental')!.posts).toHaveLength(1)
  })

  it('category 가 null 인 경우 "uncategorized" 버킷으로 집계', () => {
    const posts = [make({ category: null, slug: 'x' })]
    const groups = groupBlogPostsByCategory(posts)
    expect(groups[0].category).toBe('uncategorized')
  })
})
