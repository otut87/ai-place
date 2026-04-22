// T-081 — bot_visits 집계.
// 확장: user_agent / status / referer 노출, 봇 그룹 요약, 경로별 Top, 일자별 추이.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { AI_BOT_PATTERNS, type BotGroup } from '@/lib/seo/bot-detection'

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

export async function aggregateBotVisits(days = 30): Promise<BotAggregate[]> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('bot_visits')
    .select('bot_id, visited_at')
    .gte('visited_at', since)
  if (!data) return []
  const rows = data as Array<{ bot_id: string; visited_at: string }>
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
  const { data } = await admin
    .from('bot_visits')
    .select('status')
    .gte('visited_at', since)
  if (!data) return empty()
  const rows = data as Array<{ status: number | null }>
  const total = rows.length
  const s200 = rows.filter(r => r.status === 200).length
  const s404 = rows.filter(r => r.status === 404).length
  const other = total - s200 - s404
  return { total, status200: s200, status404: s404, statusOther: other, rate404: total === 0 ? 0 : s404 / total }
}

/** 404 를 가장 많이 맞은 경로 Top N. */
export async function topBot404Paths(days = 30, limit = 10): Promise<Array<{ path: string; count: number }>> {
  const admin = getAdminClient()
  if (!admin) return []
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('bot_visits')
    .select('path')
    .eq('status', 404)
    .gte('visited_at', since)
  if (!data) return []
  const rows = data as Array<{ path: string }>
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
  const { data } = await admin
    .from('bot_visits')
    .select('path, bot_id')
    .eq('status', 200)
    .gte('visited_at', since)
  if (!data) return []
  const rows = data as Array<{ path: string; bot_id: string }>
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
  const { data } = await admin
    .from('bot_visits')
    .select('bot_id, visited_at')
    .gte('visited_at', since)
  if (!data) return []
  const rows = data as Array<{ bot_id: string; visited_at: string }>
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
  const { data } = await admin
    .from('bot_visits')
    .select('bot_id, visited_at')
    .gte('visited_at', since)
  if (!data) return []
  const rows = data as Array<{ bot_id: string; visited_at: string }>
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
