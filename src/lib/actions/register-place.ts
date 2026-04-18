'use server'

// 업체 등록 Server Action
// Step 1: 업체명 + 도시/카테고리로 Google Places 검색
// Step 2: 검색 결과에서 선택 → 자동 보강 (주소, 전화, 평점, 리뷰)
// Step 3: 서비스/FAQ/설명 입력 → DB 저장 (status: pending)

import type { z as zType } from 'zod'
import { requireAuth } from '@/lib/auth'
import { searchPlaceByText, getPlaceDetails } from '@/lib/google-places'
import type { PlaceSearchResult } from '@/lib/google-places'
import { searchKakaoPlace } from '@/lib/naver-kakao-search'
import { createServerClient } from '@/lib/supabase/server'

export interface RegisterPlaceInput {
  // Step 1: 기본 정보
  city: string
  category: string
  // Step 2: 3-Source 매칭 결과 — Google/Kakao/Naver 중 하나 이상 필수
  // (또는 manual 플래그로 수동 등록 허용)
  googlePlaceId?: string
  kakaoPlaceId?: string
  naverPlaceId?: string
  manual?: boolean          // Daum Postcode 수동 등록 시 true
  name: string
  nameEn?: string
  slug: string
  description: string   // 40~60자 Direct Answer Block
  // Step 3: 자동 보강 + 수동 입력
  address: string
  phone?: string
  openingHours?: string[]
  rating?: number
  reviewCount?: number
  googleBusinessUrl?: string
  naverPlaceUrl?: string
  kakaoMapUrl?: string
  latitude?: number
  longitude?: number
  // 3-Source / Daum Postcode (T-019/T-020)
  roadAddress?: string
  jibunAddress?: string
  sigunguCode?: string
  zonecode?: string
  services: Array<{ name: string; description?: string; priceRange?: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

/** Step 1: 업체명으로 Google Places 검색 */
export async function searchPlace(query: string, city: string): Promise<ActionResult<PlaceSearchResult[]>> {
  await requireAuth()

  const results = await searchPlaceByText(`${query} ${city}`)
  if (!results) {
    return { success: false, error: 'Google Places 검색에 실패했습니다.' }
  }

  return { success: true, data: results }
}

/**
 * 3-Source 통합 검색 — Kakao + Google + Naver 병렬 + Dedup/Merge + 카테고리/도시 자동 추정.
 * 각 후보에 detectedCategory/detectedCity 가 동봉되어 UI 가 바로 채울 수 있음.
 * (T-018)
 */
export async function searchPlaceUnified(
  query: string,
): Promise<ActionResult<Array<{
  kakaoPlaceId?: string
  googlePlaceId?: string
  naverLink?: string
  displayName: string
  roadAddress?: string | null
  jibunAddress?: string | null
  latitude: number
  longitude: number
  phone?: string | null
  rating?: number
  reviewCount?: number
  sources: string[]
  sameAs: string[]
  kakaoCategory?: string
  naverCategory?: string
  detectedCategorySlug: string | null
  detectedCategoryTier: number | null
  detectedCategoryConfidence: number
  detectedCitySlug: string | null
}>>> {
  await requireAuth()

  const { unifiedSearch } = await import('@/lib/search/unified')
  const { detectCategory } = await import('@/lib/classification/category-detector')
  const { cityFromAddress } = await import('@/lib/address/sigungu-to-city')
  const { getCategories } = await import('@/lib/data')

  const candidates = await unifiedSearch(query)
  if (candidates.length === 0) return { success: true, data: [] }

  const allCategories = await getCategories()
  const availableSlugs = allCategories.map(c => c.slug)

  // 카테고리 자동 판별 (병렬) — Tier 1/2 는 즉시 반환, Tier 3 만 LLM 호출
  const enriched = await Promise.all(
    candidates.map(async c => {
      const detection = await detectCategory({
        kakaoCategory: c.kakaoCategory,
        googleTypes: [],
        name: c.displayName,
        naverCategory: c.naverCategory,
        availableSlugs,
      })
      const addressForCity = c.roadAddress ?? c.jibunAddress
      return {
        ...c,
        detectedCategorySlug: detection.category,
        detectedCategoryTier: detection.tier,
        detectedCategoryConfidence: detection.confidence,
        detectedCitySlug: cityFromAddress(addressForCity),
      }
    }),
  )

  return { success: true, data: enriched }
}

/** Step 2: Place ID로 상세 정보 가져오기 (자동 보강) — Google + 네이버 + 카카오 병렬 조회 */
export async function enrichPlace(placeId: string, placeName?: string): Promise<ActionResult<{
  name: string
  nameEn?: string
  rating: number
  reviewCount: number
  phone?: string
  websiteUri?: string
  openingHours?: string[]
  editorialSummary?: string
  googleMapsUri?: string
  kakaoMapUrl?: string
  reviews?: Array<{ text: string; rating: number }>
}>> {
  await requireAuth()

  // Google + 카카오 병렬 조회 (네이버는 고유 URL API 미제공)
  const [details, kakao] = await Promise.all([
    getPlaceDetails(placeId),
    placeName ? searchKakaoPlace(placeName) : Promise.resolve(null),
  ])

  if (!details) {
    return { success: false, error: 'Google Places 상세 정보를 가져올 수 없습니다.' }
  }

  return {
    success: true,
    data: {
      name: details.name,
      nameEn: details.nameEn,
      rating: details.rating,
      reviewCount: details.reviewCount,
      phone: details.phone,
      websiteUri: details.websiteUri,
      openingHours: details.openingHours,
      editorialSummary: details.editorialSummary,
      googleMapsUri: details.googleMapsUri,
      kakaoMapUrl: kakao?.placeUrl || undefined,
      reviews: details.reviews.slice(0, 5).map(r => ({ text: r.text, rating: r.rating })),
    },
  }
}

// === Tool-Use schemas (T-025) ===
const CONTENT_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    description: {
      type: 'string',
      minLength: 40,
      maxLength: 60,
      description: '40~60자 한국어. 형식 "{지역} 위치. {구체적 전문분야·장비·인력} 전문."',
    },
    services: {
      type: 'array',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 40 },
          description: { type: 'string', maxLength: 160 },
          priceRange: { type: 'string', maxLength: 30, description: '예: "5~12만원", "상담 필요"' },
        },
        required: ['name', 'description', 'priceRange'],
      },
    },
    faqs: {
      type: 'array',
      minItems: 5,
      maxItems: 7,
      items: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            maxLength: 100,
            description: '업체명을 포함하고 "?" 로 끝나는 한국어 질문.',
          },
          answer: { type: 'string', maxLength: 300 },
        },
        required: ['question', 'answer'],
      },
    },
    tags: {
      type: 'array',
      minItems: 5,
      maxItems: 8,
      items: { type: 'string', maxLength: 30 },
    },
  },
  required: ['description', 'services', 'faqs', 'tags'],
}

