// Sprint D-1 / T-200 — 오너 업체에 귀속된 AI 봇 방문 집계.
//
// 흐름:
//   1) place_mentions 에서 오너의 place_id 들 → page_path + page_type 맵 추출
//   2) bot_visits 에서 path IN + visited_at >= since 조회
//   3) bot_id → BotGroup / Engine 매핑 후 카테고리별 카운트
//
// 분리 기준 (OWNER_DASHBOARD_PLAN.md §3.1):
//   - direct:  page_type === 'detail'  (업체 상세 페이지 방문)
//   - mention: 그 외 (blog/compare/guide/keyword — 본문 언급)

import { getAdminClient } from '@/lib/supabase/admin-client'
import { AI_BOT_PATTERNS, type BotGroup } from '@/lib/seo/bot-detection'

export type AiSearchEngine = 'chatgpt' | 'claude' | 'perplexity' | 'other'
export type AiTrainingEngine = 'chatgpt' | 'claude' | 'gemini' | 'other'
export type MentionType = 'detail' | 'blog' | 'compare' | 'guide' | 'keyword'
export type Attribution = 'direct' | 'mention'

export interface OwnerBotBucket {
  total: number
  direct: number          // detail 매핑
  mention: number         // blog/compare/guide/keyword 매핑
  byEngine: Record<string, number>
  lastVisitAt: string | null
}

export interface OwnerBotSummary {
  periodDays: number
  since: string                     // ISO
  placeIds: string[]
  aiSearch: OwnerBotBucket          // AiSearchEngine keys
  aiTraining: OwnerBotBucket        // AiTrainingEngine keys
}

export interface OwnerBotVisit {
  id: number
  botId: string
  botLabel: string
  group: BotGroup
  path: string
  pageType: MentionType
  attribution: Attribution
  visitedAt: string
  placeIds: string[]                // 해당 path 에 매핑된 place_id 들 (1개 이상)
}

// ── 엔진 매핑 (bot_id → engine key) ────────────────────────────────────────
const AI_SEARCH_ENGINE_MAP: Record<string, AiSearchEngine> = {
  'chatgpt-user':    'chatgpt',
  'oai-searchbot':   'chatgpt',
  'claude-web':      'claude',
  'perplexitybot':   'perplexity',
  'perplexity-user': 'perplexity',
  'youbot':          'other',
  'duckassistbot':   'other',
}

const AI_TRAINING_ENGINE_MAP: Record<string, AiTrainingEngine> = {
  'gptbot':              'chatgpt',
  'claudebot':           'claude',
  'anthropic-ai':        'claude',
  'google-extended':     'gemini',
  'ccbot':               'other',
  'bytespider':          'other',
  'amazonbot':           'other',
  'applebot-extended':   'other',
  'cohere-ai':           'other',
  'ai2bot':              'other',
  'meta-externalagent':  'other',
}

const AI_SEARCH_ENGINE_KEYS: AiSearchEngine[] = ['chatgpt', 'claude', 'perplexity', 'other']
const AI_TRAINING_ENGINE_KEYS: AiTrainingEngine[] = ['chatgpt', 'claude', 'gemini', 'other']

const ID_TO_GROUP = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.group]))
const ID_TO_LABEL = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.label]))

export function mapBotToEngine(botId: string, group: BotGroup): string {
  if (group === 'ai-search') return AI_SEARCH_ENGINE_MAP[botId] ?? 'other'
  if (group === 'ai-training') return AI_TRAINING_ENGINE_MAP[botId] ?? 'other'
  return 'other'
}

function emptyBucket(engineKeys: readonly string[]): OwnerBotBucket {
  const byEngine: Record<string, number> = {}
  for (const k of engineKeys) byEngine[k] = 0
  return { total: 0, direct: 0, mention: 0, byEngine, lastVisitAt: null }
}

// ── 순수 집계 (입력: 이미 path→type 매핑된 bot_visits 행들) ─────────────────
export interface AnnotatedVisit {
  botId: string
  pageType: MentionType
  visitedAt: string
}

export function aggregateOwnerBotSummary(
  rows: ReadonlyArray<AnnotatedVisit>,
  placeIds: string[],
  periodDays: number,
  since: string,
): OwnerBotSummary {
  const aiSearch = emptyBucket(AI_SEARCH_ENGINE_KEYS)
  const aiTraining = emptyBucket(AI_TRAINING_ENGINE_KEYS)

  for (const r of rows) {
    const group = ID_TO_GROUP.get(r.botId)
    if (group !== 'ai-search' && group !== 'ai-training') continue

    const bucket = group === 'ai-search' ? aiSearch : aiTraining
    const engine = mapBotToEngine(r.botId, group)
    const attribution: Attribution = r.pageType === 'detail' ? 'direct' : 'mention'

    bucket.total += 1
    if (attribution === 'direct') bucket.direct += 1
    else bucket.mention += 1
    bucket.byEngine[engine] = (bucket.byEngine[engine] ?? 0) + 1

    if (!bucket.lastVisitAt || r.visitedAt > bucket.lastVisitAt) {
      bucket.lastVisitAt = r.visitedAt
    }
  }

  return { periodDays, since, placeIds, aiSearch, aiTraining }
}

