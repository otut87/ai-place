// T-064 — 대시보드 상단 지표 집계.
// notify / billing / pipelines 등 아직 테이블이 없는 영역은 0 반환으로 graceful fallback.

import { getAdminClient } from '@/lib/supabase/admin-client'

export interface DashboardMetrics {
  pendingPlaces: number
  activePlaces: number
  rejectedPlaces: number
  publishedToday: number          // T-078 블로그 발행 예정/오늘. 현재는 0.
  pipelineFailures: number        // T-076 이후 실제 집계.
  billingFailures: number         // T-073 이후 실제 집계.
  billingExpiringSoon: number     // T-074 이후 실제 집계.
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
  if (!supabase) {
    return emptyMetrics()
  }

  // places 상태 집계 — 3개 쿼리 병렬 + head:true (row 안 가져옴)
  const [pending, active, rejected] = await Promise.all([
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('places').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
  ])

  return {
    pendingPlaces: pending.count ?? 0,
    activePlaces: active.count ?? 0,
    rejectedPlaces: rejected.count ?? 0,
    publishedToday: 0,
    pipelineFailures: 0,
    billingFailures: 0,
    billingExpiringSoon: 0,
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
  }
}

export function dashboardIssuesCount(m: DashboardMetrics): number {
  return m.pendingPlaces + m.pipelineFailures + m.billingFailures + m.billingExpiringSoon
}
