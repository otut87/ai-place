// T-081 — bot_visits 집계 (lib/citations/aggregate.ts 와 동일 패턴).

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface BotVisitRow {
  id: number
  bot_id: string
  path: string
  city: string | null
  category: string | null
  place_slug: string | null
  visited_at: string
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
    .select('id, bot_id, path, city, category, place_slug, visited_at')
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

function empty(): BotStatusAggregate {
  return { total: 0, status200: 0, status404: 0, statusOther: 0, rate404: 0 }
}
