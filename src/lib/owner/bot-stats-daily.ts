// T-264 — owner-side 봇 통계 일별 사전집계 reader.
//
// 053 마이그레이션의 bot_visits_daily_owner 테이블 + bot_visits_today_owner RPC 를 합쳐서
// 어제까지 = SELECT (place_id IN + date 윈도우) + 오늘 = RPC 한 번. 결과를 기존
// OwnerBotSummary / OwnerDailyTrendRow 형식으로 반환해 dash UI 가 그대로 사용.
//
// 기존 src/lib/owner/bot-stats.ts 의 함수들은 paginatePlaceMentions × paginateBotVisitsByPath
// 5중 페이지네이션이라 1.17M rows 위에서 5+ 라운드트립. 본 모듈로 점진 교체.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { AI_BOT_PATTERNS, type BotGroup } from '@/lib/seo/bot-detection'
import {
  AI_SEARCH_ENGINE_KEYS, AI_TRAINING_ENGINE_KEYS,
  ID_TO_GROUP, mapBotToEngine,
  type AiSearchEngine, type AiTrainingEngine,
  type Attribution,
  type MentionType,
  type OwnerBotBucket, type OwnerBotSummary,
  type OwnerBotVisit,
  type OwnerDailyTrendRow,
  type StatsPeriodInput,
  resolveStatsPeriod,
} from '@/lib/owner/bot-stats'

const ID_TO_LABEL_LOCAL = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.label]))

// ── 공용 헬퍼 ─────────────────────────────────────────────────────────
function emptyBucket(engineKeys: readonly string[]): OwnerBotBucket {
  const byEngine: Record<string, number> = {}
  for (const k of engineKeys) byEngine[k] = 0
  return { total: 0, direct: 0, mention: 0, byEngine, lastVisitAt: null }
}

function emptyEngineMap<T extends string>(keys: readonly T[]): Record<T, number> {
  const out = {} as Record<T, number>
  for (const k of keys) out[k] = 0
  return out
}

function makeEmptyTrendRow(date: string): OwnerDailyTrendRow {
  return {
    date,
    aiSearch: emptyEngineMap(AI_SEARCH_ENGINE_KEYS),
    aiTraining: emptyEngineMap(AI_TRAINING_ENGINE_KEYS),
    total: 0,
  }
}

function toKstDateKey(iso: string): string {
  const d = new Date(iso)
  const fmt = d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.replace(/\./g, '').trim().split(/\s+/).join('-')
}

/** place_mentions.page_type='detail' 만 direct (업체 상세 페이지 방문). 나머지는 mention. */
function isDirect(pageType: string): boolean {
  return pageType === 'detail' || pageType === 'place'
}

// ── DB row 형식 ───────────────────────────────────────────────────────
interface OwnerDailyRow {
  date: string                     // YYYY-MM-DD (KST)
  place_id: string
  bot_id: string
  page_type: string
  visits: number
  last_visited_at: string | null
}

interface OwnerTodayRow {
  place_id: string
  bot_id: string
  page_type: string
  visits: number                   // bigint → number coerce
  last_visited_at: string | null
}

// ── snapshot fetch (어제까지 사전집계) — 054 RPC 로 페이지네이션 제거 ─────
// 기존 PostgREST .range() 페이지네이션은 1000-row cap 때문에 owner 의 daily_owner row 수만큼
// 라운드트립 (5 places × 27 bots × 5 pageType × 30일 = 20K rows → 21회). RPC 는 max_rows 영향
// 없어 한 번에 모든 row 반환.
async function fetchOwnerDailySnapshot(
  placeIds: string[],
  fromDate: string,                // YYYY-MM-DD
  toDate: string,                  // YYYY-MM-DD (어제까지 inclusive)
): Promise<OwnerDailyRow[] | null> {
  const admin = getAdminClient()
  if (!admin) return null
  if (placeIds.length === 0) return []

  const { data, error } = await admin.rpc('owner_bot_visits_daily_select', {
    p_place_ids: placeIds,
    p_from_date: fromDate,
    p_to_date: toDate,
  })
  if (error) {
    console.error('[bot-stats-daily] owner_bot_visits_daily_select RPC 실패:', error.message)
    return null
  }
  return (data ?? []) as OwnerDailyRow[]
}

