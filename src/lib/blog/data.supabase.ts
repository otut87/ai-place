// AI Place — Blog Posts Data Layer (T-010b, Phase 1.5)
// blog_posts 테이블 쿼리. Supabase 실패 시 빈 결과 폴백.
// Phase 1.5 마이그레이션(T-010e) 완료 후 DB가 채워지면 실데이터 반환.

import type { BlogPost, BlogPostSummary } from '../types'
import {
  dbBlogPostToBlogPost,
  dbBlogPostToSummary,
  type DbBlogPost,
} from '../supabase-types'
import { getReadClient } from '../supabase/read-client'
import { slugMatchCandidates } from '../slug-match'

const ACTIVE = 'active'

// Supabase Postgrest 빌더는 thenable. mock 호환성을 위해 최소 인터페이스만 사용.
type Chain = {
  eq: (col: string, val: unknown) => Chain
  contains: (col: string, val: unknown) => Chain
  order: (col: string, opts?: { ascending: boolean }) => Chain
  limit: (n: number) => Chain
  then: (cb: (r: { data: unknown; error: unknown }) => void) => Promise<unknown>
}

function startQuery(): Chain | null {
  const supabase = getReadClient()
  if (!supabase) return null
  return supabase.from('blog_posts').select('*') as unknown as Chain
}

async function runListQuery(
  apply: (q: Chain) => Chain,
): Promise<BlogPostSummary[]> {
  try {
    const q = startQuery()
    if (!q) return []
    const { data, error } = (await apply(q)) as unknown as {
      data: DbBlogPost[] | null
      error: unknown
    }
    if (error || !data) return []
    return data.map(dbBlogPostToSummary)
  } catch (err) {
    console.error('[blog/data.supabase] list query failed:', err)
    return []
  }
}

// --- 단일 조회 ---

/** city + sector + slug 단건 조회. 없으면 null.
 *  T-190: 한글 slug 의 Unicode 정규화(NFC/NFD) 불일치 방어 — 후보 순차 시도.
 */
export async function getBlogPost(
  city: string,
  sector: string,
  slug: string,
): Promise<BlogPost | null> {
  try {
    for (const candidate of slugMatchCandidates(slug)) {
      const q = startQuery()
      if (!q) return null
      const { data, error } = (await q
        .eq('city', city)
        .eq('sector', sector)
        .eq('slug', candidate)
        .eq('status', ACTIVE)) as unknown as { data: DbBlogPost[] | null; error: unknown }

      if (!error && data && data.length > 0) {
        return dbBlogPostToBlogPost(data[0])
      }
    }
    return null
  } catch (err) {
    console.error('[blog/data.supabase] getBlogPost failed:', err)
    return null
  }
}

// --- 목록 조회 ---

/** 도시 단위 (status=active, 최신순) */
export function getBlogPostsByCity(city: string): Promise<BlogPostSummary[]> {
  return runListQuery(q =>
    q.eq('city', city)
      .eq('status', ACTIVE)
      .order('published_at', { ascending: false }),
  )
}

/** 도시 + sector */
export function getBlogPostsBySector(
  city: string,
  sector: string,
): Promise<BlogPostSummary[]> {
  return runListQuery(q =>
    q.eq('city', city)
      .eq('sector', sector)
      .eq('status', ACTIVE)
      .order('published_at', { ascending: false }),
  )
}

/** 최근 작성 N개 (전체) */
export function getRecentBlogPosts(limit: number): Promise<BlogPostSummary[]> {
  return runListQuery(q =>
    q.eq('status', ACTIVE)
      .order('published_at', { ascending: false })
      .limit(limit),
  )
}

/** 인기글 (view_count DESC) N개 */
export function getPopularBlogPosts(limit: number): Promise<BlogPostSummary[]> {
  return runListQuery(q =>
    q.eq('status', ACTIVE)
      .order('view_count', { ascending: false })
      .limit(limit),
  )
}

/**
 * generateStaticParams 용 — 모든 active 글의 라우팅 키 반환.
 * 페이로드 가벼우나 select * 를 그대로 사용 (별도 분기 회피).
 */
export async function getAllActiveBlogPosts(): Promise<
  Array<{ city: string; sector: string; slug: string }>
> {
  try {
    const supabase = getReadClient()
    if (!supabase) return []
    const initial = supabase.from('blog_posts').select('*') as unknown as Chain
    const { data, error } = (await initial.eq('status', ACTIVE)) as unknown as {
      data: DbBlogPost[] | null
      error: unknown
    }
    if (error || !data) return []
    return data.map(r => ({ city: r.city, sector: r.sector, slug: r.slug }))
  } catch (err) {
    console.error('[blog/data.supabase] getAllActiveBlogPosts failed:', err)
    return []
  }
}

/** 특정 업체 slug 와 연결된 글 (양방향 링크, related_place_slugs 배열 contains) */
export function getBlogPostsByPlace(placeSlug: string): Promise<BlogPostSummary[]> {
  return runListQuery(q =>
    q.eq('status', ACTIVE)
      .contains('related_place_slugs', [placeSlug])
      .order('published_at', { ascending: false }),
  )
}
