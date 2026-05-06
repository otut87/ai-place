// Phase 1 / A2 (2026-05-06) — bot_visits 일별 사전집계 reader.
//
// /admin/seo 페이지가 1.17M rows 환경에서 5중 페이지네이션 → 5,875 round-trip 폭증.
// 일별 사전집계 (migration 051_bot_visits_daily.sql) + pg_cron 매일 KST 00:05 갱신으로
// 페이지는 어제까지 = bot_visits_daily select + 오늘 = bot_visits_today_summary RPC.
// 1.17M rows 위에서 페이지 로드 <100ms.
//
// 기존 src/lib/admin/bot-visits.ts 의 함수들을 본 모듈의 *Daily 버전으로 점진 교체.
// listRecentBotVisits 는 .order('visited_at desc').limit(50) 이라 빠르므로 그대로 둠.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { AI_BOT_PATTERNS, type BotGroup } from '@/lib/seo/bot-detection'
import type {
  BotAggregate,
  BotStatusAggregate,
  BotGroupSummary,
  DailyTrendRow,
} from '@/lib/admin/bot-visits'

// ── 공용 타입 ─────────────────────────────────────────────────────────
interface DailyRow {
  date: string                // YYYY-MM-DD (KST)
  bot_id: string
  bot_group: BotGroup
  status: number              // 200, 404, 0 (other/null)
  visits: number
  unique_paths: number
  last_visited_at: string | null
}

interface DailyPathRow {
  date: string
  path: string
  status: number
  bot_ids: string[]
  visits: number
}

interface TodayRow {
  bot_id: string
  bot_group: BotGroup
  status: number
  visits: number
  unique_paths: number
  last_visited_at: string | null
}

interface TodayPathRow {
  path: string
  status: number
  bot_ids: string[]
  visits: number
}

// ── 날짜 헬퍼 (KST) ───────────────────────────────────────────────────
function todayKstKey(now: Date = new Date()): string {
  return now.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .replace(/\./g, '')
    .trim()
    .split(/\s+/)
    .join('-')
}

function addDaysKst(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map((s) => Number(s))
  const t = new Date(Date.UTC(y, m - 1, d + delta))
  return t.toISOString().slice(0, 10)
}

/** [since, yesterday] inclusive — 어제까지 N 일치 집계 범위. */
function snapshotRange(days: number, now: Date = new Date()): { since: string; yesterday: string } {
  const today = todayKstKey(now)
  const yesterday = addDaysKst(today, -1)
  const since = addDaysKst(today, -days)  // today-(days-1) 부터 today-1 까지가 N일
  return { since, yesterday }
}

// ── 데이터 fetch (snapshot + today 병렬) ──────────────────────────────
async function fetchSnapshot(days: number, now: Date = new Date()): Promise<DailyRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { since, yesterday } = snapshotRange(days, now)
  const { data, error } = await admin
    .from('bot_visits_daily')
    .select('date, bot_id, bot_group, status, visits, unique_paths, last_visited_at')
    .gte('date', since)
    .lte('date', yesterday)
  if (error) {
    console.error('[bot-visits-daily] snapshot fetch 실패:', error.message)
    return []
  }
  return (data ?? []) as DailyRow[]
}

async function fetchSnapshotPaths(days: number, now: Date = new Date()): Promise<DailyPathRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { since, yesterday } = snapshotRange(days, now)
  const { data, error } = await admin
    .from('bot_visits_daily_paths')
    .select('date, path, status, bot_ids, visits')
    .gte('date', since)
    .lte('date', yesterday)
  if (error) {
    console.error('[bot-visits-daily] paths snapshot fetch 실패:', error.message)
    return []
  }
  return (data ?? []) as DailyPathRow[]
}