// ── Supabase 조회 래퍼 ────────────────────────────────────────────────────
/**
 * 오너 업체에 귀속된 page_path → (page_type, place_id[]) 맵을 조회.
 * 동일 page_path 가 여러 place 에 귀속될 수 있어 place_id[] 로 보관.
 */
async function fetchPathMap(placeIds: string[]): Promise<Map<string, { pageType: MentionType; placeIds: string[] }>> {
  const map = new Map<string, { pageType: MentionType; placeIds: string[] }>()
  if (placeIds.length === 0) return map

  const admin = getAdminClient()
  if (!admin) return map

  const { data, error } = await admin
    .from('place_mentions')
    .select('page_path, page_type, place_id')
    .in('place_id', placeIds)

  if (error) {
    console.error('[bot-stats] place_mentions 조회 실패:', error.message)
    return map
  }

  const rows = (data ?? []) as Array<{ page_path: string; page_type: MentionType; place_id: string }>
  for (const r of rows) {
    const existing = map.get(r.page_path)
    if (existing) {
      if (!existing.placeIds.includes(r.place_id)) existing.placeIds.push(r.place_id)
    } else {
      map.set(r.page_path, { pageType: r.page_type, placeIds: [r.place_id] })
    }
  }
  return map
}

export async function getOwnerBotSummary(
  placeIds: string[],
  days = 30,
  now: Date = new Date(),
): Promise<OwnerBotSummary> {
  const since = new Date(now.getTime() - days * 86_400_000).toISOString()

  if (placeIds.length === 0) {
    return {
      periodDays: days,
      since,
      placeIds,
      aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
      aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
    }
  }

  const pathMap = await fetchPathMap(placeIds)
  if (pathMap.size === 0) {
    return {
      periodDays: days,
      since,
      placeIds,
      aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
      aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
    }
  }

  const admin = getAdminClient()
  if (!admin) {
    return {
      periodDays: days,
      since,
      placeIds,
      aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
      aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
    }
  }

  const paths = Array.from(pathMap.keys())
  const { data, error } = await admin
    .from('bot_visits')
    .select('bot_id, path, visited_at')
    .in('path', paths)
    .gte('visited_at', since)
  if (error) {
    console.error('[bot-stats] bot_visits 조회 실패:', error.message)
    return {
      periodDays: days, since, placeIds,
      aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
      aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
    }
  }

  const annotated: AnnotatedVisit[] = []
  for (const row of (data ?? []) as Array<{ bot_id: string; path: string; visited_at: string }>) {
    const info = pathMap.get(row.path)
    if (!info) continue
    annotated.push({ botId: row.bot_id, pageType: info.pageType, visitedAt: row.visited_at })
  }

  return aggregateOwnerBotSummary(annotated, placeIds, days, since)
}

/** Sprint D-2 용 — 최근 N건 AI 봇 방문 이력. ai-search/ai-training 그룹만. */
export async function listOwnerBotVisits(
  placeIds: string[],
  limit = 10,
  days = 30,
  now: Date = new Date(),
): Promise<OwnerBotVisit[]> {
  if (placeIds.length === 0) return []
  const pathMap = await fetchPathMap(placeIds)
  if (pathMap.size === 0) return []

  const admin = getAdminClient()
  if (!admin) return []

  const since = new Date(now.getTime() - days * 86_400_000).toISOString()
  const paths = Array.from(pathMap.keys())

  const { data } = await admin
    .from('bot_visits')
    .select('id, bot_id, path, visited_at')
    .in('path', paths)
    .gte('visited_at', since)
    .order('visited_at', { ascending: false })
    .limit(limit * 3)  // AI 그룹 필터링 후 limit 확보 위해 여유 조회

  const out: OwnerBotVisit[] = []
  for (const row of (data ?? []) as Array<{ id: number; bot_id: string; path: string; visited_at: string }>) {
    const group = ID_TO_GROUP.get(row.bot_id)
    if (group !== 'ai-search' && group !== 'ai-training') continue
    const info = pathMap.get(row.path)
    if (!info) continue
    out.push({
      id: row.id,
      botId: row.bot_id,
      botLabel: ID_TO_LABEL.get(row.bot_id) ?? row.bot_id,
      group,
      path: row.path,
      pageType: info.pageType,
      attribution: info.pageType === 'detail' ? 'direct' : 'mention',
      visitedAt: row.visited_at,
      placeIds: info.placeIds,
    })
    if (out.length >= limit) break
  }
  return out
}
