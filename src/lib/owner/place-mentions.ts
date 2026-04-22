// Sprint D-1 / T-200 — place_mentions CRUD + fan-out 헬퍼.
//
// 책임:
//   - URL builder: 소스 타입별 표준 path 생성 (bot_visits.path 와 1:1 매칭)
//   - upsertPlaceMentions: 배치 upsert (멱등, unique constraint 활용)
//   - fanOutBlogPost: blog_posts.places_mentioned UUID[] → place_mentions 확장
//   - removeMentionsForPath / removeMentionsForPlace: 정리
//
// 모든 DB 쓰기는 admin client (service_role) 기반. RLS 에서 service_role 만 허용.

import { getAdminClient } from '@/lib/supabase/admin-client'
import type { MentionType } from './bot-stats'

export interface MentionRow {
  placeId: string
  pagePath: string
  pageType: MentionType
}

// ── URL 빌더 ────────────────────────────────────────────────────────────
// bot_visits.path 는 쿼리/해시 제거된 pathname 기준으로 저장되므로 일치시킨다.

export function buildPlacePath(city: string, category: string, slug: string): string {
  return `/${city}/${category}/${slug}`
}

export function buildBlogPath(city: string, sector: string, slug: string): string {
  return `/blog/${city}/${sector}/${slug}`
}

/**
 * 블로그 글의 page_type 은 post_type 과 무관하게 항상 'blog'.
 * 오너 UI 의 "업체정보/비교/가이드/키워드" 세부 분류는 blog_posts.post_type 으로 수행.
 * seed 'compare'/'guide'/'keyword' 매핑은 scripts/sync-place-mentions.ts 에서 직접 설정.
 */
export function normalizeBlogPostMentionType(): MentionType {
  return 'blog'
}

// ── Upsert ──────────────────────────────────────────────────────────────

export interface UpsertResult {
  inserted: number
  /** 요청된 총 행 수 (멱등이므로 upsert 는 insert/update 구분 안 함). */
  total: number
}

/**
 * 배치 upsert. 중복 (place_id, page_path) 은 conflict → no-op.
 * 대량 seed 에서도 안전하게 돌아간다.
 */
export async function upsertPlaceMentions(rows: ReadonlyArray<MentionRow>): Promise<UpsertResult> {
  if (rows.length === 0) return { inserted: 0, total: 0 }
  const admin = getAdminClient()
  if (!admin) {
    console.error('[place-mentions] admin client 초기화 실패')
    return { inserted: 0, total: rows.length }
  }

  const payload = rows.map((r) => ({
    place_id: r.placeId,
    page_path: r.pagePath,
    page_type: r.pageType,
  }))

  const { error, count } = await admin
    .from('place_mentions')
    .upsert(payload, { onConflict: 'place_id,page_path', ignoreDuplicates: true, count: 'exact' })

  if (error) {
    console.error('[place-mentions] upsert 실패:', error.message)
    return { inserted: 0, total: rows.length }
  }

  return { inserted: count ?? 0, total: rows.length }
}

/**
 * blog_posts 한 건의 places_mentioned UUID[] 를 place_mentions 로 확장.
 * status='active' 블로그만 호출할 것 — 드래프트/폐기는 제외.
 */
export async function fanOutBlogPost(input: {
  placeIds: ReadonlyArray<string>
  pagePath: string
}): Promise<UpsertResult> {
  const rows: MentionRow[] = input.placeIds.map((pid) => ({
    placeId: pid,
    pagePath: input.pagePath,
    pageType: 'blog',
  }))
  return upsertPlaceMentions(rows)
}

/** 특정 page_path 의 모든 매핑 삭제 (블로그 archived / place soft-delete 등). */
export async function removeMentionsForPath(pagePath: string): Promise<number> {
  const admin = getAdminClient()
  if (!admin) return 0
  const { error, count } = await admin
    .from('place_mentions')
    .delete({ count: 'exact' })
    .eq('page_path', pagePath)
  if (error) {
    console.error('[place-mentions] removeMentionsForPath 실패:', error.message)
    return 0
  }
  return count ?? 0
}

/** 특정 place 의 모든 매핑 삭제 (places CASCADE 로 자동 처리되지만 명시적 호출 지원). */
export async function removeMentionsForPlace(placeId: string): Promise<number> {
  const admin = getAdminClient()
  if (!admin) return 0
  const { error, count } = await admin
    .from('place_mentions')
    .delete({ count: 'exact' })
    .eq('place_id', placeId)
  if (error) {
    console.error('[place-mentions] removeMentionsForPlace 실패:', error.message)
    return 0
  }
  return count ?? 0
}

// ── 조회 ────────────────────────────────────────────────────────────────

export interface MentionCounts {
  placeId: string
  total: number
  /** detail 제외 언급 횟수 (AEO 점수 "언급" 룰의 입력). */
  contentMentions: number
  byType: Record<MentionType, number>
}

/** 여러 place 에 대한 언급 횟수 집계. AEO 점수 계산에 사용. */
export async function countMentionsByPlace(placeIds: ReadonlyArray<string>): Promise<Map<string, MentionCounts>> {
  const out = new Map<string, MentionCounts>()
  if (placeIds.length === 0) return out

  const admin = getAdminClient()
  if (!admin) {
    for (const pid of placeIds) out.set(pid, emptyCounts(pid))
    return out
  }

  const { data, error } = await admin
    .from('place_mentions')
    .select('place_id, page_type')
    .in('place_id', placeIds)

  if (error) {
    console.error('[place-mentions] countMentionsByPlace 실패:', error.message)
    for (const pid of placeIds) out.set(pid, emptyCounts(pid))
    return out
  }

  for (const pid of placeIds) out.set(pid, emptyCounts(pid))

  for (const row of (data ?? []) as Array<{ place_id: string; page_type: MentionType }>) {
    const c = out.get(row.place_id)
    if (!c) continue
    c.total += 1
    c.byType[row.page_type] += 1
    if (row.page_type !== 'place') c.contentMentions += 1
  }

  return out
}

function emptyCounts(placeId: string): MentionCounts {
  return {
    placeId,
    total: 0,
    contentMentions: 0,
    byType: { place: 0, blog: 0, compare: 0, guide: 0, keyword: 0 },
  }
}
