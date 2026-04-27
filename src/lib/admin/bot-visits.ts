// T-081 — bot_visits 집계.
// 확장: user_agent / status / referer 노출, 봇 그룹 요약, 경로별 Top, 일자별 추이.
//
// T-253 — Supabase 호스팅 PostgREST 의 db-max-rows=1000 server-side cap 회피.
//   - 단순 카운트: `count: 'exact', head: true` 로 SQL 카운트만 받아옴 (rows 0개 전송).
//   - 그룹/표 집계: 1,000건씩 페이지네이션 루프로 누적 (MAX_BOT_ROWS 까지).
//
// 운영 한계: 일평균 100건 × 365일 = 36K. MAX_BOT_ROWS 100K 면 향후 2~3년 충분.
// 이 이상 누적되면 server-side RPC 집계 함수로 이전 권장.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { AI_BOT_PATTERNS, type BotGroup } from '@/lib/seo/bot-detection'

const MAX_BOT_ROWS = 100_000
const PAGE_SIZE = 1_000

// Supabase chain 타입은 단계별로 다르고 추론이 어려워 unknown 으로 좁힘.
// 호출 사이트가 .gte()/.eq() 만 호출하므로 안전.
type AnyAdmin = { from: (table: string) => { select: (cols: string, opts?: unknown) => unknown } }
type ChainStep = (q: unknown) => unknown

/**
 * .range() 페이지네이션 루프. PostgREST 가 1페이지 1000개 cap 강제하므로 1000개씩 누적.
 * `applyFilters` 는 from('bot_visits').select(cols) 후 .gte/.eq 등을 적용하는 클로저.
 * 결과가 1000 미만이면 마지막 페이지로 판단하고 종료.
 *
 * 첫 페이지에서 error/null 이면 null 반환 — caller 가 "DB 미가용" 신호로 처리.
 * 정상 + 0행이면 빈 배열 반환.
 */