async function fetchOwnerToday(placeIds: string[]): Promise<OwnerTodayRow[]> {
  const admin = getAdminClient()
  if (!admin || placeIds.length === 0) return []
  const { data, error } = await admin.rpc('bot_visits_today_owner', { p_place_ids: placeIds })
  if (error) {
    console.error('[bot-stats-daily] bot_visits_today_owner RPC 실패:', error.message)
    return []
  }
  return (data ?? []) as OwnerTodayRow[]
}

// ── KST 날짜 헬퍼 ─────────────────────────────────────────────────────
function todayKstKey(now: Date = new Date()): string {
  return toKstDateKey(now.toISOString())
}

function dateKeyMinusDays(now: Date, days: number): string {
  const d = new Date(now.getTime() - days * 86_400_000)
  return toKstDateKey(d.toISOString())
}

// ── Public API ────────────────────────────────────────────────────────
export async function getOwnerBotSummaryDaily(
  placeIds: string[],
  period: StatsPeriodInput = 30,
  now: Date = new Date(),
): Promise<OwnerBotSummary> {
  const { fromIso, toIso, days } = resolveStatsPeriod(period, now)
  const empty = (): OwnerBotSummary => ({
    periodDays: days,
    since: fromIso,
    until: toIso,
    placeIds,
    aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
    aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
  })

  if (placeIds.length === 0) return empty()

  // 어제까지 SELECT + 오늘 RPC. 두 결과를 같은 bucket 에 누적.
  const todayKey = todayKstKey(now)
  const fromKey = dateKeyMinusDays(now, days - 1)   // 30일 윈도우 = today 포함 30일자
  const yesterdayKey = dateKeyMinusDays(now, 1)

  const [snapshot, todayRows] = await Promise.all([
    fromKey <= yesterdayKey
      ? fetchOwnerDailySnapshot(placeIds, fromKey, yesterdayKey)
      : Promise.resolve([]),
    fetchOwnerToday(placeIds),
  ])

  if (snapshot === null) {
    console.error('[bot-stats-daily] getOwnerBotSummaryDaily: snapshot 조회 실패 (DB 미가용)')
    return empty()
  }

  const aiSearch = emptyBucket(AI_SEARCH_ENGINE_KEYS)
  const aiTraining = emptyBucket(AI_TRAINING_ENGINE_KEYS)

  function accumulate(botId: string, pageType: string, visits: number, lastVisitedAt: string | null) {
    const group = ID_TO_GROUP.get(botId)
    if (group !== 'ai-search' && group !== 'ai-training') return

    const bucket = group === 'ai-search' ? aiSearch : aiTraining
    const engine = mapBotToEngine(botId, group)

    bucket.total += visits
    if (isDirect(pageType)) bucket.direct += visits
    else bucket.mention += visits
    bucket.byEngine[engine] = (bucket.byEngine[engine] ?? 0) + visits

    if (lastVisitedAt && (!bucket.lastVisitAt || lastVisitedAt > bucket.lastVisitAt)) {
      bucket.lastVisitAt = lastVisitedAt
    }
  }

  for (const r of snapshot) accumulate(r.bot_id, r.page_type, r.visits, r.last_visited_at)
  for (const r of todayRows) accumulate(r.bot_id, r.page_type, Number(r.visits), r.last_visited_at)

  // todayKey 도 윈도우 안인지 검증 — 1 일 윈도우라면 fromKey === todayKey 라 snapshot 비어있고
  // todayRows 만 누적. fromKey > todayKey 는 발생 안 함.
  void todayKey

  return { periodDays: days, since: fromIso, until: toIso, placeIds, aiSearch, aiTraining }
}