const CONTENT_TOOL_NAME = 'register_business_content'

/** Step 2.5: LLM으로 설명/서비스/FAQ/태그 자동 생성 (T-024~T-027)
 * - Sonnet 4.6 메인 모델 + Tool Use 구조화 출력
 * - Few-Shot Exemplar 주입
 * - 네이버 블로그·카페 Haiku 요약 컨텍스트 (선택)
 * - 품질 스코어 < 70 → 최대 2회 재생성
 * - 호출별 텔레메트리 기록
 */
export async function generatePlaceContent(input: {
  name: string
  category: string
  address: string
  rating?: number
  reviewCount?: number
  reviews?: Array<{ text: string; rating: number }>
  openingHours?: string[]
  editorialSummary?: string
  placeId?: string          // 텔레메트리용 (DB insert 전이면 null)
  naverSummary?: import('@/lib/ai/haiku-preprocess').NaverSummary
  // T-052: 후보별 차별화. 다중 후보 생성 시 각 호출에 서로 다른 toneHint 전달.
  toneHint?: string           // 예: "친근한 어조로", "전문 용어 중심으로"
  feedback?: string           // 어드민 재생성 피드백: "좀 더 간결하게"
}): Promise<ActionResult<{
  description: string
  services: Array<{ name: string; description: string; priceRange: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
  qualityScore: number
}>> {
  await requireAuth()

  const { z } = await import('zod')
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const { getCategories: getCats } = await import('@/lib/data')
  const { getExemplars, buildExemplarBlock } = await import('@/lib/ai/exemplars')
  const { scoreQuality, QUALITY_SCORE_THRESHOLD } = await import('@/lib/ai/quality-score')
  const { logAIGeneration } = await import('@/lib/ai/telemetry')

  const ContentSchema = z.object({
    description: z.string(),
    services: z.array(z.object({
      name: z.string(),
      description: z.string(),
      priceRange: z.string(),
    })),
    faqs: z.array(z.object({ question: z.string(), answer: z.string() })),
    tags: z.array(z.string()),
  })

  const client = new Anthropic()
  const allCats = await getCats()
  const catName = allCats.find(c => c.slug === input.category)?.name ?? input.category
  const cityLabel = input.address.split(' ').slice(0, 2).join(' ')

  const parts: string[] = []
  if (input.rating) parts.push(`Rating: ${input.rating}점 (${input.reviewCount ?? 0}건)`)
  if (input.editorialSummary) parts.push(`Google 소개: ${input.editorialSummary}`)
  if (input.openingHours && input.openingHours.length > 0) parts.push(`영업시간:\n${input.openingHours.join('\n')}`)
  if (input.reviews && input.reviews.length > 0) {
    parts.push(`Google 리뷰 (출처로 활용 가능):\n${input.reviews.map(r => `- [${r.rating}점] ${r.text}`).join('\n')}`)
  }
  if (input.naverSummary) {
    const s = input.naverSummary
    const lines: string[] = []
    if (s.commonTreatments.length > 0) lines.push(`반복 시술: ${s.commonTreatments.join(', ')}`)
    if (s.priceSignals) lines.push(`가격 신호: ${s.priceSignals}`)
    if (s.positiveThemes.length > 0) lines.push(`긍정 테마: ${s.positiveThemes.join(', ')}`)
    if (s.negativeThemes.length > 0) lines.push(`부정 테마: ${s.negativeThemes.join(', ')}`)
    if (s.uniqueFeatures.length > 0) lines.push(`고유 특징: ${s.uniqueFeatures.join(', ')}`)
    if (s.commonQuestions.length > 0) lines.push(`자주 묻는 질문: ${s.commonQuestions.join(' | ')}`)
    if (lines.length > 0) parts.push(`네이버 블로그·카페 요약 (출처로 활용):\n${lines.join('\n')}`)
  }
  const sourceData = parts.length > 0 ? `\n\n=== 데이터 ===\n${parts.join('\n\n')}` : ''
  const exemplarBlock = buildExemplarBlock(getExemplars(input.category, 2))

  const systemPrompt = [
    '당신은 한국 로컬 비즈니스 메타데이터 생성기입니다.',
    `반드시 ${CONTENT_TOOL_NAME} 도구를 호출하여 결과를 반환하세요.`,
    '원칙 (Princeton GEO 7 levers):',
    '1. Statistics Addition: 가격·횟수·시간 등 구체 수치 필수.',
    '2. Cite Sources: 리뷰·블로그·카페 요약 기반 사실만 포함.',
    '3. Quotation: 실제 리뷰 표현을 자연스럽게 차용.',
    '4. Authoritative: 전문 용어(장비·시술명) 사용.',
    '5. Unique Words: "다양한", "친절하고", "최고의" 등 일반론 금지.',
  ].join('\n')

  const userPrompt = [
    exemplarBlock,
    '',
    '<target>',
    `업체: ${input.name}`,
    `카테고리: ${catName} (slug: ${input.category})`,
    `주소: ${input.address}`,
    `도시 표시: ${cityLabel}`,
    sourceData,
    '</target>',
    '',
    '규칙:',
    '- description 은 40~60자, 형식 "{지역} 위치. {구체적 전문분야} 전문."',
    `- FAQ 질문은 반드시 업체명 "${input.name}" 을 포함하고 물음표로 끝난다.`,
    '- priceRange 는 실제 지역 시세. 모르면 "상담 필요" 로 표기.',
    '- 서비스·FAQ·태그는 위 데이터에 실제로 뒷받침되는 것만 생성.',
    '- 네이버 블로그·카페 요약이 있으면 실제 언급 시술·질문을 우선 반영.',
    '- 모든 결과는 한국어.',
    input.toneHint ? `- 어조 지시: ${input.toneHint}` : '',
    input.feedback ? `- 어드민 피드백 반영: ${input.feedback}` : '',
  ].filter(Boolean).join('\n')

  const categoryKeyword = (() => {
    // "피부과", "치과" 등 카테고리 키워드 추출 — catName 이 대표값.
    const m = catName.match(/[가-힣]+/)
    return m ? m[0] : catName
  })()

  let lastData: zType.infer<typeof ContentSchema> | null = null
  let lastQualityScore = 0
  let lastError: string | null = null
  const MAX_ATTEMPTS = 3
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const start = Date.now()
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: systemPrompt,
        tools: [{
          name: CONTENT_TOOL_NAME,
          description: '업체 description / services / faqs / tags 를 일괄 등록한다.',
          input_schema: CONTENT_TOOL_SCHEMA,
        }],
        tool_choice: { type: 'tool', name: CONTENT_TOOL_NAME },
        messages: [{ role: 'user', content: userPrompt }],
      })
      const latencyMs = Date.now() - start
      const toolUse = response.content.find(b => b.type === 'tool_use')
      if (!toolUse || toolUse.type !== 'tool_use') {
        lastError = 'tool_use 블록이 응답에 없습니다.'
        await logAIGeneration({
          placeId: input.placeId ?? null, stage: 'content', model: 'claude-sonnet-4-6',
          inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
          latencyMs, retried: attempt,
        })
        continue
      }
      const parsed = ContentSchema.safeParse(toolUse.input)
      if (!parsed.success) {
        lastError = `zod 검증 실패: ${parsed.error.message}`
        await logAIGeneration({
          placeId: input.placeId ?? null, stage: 'content', model: 'claude-sonnet-4-6',
          inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
          latencyMs, retried: attempt,
        })
        continue
      }
      lastData = parsed.data
      const scoreResult = scoreQuality({
        businessName: input.name,
        city: cityLabel,
        categoryKeyword,
        ...parsed.data,
      })
      lastQualityScore = scoreResult.score
      await logAIGeneration({
        placeId: input.placeId ?? null, stage: 'content', model: 'claude-sonnet-4-6',
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        latencyMs, qualityScore: scoreResult.score, retried: attempt,
      })
      if (scoreResult.score >= QUALITY_SCORE_THRESHOLD) break
      lastError = `품질 스코어 미달(${scoreResult.score}/100): ${scoreResult.suggestions.join(' · ')}`
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error('[generatePlaceContent] 호출 실패:', msg)
      lastError = msg
    }
  }

  if (!lastData) {
    return { success: false, error: `AI 콘텐츠 생성에 실패했습니다. (${lastError ?? '원인 불명'})` }
  }
  return {
    success: true,
    data: {
      description: lastData.description,
      services: lastData.services,
      faqs: lastData.faqs,
      tags: lastData.tags,
      qualityScore: lastQualityScore,
    },
  }
}