async function paginateBotVisits<T>(
  admin: unknown,
  selectCols: string,
  applyFilters: ChainStep,
): Promise<T[] | null> {
  const out: T[] = []
  for (let from = 0; from < MAX_BOT_ROWS; from += PAGE_SIZE) {
    const base = (admin as AnyAdmin).from('bot_visits').select(selectCols)
    const filtered = applyFilters(base) as { range: (a: number, b: number) => Promise<{ data: T[] | null; error: unknown }> }
    const { data, error } = await filtered.range(from, from + PAGE_SIZE - 1)
    if (from === 0 && (error || !data)) return null
    if (error || !data) break
    out.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return out
}

/**
 * 빠른 SQL 카운트 — head:true 라 row 전송 없이 `count` 메타만 반환.
 * rows.length 와 별개로 정확한 총합. 1000+ 도 정확.
 */
async function countBotVisits(admin: unknown, applyFilters: ChainStep): Promise<number> {
  const base = (admin as AnyAdmin).from('bot_visits').select('*', { count: 'exact', head: true })
  const filtered = applyFilters(base) as Promise<{ count: number | null; error: unknown }>
  const result = await filtered
  return result.count ?? 0
}

export interface BotVisitRow {
  id: number
  bot_id: string
  path: string
  city: string | null
  category: string | null
  place_slug: string | null
  visited_at: string
  status: number | null
  user_agent: string | null
  referer: string | null
}

export interface BotAggregate {
  botId: string
  visits: number
  lastVisitAt: string | null
}

export async function listRecentBotVisits(limit = 50): Promise<BotVisitRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const { data } = await admin
    .from('bot_visits')
    .select('id, bot_id, path, city, category, place_slug, visited_at, status, user_agent, referer')
    .order('visited_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as BotVisitRow[]
}

/**
 * T-233: 일별 봇 방문 합산 (홈 sparkline 차트용).
 * 반환: 오래된 → 최신 순 길이 N 의 visits 배열. 데이터 없는 날은 0.
 */
/**
 * T-253 — 홈/마케팅용 봇 합산: AI 봇 + 정규 검색 엔진(Googlebot/Bingbot/Naverbot).
 *
 * 포함: ai-training (GPTBot/ClaudeBot/...) + ai-search (Perplexity/OAI-Search) + search (Googlebot/Bingbot/Naverbot)
 * 제외: crawler-other (googleother — Google R&D 일회성 batch 가 합계를 왜곡함)
 *
 * 사유: Google AI Overviews / Bing Copilot 같은 AI 검색은 정규 검색 엔진의 크롤
 * 데이터를 활용하므로 Googlebot/Bingbot 도 마케팅 카피의 "AI 검색 인용" 신호에
 * 포함되는 게 자연스러움. googleother 만 일반 R&D 용도라 제외.
 */
const TRACKED_GROUPS: ReadonlySet<BotGroup> = new Set(['ai-training', 'ai-search', 'search'])
const TRACKED_BOT_IDS = new Set(
  AI_BOT_PATTERNS.filter(p => TRACKED_GROUPS.has(p.group)).map(p => p.id),
)

export interface AiBotSummary {
  totalVisits: number
  byBot: BotAggregate[]
  byDay: number[]
}

/**
 * 홈/마케팅용 30일 봇 요약. AI(ai-training + ai-search) + 정규 검색(search) 합산.
 * googleother(crawler-other) 만 제외. admin 운영 화면은 별도로 전체 통계 사용.
 */
export async function aggregateAiBotSummary(days = 30): Promise<AiBotSummary> {
  const admin = getAdminClient()
  if (!admin) return { totalVisits: 0, byBot: [], byDay: Array(days).fill(0) }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ bot_id: string; visited_at: string }>(
    admin,
    'bot_id, visited_at',
    q => (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
  )
  if (rows === null) return { totalVisits: 0, byBot: [], byDay: Array(days).fill(0) }

  const aiRows = rows.filter(r => TRACKED_BOT_IDS.has(r.bot_id))
  // per-bot 합산
  const byBotMap = new Map<string, { visits: number; lastVisitAt: string | null }>()
  for (const r of aiRows) {
    const e = byBotMap.get(r.bot_id) ?? { visits: 0, lastVisitAt: null }
    e.visits += 1
    if (!e.lastVisitAt || r.visited_at > e.lastVisitAt) e.lastVisitAt = r.visited_at
    byBotMap.set(r.bot_id, e)
  }
  const byBot = Array.from(byBotMap.entries())
    .map(([botId, v]) => ({ botId, visits: v.visits, lastVisitAt: v.lastVisitAt }))
    .sort((a, b) => b.visits - a.visits)

  // 일자별 합산
  const counts = new Map<string, number>()
  for (const r of aiRows) {
    const day = r.visited_at.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const byDay: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    byDay.push(counts.get(d) ?? 0)
  }

  return { totalVisits: aiRows.length, byBot, byDay }
}

export async function aggregateBotVisitsByDay(days = 14): Promise<number[]> {
  const admin = getAdminClient()
  if (!admin) return Array(days).fill(0)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ visited_at: string }>(admin, 'visited_at', q =>
    (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
  )
  if (rows === null) return Array(days).fill(0)
  if (rows.length === 0) return Array(days).fill(0)
  const counts = new Map<string, number>()
  for (const r of rows) {
    const day = r.visited_at.slice(0, 10)
    counts.set(day, (counts.get(day) ?? 0) + 1)
  }
  const result: number[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    result.push(counts.get(d) ?? 0)
  }
  return result
}

export async function aggregateBotVisits(days = 30): Promise<BotAggregate[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ bot_id: string; visited_at: string }>(
    admin,
    'bot_id, visited_at',
    q => (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
  )
  if (rows === null) return []
  const map = new Map<string, { visits: number; lastVisitAt: string | null }>()
  for (const r of rows) {
    const e = map.get(r.bot_id) ?? { visits: 0, lastVisitAt: null }
    e.visits += 1
    if (!e.lastVisitAt || r.visited_at > e.lastVisitAt) e.lastVisitAt = r.visited_at
    map.set(r.bot_id, e)
  }
  return Array.from(map.entries())
    .map(([botId, v]) => ({ botId, visits: v.visits, lastVisitAt: v.lastVisitAt }))
    .sort((a, b) => b.visits - a.visits)
}

export interface BotStatusAggregate {
  total: number
  status200: number
  status404: number
  statusOther: number
  rate404: number              // 0~1
}

export async function aggregateBotStatus(days = 30): Promise<BotStatusAggregate> {
  const admin = getAdminClient()
  if (!admin) return empty()
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  // 3 SQL 카운트 — 1000 cap 우회. head:true 라 row 0개 전송.
  const [total, s200, s404] = await Promise.all([
    countBotVisits(admin, q =>
      (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
    ),
    countBotVisits(admin, q => {
      const withGte = (q as unknown as { gte: (c: string, v: string) => { eq: (c: string, v: number) => unknown } }).gte('visited_at', since)
      return withGte.eq('status', 200)
    }),
    countBotVisits(admin, q => {
      const withGte = (q as unknown as { gte: (c: string, v: string) => { eq: (c: string, v: number) => unknown } }).gte('visited_at', since)
      return withGte.eq('status', 404)
    }),
  ])
  const other = Math.max(0, total - s200 - s404)
  return { total, status200: s200, status404: s404, statusOther: other, rate404: total === 0 ? 0 : s404 / total }
}

/** 404 를 가장 많이 맞은 경로 Top N. */
export async function topBot404Paths(days = 30, limit = 10): Promise<Array<{ path: string; count: number }>> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ path: string }>(admin, 'path', q => {
    const withEq = (q as unknown as { eq: (c: string, v: number) => { gte: (c: string, v: string) => unknown } }).eq('status', 404)
    return withEq.gte('visited_at', since)
  })
  if (!rows || rows.length === 0) return []
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.path, (counts.get(r.path) ?? 0) + 1)
  return Array.from(counts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** 전체 방문 중 가장 많이 크롤된 경로 Top N (200 OK 기준). */
export async function topCrawledPaths(days = 30, limit = 10): Promise<Array<{ path: string; count: number; bots: string[] }>> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ path: string; bot_id: string }>(admin, 'path, bot_id', q => {
    const withEq = (q as unknown as { eq: (c: string, v: number) => { gte: (c: string, v: string) => unknown } }).eq('status', 200)
    return withEq.gte('visited_at', since)
  })
  if (!rows || rows.length === 0) return []
  const map = new Map<string, { count: number; bots: Set<string> }>()
  for (const r of rows) {
    const e = map.get(r.path) ?? { count: 0, bots: new Set<string>() }
    e.count += 1
    e.bots.add(r.bot_id)
    map.set(r.path, e)
  }
  return Array.from(map.entries())
    .map(([path, v]) => ({ path, count: v.count, bots: Array.from(v.bots) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

/** 봇 그룹별 30일 합계 + 유니크 봇 수. */
export interface BotGroupSummary {
  group: BotGroup
  visits: number
  uniqueBots: number
  lastVisitAt: string | null
}

export async function aggregateByGroup(days = 30): Promise<BotGroupSummary[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ bot_id: string; visited_at: string }>(
    admin,
    'bot_id, visited_at',
    q => (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
  )
  if (rows === null) return []
  const idToGroup = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.group]))
  const groups: BotGroup[] = ['ai-training', 'ai-search', 'search', 'crawler-other']
  const map = new Map<BotGroup, { visits: number; bots: Set<string>; lastVisitAt: string | null }>()
  for (const g of groups) map.set(g, { visits: 0, bots: new Set<string>(), lastVisitAt: null })
  for (const r of rows) {
    const g = idToGroup.get(r.bot_id) ?? 'crawler-other'
    const e = map.get(g)!
    e.visits += 1
    e.bots.add(r.bot_id)
    if (!e.lastVisitAt || r.visited_at > e.lastVisitAt) e.lastVisitAt = r.visited_at
  }
  return groups.map((group) => {
    const e = map.get(group)!
    return { group, visits: e.visits, uniqueBots: e.bots.size, lastVisitAt: e.lastVisitAt }
  })
}

