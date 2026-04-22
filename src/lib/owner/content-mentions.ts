// /owner/content — 내 업체가 언급된 블로그 콘텐츠 목록 로더.
//
// 데이터 경로:
//   1) place_mentions 에서 placeIds 로 매핑된 (page_path, page_type, place_id[]) 목록
//      - page_type='place' 는 업체 상세 URL 자체 → 오너 "콘텐츠" 에서는 제외
//        (내 업체 페이지는 /owner/places/[id] 에서 관리)
//      - page_type='blog' 은 blog_posts 글 — post_type 으로 세분화
//      - page_type='compare|guide|keyword' 는 seed source — 그대로 표시
//   2) blog_posts 에서 제목/요약/본문/태그/post_type/썸네일 보강
//
// 탭 키(ContentTabKey) — 파이프라인이 생성하는 4종:
//   detail  : blog_posts.post_type='detail'  — 특정 업체 1곳 심층 블로그글
//   compare : blog_posts.post_type='compare' — 업체 vs 업체
//   guide   : blog_posts.post_type='guide'   — 시술·서비스별 선택
//   keyword : blog_posts.post_type='keyword' — 지역+업종 랜딩
// post_type='general' (admin 수동) 은 어느 탭에도 속하지 않고 '전체' 에만 포함.

import { getAdminClient } from '@/lib/supabase/admin-client'
import type { BlogPostType } from '@/lib/types'
import type { MentionType } from './bot-stats'

/** 오너 콘텐츠 페이지 탭 키 — blog_posts.post_type 기반 4종. */
export type ContentTabKey = 'detail' | 'compare' | 'guide' | 'keyword'

export const CONTENT_TAB_KEYS: ContentTabKey[] = ['detail', 'compare', 'guide', 'keyword']

export interface OwnerContentItem {
  path: string
  /** 원본 page_type (place_mentions 스키마). 분류는 contentType 기준. */
  type: MentionType
  /** 탭 키. null = post_type='general' — '전체' 탭에만 표시. */
  contentType: ContentTabKey | null
  placeIds: string[]
  /** blog_posts 조회가 성공했을 때만 채워짐. seed source 는 null. */
  title: string | null
  summary: string | null
  tags: string[]
  /** content(markdown) 길이. "N자 · 읽기 M분" 계산에 사용. 0 이면 미보강. */
  charCount: number
  city: string | null
  sector: string | null
  status: string | null
  publishedAt: string | null
  thumbnailUrl: string | null
  /** blog_posts.post_type — seed 는 null. */
  postType: BlogPostType | null
  /** blog_posts.published_at | created_at | place_mentions.created_at (fallback). */
  sortKey: string
}

export interface LoadOwnerContentResult {
  /** detail(업체 상세 URL) 제외된 items. post_type='general' 은 포함(contentType=null). */
  items: OwnerContentItem[]
  /** 탭 4종 카운트. general 은 포함되지 않음 — totalCount = items.length 사용. */
  counts: Record<ContentTabKey, number>
}

const EMPTY_COUNTS: Record<ContentTabKey, number> = { detail: 0, compare: 0, guide: 0, keyword: 0 }

/** post_type → 탭 키. 'general' 및 null 은 null(=미분류). */
function mapPostTypeToTab(pt: BlogPostType | null): ContentTabKey | null {
  if (pt === 'detail' || pt === 'compare' || pt === 'guide' || pt === 'keyword') return pt
  return null
}

/** seed page_type → 탭 키. 'place'(업체 상세 URL) 은 상위에서 쿼리로 제외. */
function mapSeedPageTypeToTab(pt: MentionType): ContentTabKey | null {
  if (pt === 'compare' || pt === 'guide' || pt === 'keyword') return pt
  return null
}