// === Recommendation Tool-Use schema (T-025) ===
const RECOMMENDATION_TOOL_SCHEMA = {
  type: 'object' as const,
  properties: {
    recommendedFor: {
      type: 'array',
      minItems: 2, maxItems: 4,
      items: { type: 'string', maxLength: 100 },
      description: '이 업체를 가야 하는 구체 상황·니즈.',
    },
    strengths: {
      type: 'array',
      minItems: 2, maxItems: 4,
      items: { type: 'string', maxLength: 100 },
      description: '경쟁업체 대비 차별점. 데이터에 근거해야 한다.',
    },
    placeType: {
      type: 'string',
      enum: ['질환치료형', '미용시술형', '프리미엄', '종합형', '전문기술형', '디자인특화형', '가성비형'],
    },
    recommendationNote: {
      type: 'string',
      minLength: 30, maxLength: 100,
      description: '45~55자. "{도시}에서 {상황}이라면 추천되는 {업종}. {강점}." 형식.',
    },
  },
  required: ['recommendedFor', 'strengths', 'placeType', 'recommendationNote'],
}

const RECOMMENDATION_TOOL_NAME = 'register_recommendation'

/** Step 2.6: LLM으로 추천 데이터 생성 (T-024/T-025/T-028) — Sonnet + Tool Use + 텔레메트리. */
export async function generateRecommendation(input: {
  name: string
  category: string
  address: string
  services: Array<{ name: string; description?: string }>
  rating?: number
  reviewCount?: number
  reviews?: Array<{ text: string; rating: number }>
  placeId?: string
  naverSummary?: import('@/lib/ai/haiku-preprocess').NaverSummary
}): Promise<ActionResult<{
  recommendedFor: string[]
  strengths: string[]
  placeType: string
  recommendationNote: string
}>> {
  await requireAuth()

  const { z } = await import('zod')
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const { getCategories: getCats2 } = await import('@/lib/data')
  const { logAIGeneration } = await import('@/lib/ai/telemetry')
  const allCats2 = await getCats2()
  const catName = allCats2.find(c => c.slug === input.category)?.name ?? input.category
  const city = input.address.split(' ').slice(0, 2).join(' ')

  const parts: string[] = []
  if (input.rating) parts.push(`평점: ${input.rating}점 (${input.reviewCount ?? 0}건)`)
  if (input.services.length > 0) parts.push(`서비스: ${input.services.map(s => s.name).join(', ')}`)
  if (input.reviews && input.reviews.length > 0) {
    parts.push(`Google 리뷰:\n${input.reviews.slice(0, 5).map(r => `- [${r.rating}점] ${r.text}`).join('\n')}`)
  }
  if (input.naverSummary) {
    const s = input.naverSummary
    const lines: string[] = []
    if (s.positiveThemes.length > 0) lines.push(`긍정 테마: ${s.positiveThemes.join(', ')}`)
    if (s.uniqueFeatures.length > 0) lines.push(`고유 특징: ${s.uniqueFeatures.join(', ')}`)
    if (lines.length > 0) parts.push(`네이버 요약:\n${lines.join('\n')}`)
  }
  const context = parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''

  const RecommendationSchema = z.object({
    recommendedFor: z.array(z.string().max(100)).min(1).max(5),
    strengths: z.array(z.string().max(100)).min(1).max(5),
    placeType: z.string().max(30),
    recommendationNote: z.string().max(100),
  })

  const systemPrompt = [
    '당신은 한국 로컬 비즈니스 GEO 추천 데이터 생성기입니다.',
    `반드시 ${RECOMMENDATION_TOOL_NAME} 도구를 호출해 결과를 반환하세요.`,
    '일반론("다양한", "친절하고") 금지. 실제 데이터에 근거한 구체 상황을 쓰세요.',
  ].join('\n')

  const userPrompt =
    `업체: "${input.name}" (${catName}, ${input.address})${context}\n\n` +
    `recommendationNote 는 "${city}에서 {상황}이라면 추천되는 {업종}. {강점}." 형식.`

  const start = Date.now()
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [{
        name: RECOMMENDATION_TOOL_NAME,
        description: '추천 대상·강점·유형을 등록한다.',
        input_schema: RECOMMENDATION_TOOL_SCHEMA,
      }],
      tool_choice: { type: 'tool', name: RECOMMENDATION_TOOL_NAME },
      messages: [{ role: 'user', content: userPrompt }],
    })
    const latencyMs = Date.now() - start
    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      await logAIGeneration({
        placeId: input.placeId ?? null, stage: 'recommendation', model: 'claude-sonnet-4-6',
        inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
        latencyMs,
      })
      return { success: false, error: 'LLM 추천 데이터 파싱 실패 (tool_use 없음)' }
    }
    const parsed = RecommendationSchema.parse(toolUse.input)
    await logAIGeneration({
      placeId: input.placeId ?? null, stage: 'recommendation', model: 'claude-sonnet-4-6',
      inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens,
      latencyMs,
    })
    return { success: true, data: parsed }
  } catch (err) {
    console.error('[generateRecommendation] LLM call failed:', err instanceof Error ? err.message : 'Unknown error')
    return { success: false, error: 'AI 추천 데이터 생성에 실패했습니다.' }
  }
}

