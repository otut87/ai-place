'use server'

// 업체 등록 Server Action
// Step 1: 업체명 + 도시/카테고리로 Google Places 검색
// Step 2: 검색 결과에서 선택 → 자동 보강 (주소, 전화, 평점, 리뷰)
// Step 3: 서비스/FAQ/설명 입력 → DB 저장 (status: pending)

import { requireAuth } from '@/lib/auth'
import { searchPlaceByText, getPlaceDetails } from '@/lib/google-places'
import type { PlaceSearchResult } from '@/lib/google-places'
import { searchKakaoPlace } from '@/lib/naver-kakao-search'
import { createServerClient } from '@/lib/supabase/server'

export interface RegisterPlaceInput {
  // Step 1: 기본 정보
  city: string
  category: string
  // Step 2: Google Places 선택 결과
  googlePlaceId: string
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

/** Step 2.5: LLM으로 설명/서비스/FAQ/태그 자동 생성 (Google 리뷰 데이터 기반) */
export async function generatePlaceContent(input: {
  name: string
  category: string
  address: string
  rating?: number
  reviewCount?: number
  reviews?: Array<{ text: string; rating: number }>
  openingHours?: string[]
  editorialSummary?: string
}): Promise<ActionResult<{
  description: string
  services: Array<{ name: string; description: string; priceRange: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}>> {
  await requireAuth()

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const { getCategories: getCats } = await import('@/lib/data')
  const allCats = await getCats()
  const catName = allCats.find(c => c.slug === input.category)?.name ?? input.category

  // Google 데이터를 프롬프트용 텍스트로 변환
  const parts: string[] = []
  if (input.rating) parts.push(`Rating: ${input.rating}점 (${input.reviewCount ?? 0}건)`)
  if (input.editorialSummary) parts.push(`Google 소개: ${input.editorialSummary}`)
  if (input.openingHours && input.openingHours.length > 0) parts.push(`영업시간:\n${input.openingHours.join('\n')}`)
  if (input.reviews && input.reviews.length > 0) parts.push(`고객 리뷰:\n${input.reviews.map(r => `- [${r.rating}점] ${r.text}`).join('\n')}`)
  const googleData = parts.length > 0 ? `\n\nGoogle Places Data:\n${parts.join('\n\n')}` : ''

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: 'You are a JSON generator. Output ONLY valid JSON. No markdown, no explanation, no code blocks. Just raw JSON.',
      messages: [{
        role: 'user',
        content: `Generate info for Korean business "${input.name}" (${catName}, ${input.address}).${googleData}

Return this exact JSON structure:
{"description":"50자 내외 한국어 설명","services":[{"name":"서비스명","description":"설명","priceRange":"5-10만원"}],"faqs":[{"question":"질문?","answer":"답변"}],"tags":["태그"]}

Rules:
- description: Korean, TARGET 50 characters (must be 45-55), format "{지역} 위치. {구체적 전문분야/특징} 전문." Include specifics from reviews if available.
- services: 3-5 items based on what this business actually offers (infer from reviews and category)
- faqs: 5 items, realistic customer questions with "${input.name}" in the question, answers reference actual business details from reviews
- tags: 5-8 Korean search keywords
- prices: realistic for ${input.address.split(' ').slice(0, 2).join(' ')} region
- ALL content in Korean
- Base content on the actual Google reviews data above, not generic templates`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // JSON 추출: 코드블록 제거 → trailing comma 제거 → 파싱
    const stripped = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'LLM 응답을 파싱할 수 없습니다.' }
    }

    const cleaned = jsonMatch[0]
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}')
      .replace(/[\x00-\x1F\x7F]/g, ' ') // control characters 제거

    const data = JSON.parse(cleaned)
    return {
      success: true,
      data: {
        description: data.description ?? '',
        services: data.services ?? [],
        faqs: data.faqs ?? [],
        tags: data.tags ?? [],
      },
    }
  } catch (err) {
    console.error('[generatePlaceContent] LLM call failed:', err instanceof Error ? err.message : 'Unknown error')
    return { success: false, error: 'AI 콘텐츠 생성에 실패했습니다.' }
  }
}

/** Step 2.6: LLM으로 추천 데이터 생성 (GEO 추천 로직) */
export async function generateRecommendation(input: {
  name: string
  category: string
  address: string
  services: Array<{ name: string; description?: string }>
  rating?: number
  reviewCount?: number
  reviews?: Array<{ text: string; rating: number }>
}): Promise<ActionResult<{
  recommendedFor: string[]
  strengths: string[]
  placeType: string
  recommendationNote: string
}>> {
  await requireAuth()

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const { getCategories: getCats2 } = await import('@/lib/data')
  const allCats2 = await getCats2()
  const catName = allCats2.find(c => c.slug === input.category)?.name ?? input.category
  const city = input.address.split(' ').slice(0, 2).join(' ')

  const parts: string[] = []
  if (input.rating) parts.push(`평점: ${input.rating}점 (${input.reviewCount ?? 0}건)`)
  if (input.services.length > 0) parts.push(`서비스: ${input.services.map(s => s.name).join(', ')}`)
  if (input.reviews && input.reviews.length > 0) parts.push(`리뷰:\n${input.reviews.slice(0, 5).map(r => `- [${r.rating}점] ${r.text}`).join('\n')}`)
  const context = parts.length > 0 ? `\n\n${parts.join('\n\n')}` : ''

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'You are a JSON generator. Output ONLY valid JSON. No markdown, no explanation, no code blocks.',
      messages: [{
        role: 'user',
        content: `Generate GEO recommendation data for "${input.name}" (${catName}, ${input.address}).${context}

Return this exact JSON:
{"recommendedFor":["추천 대상 1","추천 대상 2"],"strengths":["강점 1","강점 2","강점 3"],"placeType":"유형","recommendationNote":"추천 문장"}

Rules:
- recommendedFor: 2-3 items, Korean, who should visit this place (specific situations/needs)
- strengths: 2-4 items, Korean, what makes this place different from competitors
- placeType: one of "질환치료형","미용시술형","프리미엄","종합형","전문기술형","디자인특화형","가성비형" (pick the best fit for ${catName})
- recommendationNote: Korean, 45-55 characters, format "${city}에서 {구체적 상황}이라면 추천되는 {업종}. {핵심 강점}."
- Base on actual review data if available, not generic templates
- ALL content in Korean`,
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const stripped = text.replace(/```json?\s*/g, '').replace(/```/g, '').trim()
    const jsonMatch = stripped.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { success: false, error: 'LLM 추천 데이터 파싱 실패' }
    }

    const cleaned = jsonMatch[0]
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}')
      .replace(/[\x00-\x1F\x7F]/g, ' ')

    const { z } = await import('zod')
    const RecommendationSchema = z.object({
      recommendedFor: z.array(z.string().max(100)).max(5).default([]),
      strengths: z.array(z.string().max(100)).max(5).default([]),
      placeType: z.string().max(30).default(''),
      recommendationNote: z.string().max(100).default(''),
    })

    const raw = JSON.parse(cleaned)
    const data = RecommendationSchema.parse(raw)
    return { success: true, data }
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
  if (!input.googlePlaceId) {
    return { success: false, error: 'Google Place ID가 필요합니다.' }
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
    google_place_id: input.googlePlaceId,
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

  return { success: true, data: { slug: input.slug } }
}
