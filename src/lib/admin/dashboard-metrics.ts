// T-064 — 대시보드 상단 지표 집계.
// T-087 — MRR·결제 실패·만료 임박·404·신규 블로그 발행 + 해지 예정 증분.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { listExpiringCards } from '@/lib/admin/billing-queries'

export interface DashboardMetrics {
  pendingPlaces: number
  activePlaces: number
  rejectedPlaces: number
  publishedToday: number                // 오늘 status='active' 된 블로그 수
  pipelineFailures: number              // pipeline_jobs status='failed'
  billingFailures: number               // payments status='failed' (최근 7일)
  billingExpiringSoon: number           // billing_keys 만료 30일 이내
  mrrKrw: number                        // subscriptions.status='active' amount 합
  botVisits7d: number                   // 최근 7일 bot_visits 총합
  bot404Rate7d: number                  // 최근 7일 404 비율 (0~1)
  pendingCancellationsThisMonth: number // 이번달 해지 예정
}

export interface RecentAuditEntry {
  id: string
  actor_type: string
  action: string
  field: string | null
  place_id: string | null
  created_at: string
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const supabase = getAdminClient()
  if (!supabase) return emptyMetrics()

  const now = new Date()
  const todayIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thisMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()

  const [pending, active, rejected, blogToday, pipeFail, payFail, activeSubs, bots, cancels] = await Promise.all([
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
    supabase.from('blog_posts').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('published_at', todayIso),
    supabase.from('pipeline_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('attempted_at', sevenDaysAgoIso),
    supabase.from('subscriptions').select('amount').eq('status', 'active'),
    supabase.from('bot_visits').select('status').gte('visited_at', sevenDaysAgoIso),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).not('canceled_at', 'is', null).lt('canceled_at', thisMonthEnd).gte('canceled_at', todayIso),
  ])

  const mrrKrw = ((activeSubs.data ?? []) as Array<{ amount: number | null }>)
    .reduce((sum, s) => sum + (s.amount ?? 0), 0)

  const botRows = (bots.data ?? []) as Array<{ status: number | null }>
  const botVisits7d = botRows.length
  const bot404s = botRows.filter(r => r.status === 404).length
  const bot404Rate7d = botVisits7d === 0 ? 0 : bot404s / botVisits7d

  // 만료 임박 (30일 이내) — 전용 쿼리 재사용
  const expiringCards = await listExpiringCards(30)

  return {
    pendingPlaces: pending.count ?? 0,
    activePlaces: active.count ?? 0,
    rejectedPlaces: rejected.count ?? 0,
    publishedToday: blogToday.count ?? 0,
    pipelineFailures: pipeFail.count ?? 0,
    billingFailures: payFail.count ?? 0,
    billingExpiringSoon: expiringCards.length,
    mrrKrw,
    botVisits7d,
    bot404Rate7d,
    pendingCancellationsThisMonth: cancels.count ?? 0,
  }
}

export async function getRecentActivity(limit = 10): Promise<RecentAuditEntry[]> {
  const supabase = getAdminClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('place_audit_log')
    .select('id, actor_type, action, field, place_id, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data as unknown as RecentAuditEntry[]
}

function emptyMetrics(): DashboardMetrics {
  return {
    pendingPlaces: 0,
    activePlaces: 0,
    rejectedPlaces: 0,
    publishedToday: 0,
    pipelineFailures: 0,
    billingFailures: 0,
    billingExpiringSoon: 0,
    mrrKrw: 0,
    botVisits7d: 0,
    bot404Rate7d: 0,
    pendingCancellationsThisMonth: 0,
  }
}

export function dashboardIssuesCount(m: DashboardMetrics): number {
  return m.pendingPlaces + m.pipelineFailures + m.billingFailures + m.billingExpiringSoon + m.pendingCancellationsThisMonth
}
