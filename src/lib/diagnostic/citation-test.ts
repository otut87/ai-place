// T-140 — Owner AI 인용 실측 테스트 로직.
// 주 1회 제한 (업체 단위). 구독자 전용.
// 3개 엔진(ChatGPT/Claude/Gemini) × 3개 쿼리 = 9회 호출.

import { getAdminClient } from '@/lib/supabase/admin-client'

const MIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // 7일

export interface RateLimitCheck {
  allowed: boolean
  lastRunAt: string | null
  nextAllowedAt: string | null
  remainingHours: number
}

/** 업체의 마지막 테스트 시각을 조회해 주 1회 제한 적용 여부 판단. */
export async function checkCitationTestRateLimit(placeId: string): Promise<RateLimitCheck> {
  const admin = getAdminClient()
  if (!admin) return { allowed: false, lastRunAt: null, nextAllowedAt: null, remainingHours: 0 }

  const { data } = await admin
    .from('citation_tests')
    .select('started_at')
    .eq('place_id', placeId)
    .order('started_at', { ascending: false })
    .limit(1)

  const last = (data ?? [])[0] as { started_at: string } | undefined
  if (!last) return { allowed: true, lastRunAt: null, nextAllowedAt: null, remainingHours: 0 }

  const lastMs = new Date(last.started_at).getTime()
  const nextMs = lastMs + MIN_INTERVAL_MS
  const now = Date.now()
  if (now >= nextMs) {
    return { allowed: true, lastRunAt: last.started_at, nextAllowedAt: null, remainingHours: 0 }
  }
  return {
    allowed: false,
    lastRunAt: last.started_at,
    nextAllowedAt: new Date(nextMs).toISOString(),
    remainingHours: Math.ceil((nextMs - now) / (60 * 60 * 1000)),
  }
}

/** 업체의 활성 구독 여부 검증. */
export async function hasActiveSubscription(customerId: string | null): Promise<boolean> {
  if (!customerId) return false
  const admin = getAdminClient()
  if (!admin) return false
  const { data } = await admin
    .from('subscriptions')
    .select('id')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .limit(1)
  return Boolean(data && data.length > 0)
}

/** 쿼리 자동 생성 — 지역+업종 조합 3종. */
export function buildCitationQueries(cityName: string, categoryName: string): string[] {
  return [
    `${cityName} ${categoryName} 추천`,
    `${cityName}에서 좋은 ${categoryName} 어디야?`,
    `${cityName} ${categoryName} 어디가 잘해?`,
  ]
}
