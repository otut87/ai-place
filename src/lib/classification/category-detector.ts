// 카테고리 자동 판별 — Tier 1/2/3 폴백 (T-015)
// Tier 1: Kakao category_name → 매핑 테이블
// Tier 2: Google types/primaryType → 매핑 테이블
// Tier 3: Haiku LLM 분류

import { mapKakaoCategory, mapGoogleTypes } from './category-map'
import { detectCategoryViaLLM } from './llm-detector'

export interface DetectionResult {
  category: string | null
  tier: 1 | 2 | 3 | null
  confidence: number
  needsReview: boolean
}

export interface DetectionInput {
  kakaoCategory: string | null | undefined
  googleTypes: readonly string[]
  name: string
  description?: string
  naverCategory?: string | null
  availableSlugs?: string[]
}

const REVIEW_THRESHOLD = 0.8

export async function detectCategory(input: DetectionInput): Promise<DetectionResult> {
  // Tier 1: Kakao
  if (input.kakaoCategory) {
    const slug = mapKakaoCategory(input.kakaoCategory)
    if (slug) {
      return { category: slug, tier: 1, confidence: 0.95, needsReview: false }
    }
  }

  // Tier 2: Google types
  if (input.googleTypes && input.googleTypes.length > 0) {
    const slug = mapGoogleTypes(input.googleTypes)
    if (slug) {
      return { category: slug, tier: 2, confidence: 0.9, needsReview: false }
    }
  }

  // Tier 3: LLM
  const llmResult = await detectCategoryViaLLM({
    name: input.name,
    description: input.description,
    categoryHints: [input.kakaoCategory, input.naverCategory, ...input.googleTypes].filter(
      (v): v is string => Boolean(v),
    ),
    availableSlugs: input.availableSlugs ?? [],
  })

  if (!llmResult) {
    return { category: null, tier: null, confidence: 0, needsReview: true }
  }

  return {
    category: llmResult.category,
    tier: 3,
    confidence: llmResult.confidence,
    needsReview: llmResult.confidence < REVIEW_THRESHOLD,
  }
}