async function fetchTodaySummary(): Promise<TodayRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data, error } = await admin.rpc('bot_visits_today_summary')
  if (error) {
    console.error('[bot-visits-daily] today summary RPC 실패:', error.message)
    return []
  }
  // RPC 결과 visits 는 bigint 라 string 으로 직렬화될 수 있음 → number 로 변환
  return (data ?? []).map((r: { bot_id: string; bot_group: string; status: number; visits: number | string; unique_paths: number | string; last_visited_at: string | null }) => ({
    bot_id: r.bot_id,
    bot_group: r.bot_group as BotGroup,
    status: r.status,
    visits: Number(r.visits),
    unique_paths: Number(r.unique_paths),
    last_visited_at: r.last_visited_at,
  }))
}

async function fetchTodayPaths(limit = 100): Promise<TodayPathRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data, error } = await admin.rpc('bot_visits_today_top_paths', { p_limit: limit })
  if (error) {
    console.error('[bot-visits-daily] today paths RPC 실패:', error.message)
    return []
  }
  return (data ?? []).map((r: { path: string; status: number; bot_ids: string[]; visits: number | string }) => ({
    path: r.path,
    status: r.status,
    bot_ids: r.bot_ids,
    visits: Number(r.visits),
  }))
}

// ── 외부 API: 기존 함수와 동일 시그니처/리턴 ─────────────────────────────

const ID_TO_GROUP = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.group]))

/** aggregateBotVisits 의 daily 버전 — bot_id 단위 합계, lastVisitAt. */
export async function aggregateBotVisitsDaily(days = 30): Promise<BotAggregate[]> {
  const [snap, today] = await Promise.all([fetchSnapshot(days), fetchTodaySummary()])

  const map = new Map<string, { visits: number; lastVisitAt: string | null }>()
  for (const r of snap) {
    const e = map.get(r.bot_id) ?? { visits: 0, lastVisitAt: null }
    e.visits += r.visits
    if (r.last_visited_at && (!e.lastVisitAt || r.last_visited_at > e.lastVisitAt)) {
      e.lastVisitAt = r.last_visited_at
    }
    map.set(r.bot_id, e)
  }
  for (const r of today) {
    const e = map.get(r.bot_id) ?? { visits: 0, lastVisitAt: null }
    e.visits += r.visits
    if (r.last_visited_at && (!e.lastVisitAt || r.last_visited_at > e.lastVisitAt)) {
      e.lastVisitAt = r.last_visited_at
    }
    map.set(r.bot_id, e)
  }
  return Array.from(map.entries())
    .map(([botId, v]) => ({ botId, visits: v.visits, lastVisitAt: v.lastVisitAt }))
    .sort((a, b) => b.visits - a.visits)
}

/** aggregateBotStatus 의 daily 버전 — total / 200 / 404 / other. */
export async function aggregateBotStatusDaily(days = 30): Promise<BotStatusAggregate> {
  const [snap, today] = await Promise.all([fetchSnapshot(days), fetchTodaySummary()])

  let total = 0, s200 = 0, s404 = 0
  for (const r of [...snap, ...today]) {
    total += r.visits
    if (r.status === 200) s200 += r.visits
    else if (r.status === 404) s404 += r.visits
  }
  const other = Math.max(0, total - s200 - s404)
  return {
    total,
    status200: s200,
    status404: s404,
    statusOther: other,
    rate404: total === 0 ? 0 : s404 / total,
  }
}

/** aggregateByGroup 의 daily 버전 — bot group 단위 합계 + 유니크 봇 수. */
export async function aggregateByGroupDaily(days = 30): Promise<BotGroupSummary[]> {
  const [snap, today] = await Promise.all([fetchSnapshot(days), fetchTodaySummary()])

  const groups: BotGroup[] = ['ai-training', 'ai-search', 'search', 'crawler-other']
  const map = new Map<BotGroup, { visits: number; bots: Set<string>; lastVisitAt: string | null }>()
  for (const g of groups) map.set(g, { visits: 0, bots: new Set(), lastVisitAt: null })

  for (const r of [...snap, ...today]) {
    const g = (ID_TO_GROUP.get(r.bot_id) ?? r.bot_group ?? 'crawler-other') as BotGroup
    const e = map.get(g)!
    e.visits += r.visits
    e.bots.add(r.bot_id)
    if (r.last_visited_at && (!e.lastVisitAt || r.last_visited_at > e.lastVisitAt)) {
      e.lastVisitAt = r.last_visited_at
    }
  }
  return groups.map((group) => {
    const e = map.get(group)!
    return { group, visits: e.visits, uniqueBots: e.bots.size, lastVisitAt: e.lastVisitAt }
  })
}

