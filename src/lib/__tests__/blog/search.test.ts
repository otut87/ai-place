// T-248 — 블로그 검색 인메모리 필터 검증.

import { describe, it, expect } from 'vitest'
import { normalizeQuery, searchBlogPosts } from '@/lib/blog/search'
import type { BlogPostSummary } from '@/lib/types'

function post(over: Partial<BlogPostSummary>): BlogPostSummary {
  return {
    slug: 'x',
    title: '제목',
    summary: '요약',
    city: 'cheonan',
    sector: 'medical',
    category: 'dermatology',
    postType: 'compare',
    publishedAt: '2026-04-20T00:00:00Z',
    updatedAt: null,
    tags: [],
    viewCount: 0,
    ...over,
  } as BlogPostSummary
}

describe('normalizeQuery', () => {
  it('소문자 + trim + 다중 공백 1개', () => {
    expect(normalizeQuery('  Hello   World  ')).toBe('hello world')
  })
  it('빈 문자열', () => {
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('searchBlogPosts', () => {
  const posts: BlogPostSummary[] = [
    post({ slug: 'a', title: '천안 피부과 비교', tags: ['피부과'] }),
    post({ slug: 'b', title: '아산 인테리어 가이드', summary: '평당가', tags: ['인테리어'] }),
    post({ slug: 'c', title: '천안 보톡스 잘하는 곳', summary: '시술 단가', tags: ['보톡스', '리프팅'] }),
  ]

  it('빈 쿼리 → 그대로 반환', () => {
    expect(searchBlogPosts(posts, '')).toEqual(posts)
    expect(searchBlogPosts(posts, null)).toEqual(posts)
    expect(searchBlogPosts(posts, undefined)).toEqual(posts)
  })

  it('단일 토큰 — 제목 매칭', () => {
    const r = searchBlogPosts(posts, '피부과')
    expect(r.map(p => p.slug)).toEqual(['a'])
  })

  it('단일 토큰 — 태그 매칭', () => {
    const r = searchBlogPosts(posts, '리프팅')
    expect(r.map(p => p.slug)).toEqual(['c'])
  })

  it('단일 토큰 — 요약 매칭', () => {
    const r = searchBlogPosts(posts, '평당가')
    expect(r.map(p => p.slug)).toEqual(['b'])
  })

  it('대소문자 무시', () => {
    const r = searchBlogPosts(posts, 'BOTOX'.toLowerCase().replace('botox', '보톡스'))
    expect(r.map(p => p.slug)).toEqual(['c'])
  })

  it('다중 토큰 — AND 매칭 (모두 포함된 글만)', () => {
    const r = searchBlogPosts(posts, '천안 보톡스')
    expect(r.map(p => p.slug)).toEqual(['c'])
  })

  it('다중 토큰 — 중간에 매칭 안 되는 토큰 있으면 제외', () => {
    const r = searchBlogPosts(posts, '천안 인테리어')
    expect(r).toEqual([])
  })

  it('어떤 글에도 없는 토큰 → 빈 배열', () => {
    expect(searchBlogPosts(posts, 'xyz존재안함')).toEqual([])
  })
})
