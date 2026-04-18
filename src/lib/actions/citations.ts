'use server'

// T-056 — citation_results 쓰기/조회 서버 액션.
// 작성: scripts/baseline-test.ts 가 runId 단위로 batchInsert.
// 조회: /admin/citations 페이지가 최신 N일 구간을 요청.

import { getAdminClient } from '@/lib/supabase/admin-client'
import type { AIEngine, CitationRow } from '@/lib/citations/aggregate'

export interface CitationInsert {
  promptId: string
  engine: AIEngine
  sessionId?: string
  response: string
  citedSources?: string[]
  citedPlaces?: string[]
  aiplaceCited: boolean
  testedAt?: string
}

export async function insertCitations(rows: CitationInsert[]): Promise<{ success: boolean; inserted: number; error?: string }> {
  if (rows.length === 0) return { success: true, inserted: 0 }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, inserted: 0, error: 'Admin 클라이언트 초기화 실패' }

  const payload = rows.map(r => ({
    prompt_id: r.promptId,
    engine: r.engine,
    session_id: r.sessionId ?? null,
    response: r.response,
    cited_sources: r.citedSources ?? [],
    cited_places: r.citedPlaces ?? [],
    aiplace_cited: r.aiplaceCited,
    tested_at: r.testedAt ?? new Date().toISOString(),
  }))

  const { error, count } = await (supabase.from('citation_results') as ReturnType<typeof supabase.from>)
    .insert(payload as never, { count: 'exact' })
  if (error) {
    console.error('[citations] insertCitations 실패:', error)
    return { success: false, inserted: 0, error: '인용 결과 저장 실패' }
  }
  return { success: true, inserted: count ?? rows.length }
}

export async function listRecentCitations(days = 30, limit = 1000): Promise<CitationRow[]> {
  const supabase = getAdminClient()
  if (!supabase) return []

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('citation_results')
    .select('id, prompt_id, engine, session_id, response, cited_sources, cited_places, aiplace_cited, tested_at')
    .gte('tested_at', since)
    .order('tested_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as unknown as CitationRow[]
}
