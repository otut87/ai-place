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
export interface OwnerDailyRow {
  date: string                     // YYYY-MM-DD (KST)
  place_id: string
  bot_id: string
  page_type: string
  visits: number
  last_visited_at: string | null
}

export interface OwnerTodayRow {
  place_id: string
  bot_id: string
  page_type: string
  visits: number                   // bigint → number coerce
  last_visited_at: string | null
}

/** T-269: dashboard-data 가 RPC 1회 호출 후 prop drill 하는 통합 fetch. */
export interface OwnerStatsRpcBundle {
  /** 어제까지 사전집계. null = DB 미가용. */
  snapshot: OwnerDailyRow[] | null
  /** 오늘 라이브 RPC. */
  todayRows: OwnerTodayRow[]
  /** 윈도우 시작/종료 ISO (resolveStatsPeriod 결과). */
  fromIso: string
  toIso: string
  days: number
  /** 윈도우 시작 KST date key (YYYY-MM-DD) — daily trend 버킷 초기화에 사용. */
  fromKey: string
  /** today KST date key — todayRows 가 누적되는 일자. */
  todayKey: string
}

// ── snapshot fetch (어제까지 사전집계) ─────────────────────────────────
// T-271: 054 RPC owner_bot_visits_daily_select 가 같은 supabase 인스턴스에서 raw SELECT 보다
// 3-5초 더 느림 (RPC dispatch 또는 PostgreSQL prepared plan 미스 의심). 4 places × 27 bots
// × 5 pageType × 30일 = max 16K rows 인데 sparse 라 실측 ~1-2K rows. PostgREST 1000-row
// cap 페이지네이션 1-2 round trip 으로 RPC 보다 명확히 빠름.
async function fetchOwnerDailySnapshot(
  placeIds: string[],
  fromDate: string,                // YYYY-MM-DD
  toDate: string,                  // YYYY-MM-DD (어제까지 inclusive)
): Promise<OwnerDailyRow[] | null> {
  const admin = getAdminClient()
  if (!admin) return null
  if (placeIds.length === 0) return []

  const PAGE = 1000
  const MAX = 50_000
  const out: OwnerDailyRow[] = []
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await admin
      .from('bot_visits_daily_owner')
      .select('date, place_id, bot_id, page_type, visits, last_visited_at')
      .in('place_id', placeIds)
      .gte('date', fromDate)
      .lte('date', toDate)
      .range(from, from + PAGE - 1)
    if (from === 0 && (error || !data)) {
      console.error('[bot-stats-daily] bot_visits_daily_owner select 실패:', error?.message)
      return null
    }
    if (error || !data) break
    out.push(...(data as OwnerDailyRow[]))
    if (data.length < PAGE) break
  }
  return out
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

// ── 통합 fetch (T-269: 중복 RPC 제거) ──────────────────────────────────
/**
 * 어제까지 snapshot + 오늘 라이브 RPC 를 1회씩만 호출. dashboard-data 가 이 결과를
 * getOwnerBotSummaryFromBundle / getOwnerDailyTrendFromBundle 두 함수에 prop drill 하면
 * 같은 RPC 가 중복으로 두 번 발사되는 문제 해결.
 *
 * placeIds 빈 배열이면 RPC 호출 없이 빈 bundle 반환.
 */
export async function fetchOwnerStatsBundle(
  placeIds: string[],
  period: StatsPeriodInput = 30,
  now: Date = new Date(),
): Promise<OwnerStatsRpcBundle> {
  const { fromIso, toIso, days } = resolveStatsPeriod(period, now)
  const todayKey = todayKstKey(now)
  const fromKey = dateKeyMinusDays(now, days - 1)
  const yesterdayKey = dateKeyMinusDays(now, 1)

  if (placeIds.length === 0) {
    return { snapshot: [], todayRows: [], fromIso, toIso, days, fromKey, todayKey }
  }

  const [snapshot, todayRows] = await Promise.all([
    fromKey <= yesterdayKey
      ? fetchOwnerDailySnapshot(placeIds, fromKey, yesterdayKey)
      : Promise.resolve([]),
    fetchOwnerToday(placeIds),
  ])

  return { snapshot, todayRows, fromIso, toIso, days, fromKey, todayKey }
}

export function getOwnerBotSummaryFromBundle(
  bundle: OwnerStatsRpcBundle,
  placeIds: string[],
): OwnerBotSummary {
  const empty = (): OwnerBotSummary => ({
    periodDays: bundle.days,
    since: bundle.fromIso,
    until: bundle.toIso,
    placeIds,
    aiSearch: emptyBucket(AI_SEARCH_ENGINE_KEYS),
    aiTraining: emptyBucket(AI_TRAINING_ENGINE_KEYS),
  })

  if (bundle.snapshot === null) {
    console.error('[bot-stats-daily] getOwnerBotSummaryFromBundle: snapshot 미가용')
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

  for (const r of bundle.snapshot) accumulate(r.bot_id, r.page_type, r.visits, r.last_visited_at)
  for (const r of bundle.todayRows) accumulate(r.bot_id, r.page_type, Number(r.visits), r.last_visited_at)

  return { periodDays: bundle.days, since: bundle.fromIso, until: bundle.toIso, placeIds, aiSearch, aiTraining }
}

export function getOwnerDailyTrendFromBundle(
  bundle: OwnerStatsRpcBundle,
): OwnerDailyTrendRow[] {
  // 일자 버킷 초기화 — fromKey..todayKey 모든 KST 일자.
  const buckets = new Map<string, OwnerDailyTrendRow>()
  let cursor = bundle.fromKey
  let guard = 400
  while (guard-- > 0) {
    if (!buckets.has(cursor)) buckets.set(cursor, makeEmptyTrendRow(cursor))
    if (cursor >= bundle.todayKey) break
    // YYYY-MM-DD 다음날
    const [y, m, d] = cursor.split('-').map((s) => parseInt(s, 10))
    const next = new Date(Date.UTC(y, m - 1, d + 1))
    cursor = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
  }

  if (bundle.snapshot === null) {
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

  for (const r of bundle.snapshot) accumulate(r.date, r.bot_id, r.visits)
  for (const r of bundle.todayRows) accumulate(bundle.todayKey, r.bot_id, Number(r.visits))

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date))
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