export async function loadOwnerContent(placeIds: string[]): Promise<LoadOwnerContentResult> {
  if (placeIds.length === 0) return { items: [], counts: { ...EMPTY_COUNTS } }

  const admin = getAdminClient()
  if (!admin) return { items: [], counts: { ...EMPTY_COUNTS } }

  // 1) 내 place 의 매핑 — page_type='place'(업체 상세 URL 자체) 는 제외
  const { data: mentionsData, error: mErr } = await admin
    .from('place_mentions')
    .select('page_path, page_type, place_id, created_at')
    .in('place_id', placeIds)
    .neq('page_type', 'place')

  if (mErr) {
    console.error('[owner-content] place_mentions 조회 실패:', mErr.message)
    return { items: [], counts: { ...EMPTY_COUNTS } }
  }

  const rows = (mentionsData ?? []) as Array<{
    page_path: string
    page_type: MentionType
    place_id: string
    created_at: string
  }>

  // path 기준 그룹핑 + 같은 path 에 여러 place 매핑 지원
  const byPath = new Map<string, OwnerContentItem>()

  for (const r of rows) {
    let item = byPath.get(r.page_path)
    if (!item) {
      // seed compare/guide/keyword 는 page_type 으로 탭 확정.
      // 'blog' 은 일단 null — blog_posts 보강 후 post_type 으로 확정.
      item = {
        path: r.page_path,
        type: r.page_type,
        contentType: mapSeedPageTypeToTab(r.page_type),
        placeIds: [r.place_id],
        title: null,
        summary: null,
        tags: [],
        charCount: 0,
        city: null,
        sector: null,
        status: null,
        publishedAt: null,
        thumbnailUrl: null,
        postType: null,
        sortKey: r.created_at,
      }
      byPath.set(r.page_path, item)
    } else if (!item.placeIds.includes(r.place_id)) {
      item.placeIds.push(r.place_id)
    }
  }

  // 2) blog_posts 메타데이터 보강
  const blogPaths = Array.from(byPath.values())
    .filter((i) => i.type === 'blog')
    .map((i) => i.path)

  if (blogPaths.length > 0) {
    const slugs = blogPaths
      .map((p) => p.split('/').pop())
      .filter((s): s is string => !!s && s.length > 0)

    if (slugs.length > 0) {
      const { data: blogData, error: bErr } = await admin
        .from('blog_posts')
        .select('slug, title, summary, content, tags, status, published_at, thumbnail_url, city, sector, post_type, created_at')
        .in('slug', slugs)

      if (bErr) {
        console.error('[owner-content] blog_posts 조회 실패:', bErr.message)
      } else {
        const blogRows = (blogData ?? []) as Array<{
          slug: string
          title: string | null
          summary: string | null
          content: string | null
          tags: string[] | null
          status: string | null
          published_at: string | null
          thumbnail_url: string | null
          city: string | null
          sector: string | null
          post_type: BlogPostType | null
          created_at: string | null
        }>

        for (const b of blogRows) {
          if (!b.city || !b.sector || !b.slug) continue
          const path = `/blog/${b.city}/${b.sector}/${b.slug}`
          const item = byPath.get(path)
          if (!item) continue
          item.title = b.title ?? null
          item.summary = b.summary ?? null
          item.tags = Array.isArray(b.tags) ? b.tags : []
          item.charCount = b.content ? b.content.length : 0
          item.city = b.city
          item.sector = b.sector
          item.status = b.status ?? null
          item.publishedAt = b.published_at ?? null
          item.thumbnailUrl = b.thumbnail_url ?? null
          item.postType = b.post_type ?? null
          // post_type 으로 탭 분류 확정 ('general' 은 null → '전체' 탭에만)
          item.contentType = mapPostTypeToTab(b.post_type)
          if (b.published_at) item.sortKey = b.published_at
          else if (b.created_at) item.sortKey = b.created_at
        }
      }
    }
  }

  // 3) counts + 정렬
  const counts: Record<ContentTabKey, number> = { ...EMPTY_COUNTS }
  const items = Array.from(byPath.values())
  for (const it of items) {
    if (it.contentType) counts[it.contentType] += 1
  }
  items.sort((a, b) => (b.sortKey ?? '').localeCompare(a.sortKey ?? ''))

  return { items, counts }
}
