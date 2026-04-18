// T-061 — Topbar / 대시보드에서 사용하는 뱃지 카운트.
// admin 클라이언트 없는 환경(로컬/빌드 타임)에서도 0 으로 graceful fallback.

import { getAdminClient } from '@/lib/supabase/admin-client'

export async function getPendingReviewCount(): Promise<number> {
  const supabase = getAdminClient()
  if (!supabase) return 0
  const { count, error } = await supabase
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
  if (error) return 0
  return count ?? 0
}

export async function getBillingFailureCount(): Promise<number> {
  // T-073 에서 payments 테이블이 생기기 전 단계 — 항상 0.
  // PG 연동 후 failed + 재시도 남은 건수로 교체.
  return 0
}
