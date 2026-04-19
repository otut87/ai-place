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
