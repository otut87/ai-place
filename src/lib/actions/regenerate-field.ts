'use server'

// T-075 — 단일 필드 재생성 서버 액션.
// generateContentCandidates (T-052) 를 호출해 첫 후보에서 요청 필드만 추출.
// 필드별 재생성이라 기존 DB 값은 건드리지 않고 결과만 반환 — 저장은 호출 측에서.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { generateContentCandidates } from '@/lib/actions/generate-candidates'
import type { Service, FAQ } from '@/lib/types'

export type RegenerateField = 'description' | 'services' | 'faqs' | 'tags'

export const REGENERATE_FIELDS: readonly RegenerateField[] = [
  'description', 'services', 'faqs', 'tags',
] as const

export function isRegenerateField(v: unknown): v is RegenerateField {
  return typeof v === 'string' && REGENERATE_FIELDS.includes(v as RegenerateField)
}

export interface RegenerateInput {
  placeId: string
  field: RegenerateField
  tone?: string                    // 어드민이 입력한 어조 힌트
  length?: 'short' | 'medium' | 'long'
  keywords?: string[]              // 강조 키워드
}

export interface RegenerateResult {
  success: boolean
  value?: string | string[] | Service[] | FAQ[]
  qualityScore?: number
  error?: string
}

export async function regenerateField({
  placeId,
  field,
  tone,
  length,
  keywords,
}: RegenerateInput): Promise<RegenerateResult> {
  await requireAuthForAction()
  if (!placeId) return { success: false, error: 'placeId 누락' }
  if (!isRegenerateField(field)) return { success: false, error: '허용되지 않은 필드' }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 생성에 필요한 최소 컨텍스트만 로드
  const { data, error } = await admin
    .from('places')
    .select('name, category, address, rating, review_count, opening_hours')
    .eq('id', placeId)
    .single()

  if (error || !data) return { success: false, error: '업체를 찾을 수 없습니다.' }

  const typed = data as {
    name: string
    category: string
    address: string
    rating: number | null
    review_count: number | null
    opening_hours: string[] | null
  }

  const feedback = buildFeedback({ field, tone, length, keywords })

  const result = await generateContentCandidates({
    name: typed.name,
    category: typed.category,
    address: typed.address,
    rating: typed.rating ?? undefined,
    reviewCount: typed.review_count ?? undefined,
    openingHours: typed.opening_hours ?? undefined,
    placeId,
    feedback,
    variantCount: 1,
  })

  if (!result.success) return { success: false, error: result.error }

  const pool = result.data.pool
  const qualityScore = result.data.qualityScores[0]

  switch (field) {
    case 'description': {
      const value = pool.descriptions[0]?.text
      if (!value) return { success: false, error: 'description 생성 실패' }
      return { success: true, value, qualityScore }
    }
    case 'services':
      return { success: true, value: pool.services.map(s => ({ name: s.name, description: s.description })), qualityScore }
    case 'faqs':
      return { success: true, value: pool.faqs.map(f => ({ question: f.question, answer: f.answer })), qualityScore }
    case 'tags':
      return { success: true, value: pool.tags, qualityScore }
  }
}

export function buildFeedback(opts: Pick<RegenerateInput, 'field' | 'tone' | 'length' | 'keywords'>): string {
  const bits: string[] = []
  if (opts.field === 'description') {
    if (opts.length === 'short') bits.push('description 을 2~3문장으로 짧게')
    else if (opts.length === 'long') bits.push('description 을 5문장 이상 상세히')
  }
  if (opts.tone) bits.push(`어조: ${opts.tone}`)
  if (opts.keywords && opts.keywords.length > 0) bits.push(`강조 키워드: ${opts.keywords.join(', ')}`)
  return bits.join(' · ')
}