export async function getOwnerDailyTrendDaily(
  placeIds: string[],
  period: StatsPeriodInput = 30,
  now: Date = new Date(),
): Promise<OwnerDailyTrendRow[]> {
  const { days } = resolveStatsPeriod(period, now)

  // 일자 버킷 초기화 — [today - (days-1), ..., today].
  const buckets = new Map<string, OwnerDailyTrendRow>()
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86_400_000)
    const key = toKstDateKey(d.toISOString())
    if (!buckets.has(key)) buckets.set(key, makeEmptyTrendRow(key))
  }

  if (placeIds.length === 0) {
    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  const todayKey = todayKstKey(now)
  const fromKey = dateKeyMinusDays(now, days - 1)
  const yesterdayKey = dateKeyMinusDays(now, 1)

  const [snapshot, todayRows] = await Promise.all([
    fromKey <= yesterdayKey
      ? fetchOwnerDailySnapshot(placeIds, fromKey, yesterdayKey)
      : Promise.resolve([]),
    fetchOwnerToday(placeIds),
  ])

  if (snapshot === null) {
    console.error('[bot-stats-daily] getOwnerDailyTrendDaily: snapshot 조회 실패 (DB 미가용)')
    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  function accumulate(date: string, botId: string, visits: number) {
    const group = ID_TO_GROUP.get(botId)
    if (group !== 'ai-search' && group !== 'ai-training') return
    const bucket = buckets.get(date)
    if (!bucket) return
    const engine = mapBotToEngine(botId, group)
    if (group === 'ai-search') {
      bucket.aiSearch[engine as AiSearchEngine] = (bucket.aiSearch[engine as AiSearchEngine] ?? 0) + visits
    } else {
      bucket.aiTraining[engine as AiTrainingEngine] = (bucket.aiTraining[engine as AiTrainingEngine] ?? 0) + visits
    }
    bucket.total += visits
  }

  for (const r of snapshot) accumulate(r.date, r.bot_id, r.visits)
  for (const r of todayRows) accumulate(todayKey, r.bot_id, Number(r.visits))

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
}

// ── 최근 N건 봇 방문 (RPC 기반 — paths IN 큰 배열 회피) ───────────────
/**
 * T-265: 054 RPC `owner_recent_bot_visits` 로 server-side INNER JOIN. 기존
 * lib/owner/bot-stats.ts:listOwnerBotVisits 는 paths IN (수천) 으로 raw 1.17M 위에서
 * bot_visits.path 인덱스 부재 → 수만 row 스캔. RPC 는 (path, visited_at) composite
 * 인덱스 활용 + 큰 IN 배열 SQL 전송 비용 회피.
 */
interface RecentVisitRpcRow {
  id: number
  bot_id: string
  path: string
  visited_at: string
  page_type: string
  place_id: string
}

export async function listOwnerBotVisitsDaily(
  placeIds: string[],
  limit = 10,
  period: StatsPeriodInput = 30,
  now: Date = new Date(),
): Promise<OwnerBotVisit[]> {
  if (placeIds.length === 0) return []
  const admin = getAdminClient()
  if (!admin) return []

  const { fromIso, toIso } = resolveStatsPeriod(period, now)

  const { data, error } = await admin.rpc('owner_recent_bot_visits', {
    p_place_ids: placeIds,
    p_limit: limit * 3,             // AI 그룹 필터링 여유분.
    p_from: fromIso,
    p_to: toIso,
  })
  if (error) {
    console.error('[bot-stats-daily] owner_recent_bot_visits RPC 실패:', error.message)
    return []
  }

  // RPC 가 한 path → N place 매핑 시 row fan-out → id 로 dedup + path 별 placeIds 병합.
  const placesByPath = new Map<string, string[]>()
  const pageTypeByPath = new Map<string, string>()
  for (const row of (data ?? []) as RecentVisitRpcRow[]) {
    const arr = placesByPath.get(row.path) ?? []
    if (!arr.includes(row.place_id)) arr.push(row.place_id)
    placesByPath.set(row.path, arr)
    pageTypeByPath.set(row.path, row.page_type)
  }

  const out: OwnerBotVisit[] = []
  const seenIds = new Set<number>()
  for (const row of (data ?? []) as RecentVisitRpcRow[]) {
    if (seenIds.has(row.id)) continue
    seenIds.add(row.id)
    const group: BotGroup | undefined = ID_TO_GROUP.get(row.bot_id)
    if (group !== 'ai-search' && group !== 'ai-training') continue

    const dbType = pageTypeByPath.get(row.path) ?? 'place'
    // DB enum: 'detail' (places.status='active' fan-out) | 'place' (legacy) | 'blog' | 'compare' | 'guide' | 'keyword'.
    // OwnerBotVisit.pageType 은 'place' | 'blog' | 'compare' | 'guide' | 'keyword' — 'detail' 는 'place' 와 의미 동일.
    const pageType: MentionType = dbType === 'detail' ? 'place' : (dbType as MentionType)
    const attribution: Attribution = pageType === 'place' ? 'direct' : 'mention'

    out.push({
      id: row.id,
      botId: row.bot_id,
      botLabel: ID_TO_LABEL_LOCAL.get(row.bot_id) ?? row.bot_id,
      group,
      path: row.path,
      pageType,
      attribution,
      visitedAt: row.visited_at,
      placeIds: placesByPath.get(row.path) ?? [],
    })
    if (out.length >= limit) break
  }
  return out
}
