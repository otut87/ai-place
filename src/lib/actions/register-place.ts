'use server'

// 업체 등록 Server Action
// Step 1: 업체명 + 도시/카테고리로 Google Places 검색
// Step 2: 검색 결과에서 선택 → 자동 보강 (주소, 전화, 평점, 리뷰)
// Step 3: 서비스/FAQ/설명 입력 → DB 저장 (status: pending)

import { requireAuth } from '@/lib/auth'
import { searchPlaceByText, getPlaceDetails, type PlaceSearchResult } from '@/lib/google-places'
import { createServerClient } from '@/lib/supabase/server'

export type { PlaceSearchResult }

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

/** Step 2: Place ID로 상세 정보 가져오기 (자동 보강) */
export async function enrichPlace(placeId: string): Promise<ActionResult<{
  name: string
  rating: number
  reviewCount: number
  googleMapsUri?: string
}>> {
  await requireAuth()

  const details = await getPlaceDetails(placeId)
  if (!details) {
    return { success: false, error: 'Google Places 상세 정보를 가져올 수 없습니다.' }
  }

  return {
    success: true,
    data: {
      name: details.name,
      rating: details.rating,
      reviewCount: details.reviewCount,
      googleMapsUri: details.googleMapsUri,
    },
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
