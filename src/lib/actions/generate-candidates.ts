'use server'

// T-052 — 다중 후보 LLM 생성 서버 액션
// - generatePlaceContent 를 N회 병렬 호출하여 서로 다른 어조의 후보를 확보
// - 후보를 multi-candidates.ts 로 병합·랭킹 → 어드민이 카드 UI 로 큐레이션

import { generatePlaceContent, type ActionResult } from '@/lib/actions/register-place'
import {
  buildCandidatePool,
  type CandidatePool,
  type ContentCandidate,
  type RankContext,
} from '@/lib/ai/multi-candidates'

const DEFAULT_TONE_HINTS = [
  '전문 용어·장비명을 구체적으로 드러내는 정보형 어조',
  '생활 정보처럼 읽기 쉬운 친근한 어조',
  '수치·데이터(가격·시간·횟수)를 앞세우는 간결한 어조',
]

export interface GenerateCandidatesInput {
  name: string
  category: string
  address: string
  rating?: number
  reviewCount?: number
  reviews?: Array<{ text: string; rating: number }>
  openingHours?: string[]
  editorialSummary?: string
  placeId?: string
  naverSummary?: import('@/lib/ai/haiku-preprocess').NaverSummary
  // 어드민 재생성 피드백 (예: "좀 더 간결하게", "가격 강조")
  feedback?: string
  variantCount?: number
  // 어드민이 직접 어조를 지정한 경우 기본 3종 대신 이것을 사용
  toneHints?: string[]
}

export async function generateContentCandidates(
  input: GenerateCandidatesInput,
): Promise<ActionResult<{
  pool: CandidatePool
  qualityScores: number[]
  failureCount: number
}>> {
  const variantCount = Math.max(1, Math.min(5, input.variantCount ?? 3))
  const toneHints = (input.toneHints && input.toneHints.length > 0
    ? input.toneHints
    : DEFAULT_TONE_HINTS
  ).slice(0, variantCount)

  const baseInput = {
    name: input.name,
    category: input.category,
    address: input.address,
    rating: input.rating,
    reviewCount: input.reviewCount,
    reviews: input.reviews,
    openingHours: input.openingHours,
    editorialSummary: input.editorialSummary,
    placeId: input.placeId,
    naverSummary: input.naverSummary,
    feedback: input.feedback,
  }

  const results = await Promise.all(
    toneHints.map(toneHint => generatePlaceContent({ ...baseInput, toneHint })),
  )

  const successes = results.filter(r => r.success) as Array<Extract<typeof results[number], { success: true }>>
  const failures = results.length - successes.length

  if (successes.length === 0) {
    const firstFailure = results.find(r => !r.success) as Extract<typeof results[number], { success: false }> | undefined
    return { success: false, error: firstFailure?.error ?? '모든 후보 생성에 실패했습니다.' }
  }

  const candidates: ContentCandidate[] = successes.map(r => ({
    description: r.data.description,
    services: r.data.services,
    faqs: r.data.faqs,
    tags: r.data.tags,
  }))

  const cityLabel = input.address.split(' ').slice(0, 2).join(' ')
  const categoryKeyword = extractCategoryKeyword(input.category)

  const ctx: RankContext = {
    businessName: input.name,
    city: cityLabel,
    categoryKeyword,
  }

  const pool = buildCandidatePool(candidates, ctx, {
    descriptionTop: variantCount,
    serviceMax: 7,
    faqMax: 5,
    tagMax: 8,
  })

  return {
    success: true,
    data: {
      pool,
      qualityScores: successes.map(r => r.data.qualityScore),
      failureCount: failures,
    },
  }
}

function extractCategoryKeyword(category: string): string {
  // slug 에서 한글 키워드를 추출하려면 카테고리 테이블이 필요하지만
  // 호출 지점에서 이미 한글 이름을 전달하는 경우가 있다. slug 는 영문이므로 그대로 반환.
  return category
}
