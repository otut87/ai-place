// T-194 — 키워드 뱅크 발급·사용 기록.
// 핵심 API:
//  - pickTargetQuery: PostgreSQL 함수 pick_target_query() RPC 호출 (FOR UPDATE SKIP LOCKED 경합 방어)
//  - markKeywordUsed: 블로그 연결 기록 (keyword_bank_usage)
//  - getAvailableKeywords: 관리자 대시보드용 풀 조회

import { getAdminClient } from '@/lib/supabase/admin-client'
import type { AngleKey } from './keyword-generator'

export interface KeywordRow {
  id: string
  keyword: string
  longtails: string[]
  priority: number
  angle: string | null
  postType: string | null
}

export interface PickTargetQueryInput {
  sector: string
  city?: string | null
  angle?: AngleKey | null
  postType?: string | null
}

/**
 * 발급 — 동시 호출 안전.
 * 반환 null = 해당 조건의 활성 키워드가 풀에 없음 (refill 필요).
 */
export async function pickTargetQuery(input: PickTargetQueryInput): Promise<KeywordRow | null> {
  const admin = getAdminClient()
  if (!admin) throw new Error('pickTargetQuery: admin client 미초기화')

  const { data, error } = await admin.rpc('pick_target_query', {
    p_sector: input.sector,
    p_city: input.city ?? null,
    p_angle: input.angle ?? null,
    p_post_type: input.postType ?? null,
  })

  if (error) {
    console.error('[keyword-bank] pick_target_query RPC 실패:', error.message)
    throw new Error(`pick_target_query: ${error.message}`)
  }

  const rows = data as Array<{
    id: string
    keyword: string
    longtails: string[]
    priority: number
    angle: string | null
    post_type: string | null
  }> | null

  if (!rows || rows.length === 0) return null

  const r = rows[0]
  return {
    id: r.id,
    keyword: r.keyword,
    longtails: r.longtails ?? [],
    priority: r.priority,
    angle: r.angle,
    postType: r.post_type,
  }
}

/**
 * 블로그 글과 키워드 연결 기록 (N:M).
 * blog_posts.keyword_id 는 대표 1건, 이 테이블은 중복/이력 추적용.
 */
export async function markKeywordUsed(keywordId: string, blogPostId: string | null): Promise<void> {
  const admin = getAdminClient()
  if (!admin) throw new Error('markKeywordUsed: admin client 미초기화')

  const { error } = await (admin.from('keyword_bank_usage') as ReturnType<typeof admin.from>).insert({
    keyword_id: keywordId,
    blog_post_id: blogPostId,
  } as never)
  if (error) {
    console.error('[keyword-bank] usage insert 실패:', error.message)
  }
}

export interface KeywordBankFilter {
  sector?: string
  city?: string | null
  angle?: AngleKey | null
  active?: boolean
  limit?: number
}

/**
 * 관리자 대시보드용 키워드 풀 조회.
 * 정렬: used_count ASC, priority ASC (덜 쓰인 우선, 우선순위 낮은 순).
 */
export async function getAvailableKeywords(filter: KeywordBankFilter = {}): Promise<KeywordRow[]> {
  const admin = getAdminClient()
  if (!admin) return []

  let q = admin.from('keyword_bank').select('id, keyword, longtails, priority, angle, post_type, used_count')

  if (filter.sector) q = q.eq('sector', filter.sector)
  if (filter.city !== undefined) {
    if (filter.city === null) q = q.is('city', null)
    else q = q.eq('city', filter.city)
  }
  if (filter.angle !== undefined && filter.angle !== null) q = q.eq('angle', filter.angle)
  if (filter.active !== undefined) q = q.eq('active', filter.active)

  q = q.order('used_count', { ascending: true }).order('priority', { ascending: true })
  if (filter.limit) q = q.limit(filter.limit)

  const { data, error } = await q
  if (error || !data) {
    if (error) console.error('[keyword-bank] getAvailableKeywords 실패:', error.message)
    return []
  }

  const rows = data as Array<{
    id: string
    keyword: string
    longtails: string[]
    priority: number
    angle: string | null
    post_type: string | null
  }>

  return rows.map(r => ({
    id: r.id,
    keyword: r.keyword,
    longtails: r.longtails ?? [],
    priority: r.priority,
    angle: r.angle,
    postType: r.post_type,
  }))
}

export interface InsertKeywordInput {
  keyword: string
  sector: string
  city?: string | null
  angle?: AngleKey | null
  postType?: string | null
  priority?: number
  competition?: 'low' | 'medium' | 'high' | null
  longtails?: string[]
  source?: string
}

/**
 * 새 키워드 1건 삽입 — seed·refill 에서 사용.
 * unique (keyword, sector, city) 충돌 시 조용히 무시 (on conflict do nothing).
 */
export async function insertKeyword(input: InsertKeywordInput): Promise<{ inserted: boolean; error?: string }> {
  const admin = getAdminClient()
  if (!admin) return { inserted: false, error: 'admin client 미초기화' }

  const { error } = await (admin.from('keyword_bank') as ReturnType<typeof admin.from>).insert({
    keyword: input.keyword,
    sector: input.sector,
    city: input.city ?? null,
    angle: input.angle ?? null,
    post_type: input.postType ?? null,
    priority: input.priority ?? 5,
    competition: input.competition ?? null,
    longtails: input.longtails ?? [],
    source: input.source ?? 'llm_generated',
    validated_at: new Date().toISOString(),
  } as never)

  if (error) {
    // 23505 = unique_violation — 중복은 정상 스킵.
    if (error.code === '23505') return { inserted: false }
    return { inserted: false, error: error.message }
  }
  return { inserted: true }
}