/** topCrawledPaths 의 daily 버전 — status 200 만, top N 경로. */
export async function topCrawledPathsDaily(
  days = 30,
  limit = 10,
): Promise<Array<{ path: string; count: number; bots: string[] }>> {
  const [snapPaths, todayPaths] = await Promise.all([
    fetchSnapshotPaths(days),
    fetchTodayPaths(100),
  ])

  const map = new Map<string, { count: number; bots: Set<string> }>()
  for (const r of snapPaths) {
    if (r.status !== 200) continue
    const e = map.get(r.path) ?? { count: 0, bots: new Set() }
    e.count += r.visits
    for (const b of r.bot_ids) e.bots.add(b)
    map.set(r.path, e)
  }
  for (const r of todayPaths) {
    if (r.status !== 200) continue
    const e = map.get(r.path) ?? { count: 0, bots: new Set() }
    e.count += r.visits
    for (const b of r.bot_ids) e.bots.add(b)
    map.set(r.path, e)
  }
  return Array.from(map.entries())
    .map(([path, v]) => ({ path, count: v.count, bots: Array.from(v.bots) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** topBot404Paths 의 daily 버전 — status 404 만, top N 경로. */
export async function topBot404PathsDaily(
  days = 30,
  limit = 10,
): Promise<Array<{ path: string; count: number }>> {
  const [snapPaths, todayPaths] = await Promise.all([
    fetchSnapshotPaths(days),
    fetchTodayPaths(100),
  ])

  const map = new Map<string, number>()
  for (const r of snapPaths) {
    if (r.status !== 404) continue
    map.set(r.path, (map.get(r.path) ?? 0) + r.visits)
  }
  for (const r of todayPaths) {
    if (r.status !== 404) continue
    map.set(r.path, (map.get(r.path) ?? 0) + r.visits)
  }
  return Array.from(map.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** dailyVisitTrend 의 daily 버전 — 일자별 총합 + 그룹별 분해. */
export async function dailyVisitTrendDaily(days = 14): Promise<DailyTrendRow[]> {
  const [snap, today] = await Promise.all([fetchSnapshot(days), fetchTodaySummary()])

  // 일자 버킷 초기화 (오래된 → 최신)
  const buckets = new Map<string, DailyTrendRow>()
  const todayKey = todayKstKey()
  for (let i = days - 1; i >= 0; i--) {
    const key = addDaysKst(todayKey, -i)
    buckets.set(key, {
      date: key,
      total: 0,
      byGroup: { 'ai-training': 0, 'ai-search': 0, 'search': 0, 'crawler-other': 0 },
    })
  }

  // snapshot: 어제까지의 일자별 그룹별 집계
  for (const r of snap) {
    const b = buckets.get(r.date)
    if (!b) continue
    const g = (ID_TO_GROUP.get(r.bot_id) ?? r.bot_group ?? 'crawler-other') as BotGroup
    b.total += r.visits
    b.byGroup[g] = (b.byGroup[g] ?? 0) + r.visits
  }

  // today: 오늘 1일치 라이브 → 오늘 키 버킷에 누적
  const todayBucket = buckets.get(todayKey)
  if (todayBucket) {
    for (const r of today) {
      const g = (ID_TO_GROUP.get(r.bot_id) ?? r.bot_group ?? 'crawler-other') as BotGroup
      todayBucket.total += r.visits
      todayBucket.byGroup[g] = (todayBucket.byGroup[g] ?? 0) + r.visits
    }
  }

  return Array.from(buckets.values())
}

/** 최종 사전집계 시각 (cron 모니터링용). bot_visits_daily 에서 가장 최근 last_visited_at. */
export async function getLastAggregatedAt(): Promise<string | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('bot_visits_daily')
    .select('last_visited_at')
    .order('last_visited_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return (data as { last_visited_at: string | null }).last_visited_at
}
