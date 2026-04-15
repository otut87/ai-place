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
}): Promise<ActionResult<{
  description: string
  services: Array<{ name: string; description: string; priceRange: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}>> {
  await requireAuth()

  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic()

  const categoryNames: Record<string, string> = {
    dermatology: '피부과', interior: '인테리어', webagency: '웹에이전시',
    'auto-repair': '자동차정비', hairsalon: '미용실',
  }
  const catName = categoryNames[input.category] ?? input.category

  // 리뷰 데이터를 프롬프트용 텍스트로 변환
  const reviewText = (input.reviews && input.reviews.length > 0)
    ? `\n\nGoogle Reviews (${input.rating ?? 0}점, ${input.reviewCount ?? 0}건):\n${input.reviews.map(r => `- [${r.rating}점] ${r.text}`).join('\n')}`
    : ''

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: 'You are a JSON generator. Output ONLY valid JSON. No markdown, no explanation, no code blocks. Just raw JSON.',
      messages: [{
        role: 'user',
        content: `Generate info for Korean business "${input.name}" (${catName}, ${input.address}).${reviewText}

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
    console.error('[generatePlaceContent] LLM call failed:', err)
    return { success: false, error: 'AI 콘텐츠 생성에 실패했습니다.' }
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

  const validCities = ['cheonan']
  const validCategories = ['dermatology', 'interior', 'webagency', 'auto-repair', 'hairsalon']
  if (!validCities.includes(input.city)) {
    return { success: false, error: `유효하지 않은 도시입니다: ${input.city}` }
  }
  if (!validCategories.includes(input.category)) {
    return { success: false, error: `유효하지 않은 카테고리입니다: ${input.category}` }
  }

  const supabase = await createServerClient()
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