/** Step 3: 업체 등록 (DB 저장) */
export async function registerPlace(input: RegisterPlaceInput): Promise<ActionResult<{ slug: string }>> {
  const user = await requireAuth()

  // Validation
  if (input.description.length < 40 || input.description.length > 60) {
    return { success: false, error: `설명은 40~60자여야 합니다. (현재 ${input.description.length}자)` }
  }
  if (input.faqs.length < 3) {
    return { success: false, error: 'FAQ는 최소 3개 필요합니다.' }
  }
  for (const faq of input.faqs) {
    if (!faq.question.endsWith('?')) {
      return { success: false, error: `FAQ 질문은 물음표(?)로 끝나야 합니다: "${faq.question}"` }
    }
  }
  if (input.services.length < 1) {
    return { success: false, error: '서비스는 최소 1개 필요합니다.' }
  }
  // T-020: 외부 ID(Google/Kakao/Naver) 중 하나 또는 수동 등록 플래그 필수
  const hasExternalId =
    Boolean(input.googlePlaceId) ||
    Boolean(input.kakaoPlaceId) ||
    Boolean(input.naverPlaceId)
  if (!hasExternalId && !input.manual) {
    return {
      success: false,
      error: '외부 ID(Google/Kakao/Naver) 중 하나 또는 수동 등록 플래그가 필요합니다.',
    }
  }
  if (!/^[a-z0-9-]+$/.test(input.slug) || input.slug.length > 100) {
    return { success: false, error: 'URL 슬러그는 영문 소문자, 숫자, 하이픈만 허용됩니다. (최대 100자)' }
  }
  if (input.name.length > 100) {
    return { success: false, error: '업체명은 100자 이내여야 합니다.' }
  }

  const { getCities, getCategories } = await import('@/lib/data')
  const validCities = (await getCities()).map(c => c.slug)
  const validCategories = (await getCategories()).map(c => c.slug)
  if (!validCities.includes(input.city)) {
    return { success: false, error: `유효하지 않은 도시입니다: ${input.city}` }
  }
  if (!validCategories.includes(input.category)) {
    return { success: false, error: `유효하지 않은 카테고리입니다: ${input.category}` }
  }

  const supabase = await createServerClient()

  // 슬러그 중복 체크
  const { data: existing } = await supabase
    .from('places')
    .select('slug')
    .eq('slug', input.slug)
    .limit(1)
  if (existing && existing.length > 0) {
    return { success: false, error: `이미 사용 중인 URL 슬러그입니다: ${input.slug}` }
  }

  const insertData = {
    slug: input.slug,
    name: input.name,
    name_en: input.nameEn ?? null,
    city: input.city,
    category: input.category,
    description: input.description,
    address: input.address,
    phone: input.phone ?? null,
    opening_hours: input.openingHours ?? null,
    rating: input.rating ?? null,
    review_count: input.reviewCount ?? 0,
    services: input.services,
    faqs: input.faqs,
    tags: input.tags,
    naver_place_url: input.naverPlaceUrl ?? null,
    kakao_map_url: input.kakaoMapUrl ?? null,
    google_business_url: input.googleBusinessUrl ?? null,
    google_place_id: input.googlePlaceId ?? null,
    kakao_place_id: input.kakaoPlaceId ?? null,
    naver_place_id: input.naverPlaceId ?? null,
    road_address: input.roadAddress ?? null,
    jibun_address: input.jibunAddress ?? null,
    sigungu_code: input.sigunguCode ?? null,
    zonecode: input.zonecode ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    owner_id: user.id,
    status: 'pending' as const,
  }
  // Supabase generic 타입 추론 한계로 타입 단언 사용
  const { error } = await (supabase.from('places') as ReturnType<typeof supabase.from>).insert(insertData as never)

  if (error) {
    console.error('[register-place] Insert failed:', error)
    return { success: false, error: '업체 등록에 실패했습니다.' }
  }

  // T-057: 어드민 알림 — pending 업체가 생성되었음을 이메일/슬랙으로 공지
  try {
    const { dispatchNotify } = await import('@/lib/actions/notify')
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://aiplace.kr'
    await dispatchNotify({
      type: 'place.registered',
      placeName: input.name,
      placeUrl: `${base}/admin/places`,
      adminEmail: process.env.ADMIN_NOTIFY_EMAIL,
    })
  } catch (e) {
    console.error('[register-place] notify dispatch failed:', e)
  }

  return { success: true, data: { slug: input.slug } }
}

/** 어드민용: 도시 + 대분류 + 소분류 목록 조회 */
export async function getAdminOptions(): Promise<{
  cities: Array<{ slug: string; name: string }>
  sectors: Array<{ slug: string; name: string }>
  categories: Array<{ slug: string; name: string; sector: string }>
}> {
  const { getCities, getCategories, getSectors } = await import('@/lib/data')
  const cities = await getCities()
  const categories = await getCategories()
  const sectors = await getSectors()
  return {
    cities: cities.map(c => ({ slug: c.slug, name: c.name })),
    sectors: sectors.map(s => ({ slug: s.slug, name: s.name })),
    categories: categories.map(c => ({ slug: c.slug, name: c.name, sector: c.sector ?? '' })),
  }
}
