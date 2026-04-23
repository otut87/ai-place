'use server'

// T-218 — AI 자동 채우기 quota 조회 전용 액션.
// 편집 페이지 mount 시 현재 남은 회수를 sec-nav 버튼에 표시.
// 실제 generate 없이 rate-limit 상태만 반환 → 비용 0.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { checkAiRateLimit, type RateLimitStatus } from '@/lib/ai/owner-generate'

export async function getOwnerAiQuota(placeId: string): Promise<RateLimitStatus | null> {
  const user = await requireOwnerForAction()
  const admin = getAdminClient()
  if (!admin) return null

  // 소유권 확인
  const { data: place } = await admin
    .from('places')
    .select('owner_id')
    .eq('id', placeId)
    .maybeSingle()
  const row = place as { owner_id: string | null } | null
  if (!row || (row.owner_id && row.owner_id !== user.id)) return null

  return checkAiRateLimit(placeId)
}
