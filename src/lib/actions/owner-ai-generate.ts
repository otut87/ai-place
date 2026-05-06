'use server'

// T-155·T-156·T-157 — Owner AI 자동 입력·수정 서버 액션.
// Rate limit(checkAiRateLimit) → generateOwnerDraft → 결과 반환.
//
// Phase 1 / B1 (2026-05-06) — 기존 per-place 5/월 + 주 1회 cooldown 은 placeId 있을 때만.
// 프리뷰 모드(placeId 미존재)는 무제한 LLM 호출 가능했음. 사용자 단위 분당 5회 (ai_generate)
// 를 모든 경로에 추가해 cost 폭증 방어.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import {
  checkAiRateLimit,
  generateOwnerDraft,
  type OwnerAiInput,
  type OwnerAiOutput,
  type RateLimitStatus,
} from '@/lib/ai/owner-generate'
import { checkRateLimit } from '@/lib/security/rate-limit'
import { getCities, getCategories } from '@/lib/data.supabase'

export interface AiGenerateActionInput {
  placeId?: string
  name: string
  city: string
  category: string
  websiteUrl?: string
  existingFields?: Partial<OwnerAiOutput>
  instruction?: string
}

export type AiGenerateOutcome =
  | { success: true; output: OwnerAiOutput; rateLimit: RateLimitStatus }
  | { success: false; error: string; rateLimit?: RateLimitStatus }

export async function ownerGenerateAiAction(input: AiGenerateActionInput): Promise<AiGenerateOutcome> {
  const user = await requireOwnerForAction()

  // Phase 1 / B1 — 사용자 단위 분당 5회 LLM 호출 한도. preview mode 도 포함.
  const rl = await checkRateLimit(user.id, 'ai_generate')
  if (!rl.success) {
    const seconds = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
    return { success: false, error: `요청이 너무 많습니다. ${seconds}초 후 다시 시도해 주세요.` }
  }

  // 소유권 검증 (placeId 있을 때만)
  if (input.placeId) {
    const admin = getAdminClient()
    if (!admin) return { success: false, error: 'admin_unavailable' }
    const { data: place } = await admin
      .from('places')
      .select('owner_id, customer_id')
      .eq('id', input.placeId)
      .maybeSingle()
    if (!place) return { success: false, error: '업체 없음' }
    const row = place as { owner_id: string | null; customer_id: string | null }
    if (row.owner_id && row.owner_id !== user.id) {
      return { success: false, error: '본인 업체가 아닙니다' }
    }
  }

  // Rate limit (placeId 있을 때만 — 프리뷰는 제한 없음)
  let rateLimit: RateLimitStatus | undefined
  if (input.placeId) {
    rateLimit = await checkAiRateLimit(input.placeId)
    if (!rateLimit.allowed) {
      const reasonMsg = rateLimit.reason === 'monthly'
        ? `이번 달 사용 한도(${rateLimit.monthlyLimit}회) 소진. 다음 달부터 가능합니다.`
        : `주간 재시도 제한 — ${rateLimit.remainingHours}시간 후 가능`
      return { success: false, error: reasonMsg, rateLimit }
    }
  }

  // 도시·업종 표시명 추출 (프롬프트 품질 향상)
  const [cities, categories] = await Promise.all([getCities(), getCategories()])
  const cityName = cities.find(c => c.slug === input.city)?.name
  const categoryName = categories.find(c => c.slug === input.category)?.name

  const aiInput: OwnerAiInput = {
    placeId: input.placeId,
    name: input.name,
    city: input.city,
    category: input.category,
    cityName,
    categoryName,
    websiteUrl: input.websiteUrl,
    existingFields: input.existingFields,
    instruction: input.instruction,
  }

  const result = await generateOwnerDraft(aiInput)
  if (!result.success) {
    return { success: false, error: result.error, rateLimit }
  }

  // 재조회 (방금 생성된 것 포함해 반영)
  if (input.placeId) {
    rateLimit = await checkAiRateLimit(input.placeId)
  }

  return {
    success: true,
    output: result.output,
    rateLimit: rateLimit ?? {
      allowed: true,
      monthlyUsed: 0,
      monthlyLimit: 5,
      nextAllowedAt: null,
      remainingHours: 0,
    },
  }
}