/** 일자별 방문 추이 (KST 기준 YYYY-MM-DD key). */
export interface DailyTrendRow {
  date: string          // YYYY-MM-DD
  total: number
  byGroup: Record<BotGroup, number>
}

export async function dailyVisitTrend(days = 14): Promise<DailyTrendRow[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const rows = await paginateBotVisits<{ bot_id: string; visited_at: string }>(
    admin,
    'bot_id, visited_at',
    q => (q as unknown as { gte: (c: string, v: string) => unknown }).gte('visited_at', since),
  )
  if (rows === null) return []
  const idToGroup = new Map(AI_BOT_PATTERNS.map((p) => [p.id, p.group]))

  const buckets = new Map<string, DailyTrendRow>()
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const key = toKstDateKey(d)
    buckets.set(key, {
      date: key,
      total: 0,
      byGroup: { 'ai-training': 0, 'ai-search': 0, 'search': 0, 'crawler-other': 0 },
    })
  }

  for (const r of rows) {
    const key = toKstDateKey(new Date(r.visited_at))
    const b = buckets.get(key)
    if (!b) continue
    const g = idToGroup.get(r.bot_id) ?? 'crawler-other'
    b.total += 1
    b.byGroup[g] += 1
  }
  return Array.from(buckets.values())
}

function toKstDateKey(d: Date): string {
  // KST = UTC+9, toLocaleDateString 에 Asia/Seoul 주면 정확
  const fmt = d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' })
  // ko-KR 포맷: "2026. 04. 22." → "2026-04-22"
  return fmt.replace(/\./g, '').trim().split(/\s+/).join('-')
}

function empty(): BotStatusAggregate {
  return { total: 0, status200: 0, status404: 0, statusOther: 0, rate404: 0 }
}
