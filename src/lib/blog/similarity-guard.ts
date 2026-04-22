// T-195 — similarity-guard (Phase 3).
// 발행 직전, 최근 30일 내 active 블로그 전체와 Jaccard 유사도를 비교.
//  - 0.35+ FAIL (pipeline 이 status='failed_similarity' 로 마킹)
//  - 0.25 이상 0.35 미만 WARN (pipeline_log 에 기록, 관리자 검수 경고)
//  - 0.25 미만 PASS

import { getAdminClient } from '@/lib/supabase/admin-client'
import { sixGramShingles, jaccard } from './similarity'

const BLOCK_THRESHOLD = 0.35
const WARN_THRESHOLD = 0.25

export type SimilarityVerdict = 'pass' | 'warn' | 'block'

export interface SimilarityGuardResult {
  verdict: SimilarityVerdict
  similarity: number              // 최대 유사도 (0~1)
  similarPosts: Array<{
    id: string
    slug: string
    title: string
    similarity: number
  }>
  comparedCount: number           // 비교 대상 수
}

export interface SimilarityGuardInput {
  /** 새 블로그 본문 (markdown) */
  newContent: string
  /** 제목 — 없어도 동작하나 제목도 같이 비교해야 완성도 높음 */
  newTitle?: string
  /** 편집 중인 블로그 id 를 주면 자신 제외 */
  excludeBlogId?: string | null
  /** 최근 며칠 (기본 30) */
  lookbackDays?: number
  /** 최대 비교 대상 (기본 200 — 최근 순) */
  limit?: number
  /** 차단 임계 override */
  blockThreshold?: number
  /** 경고 임계 override */
  warnThreshold?: number
}

/**
 * 최근 lookbackDays 내 active 블로그 전체와 유사도 비교.
 * DB 미가용 시 조용히 pass (차단하지 않음 — 개발 환경 친화).
 */
export async function guardBeforeInsert(
  input: SimilarityGuardInput,
): Promise<SimilarityGuardResult> {
  const admin = getAdminClient()
  if (!admin) {
    return { verdict: 'pass', similarity: 0, similarPosts: [], comparedCount: 0 }
  }

  const lookbackDays = input.lookbackDays ?? 30
  const limit = input.limit ?? 200
  const blockAt = input.blockThreshold ?? BLOCK_THRESHOLD
  const warnAt = input.warnThreshold ?? WARN_THRESHOLD

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  let q = admin
    .from('blog_posts')
    .select('id, slug, title, content')
    .eq('status', 'active')
    .gte('published_at', since)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (input.excludeBlogId) q = q.neq('id', input.excludeBlogId)

  const { data, error } = await q
  if (error || !data) {
    console.error('[similarity-guard] query 실패:', error?.message)
    return { verdict: 'pass', similarity: 0, similarPosts: [], comparedCount: 0 }
  }

  const rows = data as Array<{ id: string; slug: string; title: string; content: string }>
  if (rows.length === 0) {
    return { verdict: 'pass', similarity: 0, similarPosts: [], comparedCount: 0 }
  }

  // 제목+본문을 합쳐 shingles 계산 (제목만 같은 케이스 검출)
  const newCombined = `${input.newTitle ?? ''}\n\n${input.newContent}`
  const newShingles = sixGramShingles(newCombined)

  let max = 0
  const similarPosts: SimilarityGuardResult['similarPosts'] = []

  for (const row of rows) {
    const otherShingles = sixGramShingles(`${row.title}\n\n${row.content}`)
    const sim = jaccard(newShingles, otherShingles)
    if (sim >= warnAt) {
      similarPosts.push({ id: row.id, slug: row.slug, title: row.title, similarity: sim })
    }
    if (sim > max) max = sim
  }

  // 유사 순으로 정렬
  similarPosts.sort((a, b) => b.similarity - a.similarity)

  const verdict: SimilarityVerdict =
    max >= blockAt ? 'block' : max >= warnAt ? 'warn' : 'pass'

  return {
    verdict,
    similarity: Math.round(max * 100) / 100,
    similarPosts: similarPosts.slice(0, 5),
    comparedCount: rows.length,
  }
}
