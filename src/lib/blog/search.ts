// T-248 — 블로그 글 텍스트 검색 (인메모리).
// 현재 규모(글 수 ≤ 500)에서는 클라이언트 필터링이 충분.
// 추후 글 수 1000+ 시 Supabase RPC 또는 textsearch 인덱스로 이관.

import type { BlogPostSummary } from '@/lib/types'

/**
 * 검색어 정규화 — 소문자 + 양끝 공백 + 다중 공백 1개로.
 */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().trim().replace(/\s+/g, ' ')
}

/**
 * 검색 매칭 — title + summary + tags 에 대해 모든 토큰이 포함되면 hit.
 * 빈 쿼리는 그대로 통과 (필터 안 함).
 */
export function searchBlogPosts(
  posts: BlogPostSummary[],
  rawQuery: string | null | undefined,
): BlogPostSummary[] {
  if (!rawQuery) return posts
  const q = normalizeQuery(rawQuery)
  if (!q) return posts
  const tokens = q.split(' ').filter(Boolean)
  if (tokens.length === 0) return posts

  return posts.filter(p => {
    const haystack = [
      p.title ?? '',
      p.summary ?? '',
      ...(p.tags ?? []),
    ]
      .join(' ')
      .toLowerCase()
    return tokens.every(t => haystack.includes(t))
  })
}
