// AI Place — Supabase Data Repository
// Supabase에서 데이터 fetch, 실패 시 data.ts 시드 데이터 폴백.
// 함수 시그니처는 data.ts와 100% 동일.

import type { Place, City, Category, Sector, ComparisonTopic, ComparisonPage, GuidePage, FAQ, KeywordPage } from './types'
import { dbPlaceToPlace, dbCityToCity, dbCategoryToCategory } from './supabase-types'
import { getReadClient } from './supabase/read-client'
import { getAdminClient } from './supabase/admin-client'

// 시드 데이터 폴백 (import를 seed로 네이밍)
import * as seed from './data'

// --- Supabase 쿼리 헬퍼 ---

async function supabasePlaces(city: string, category: string): Promise<Place[] | null> {
  try {
    const supabase = getReadClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('city', city)
      .eq('category', category)
      .eq('status', 'active')
      .not('google_place_id', 'is', null)

    if (error || !data || data.length === 0) return null
    return data.map(row => dbPlaceToPlace(row as Parameters<typeof dbPlaceToPlace>[0]))
  } catch (err) {
    console.error('[data.supabase] supabasePlaces failed:', err)
    return null
  }
}

async function supabasePlaceBySlug(city: string, category: string, slug: string): Promise<Place | null> {
  try {
    const supabase = getReadClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('slug', slug)
      .eq('city', city)
      .eq('category', category)
      .eq('status', 'active')

    if (error || !data || data.length === 0) return null
    return dbPlaceToPlace(data[0] as Parameters<typeof dbPlaceToPlace>[0])
  } catch (err) {
    console.error('[data.supabase] supabasePlaceBySlug failed:', err)
    return null
  }
}

async function supabaseAllPlaces(): Promise<Place[] | null> {
  try {
    const supabase = getReadClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('status', 'active')
      .not('google_place_id', 'is', null)

    if (error || !data || data.length === 0) return null
    return data.map(row => dbPlaceToPlace(row as Parameters<typeof dbPlaceToPlace>[0]))
  } catch (err) {
    console.error('[data.supabase] supabaseAllPlaces failed:', err)
    return null
  }
}

async function supabaseCities(): Promise<City[] | null> {
  try {
    const supabase = getReadClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('cities')
      .select('*')
      .order('slug')

    if (error || !data || data.length === 0) return null
    return data.map(row => dbCityToCity(row as Parameters<typeof dbCityToCity>[0]))
  } catch (err) {
    console.error('[data.supabase] supabaseCities failed:', err)
    return null
  }
}

async function supabaseCategories(): Promise<Category[] | null> {
  try {
    const supabase = getReadClient()
    if (!supabase) return null
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('slug')

    if (error || !data || data.length === 0) return null
    return data.map(row => dbCategoryToCategory(row as Parameters<typeof dbCategoryToCategory>[0]))
  } catch (err) {
    console.error('[data.supabase] supabaseCategories failed:', err)
    return null
  }
}

// --- Public API (data.ts와 동일 시그니처) ---

export async function getPlaces(city: string, category: string): Promise<Place[]> {
  return (await supabasePlaces(city, category)) ?? []
}

export async function getPlaceBySlug(city: string, category: string, slug: string): Promise<Place | undefined> {
  return (await supabasePlaceBySlug(city, category, slug)) ?? undefined
}

export async function getCities(): Promise<City[]> {
  return (await supabaseCities()) ?? (await seed.getCities())
}

export async function getSectors(): Promise<Sector[]> {
  return seed.getSectors()
}

export async function getCategories(): Promise<Category[]> {
  return (await supabaseCategories()) ?? (await seed.getCategories())
}

export async function getSchemaTypeForCategory(categorySlug: string): Promise<string> {
  return seed.getSchemaTypeForCategory(categorySlug)
}

export async function getMetaDescriptorForCategory(categorySlug: string): Promise<string> {
  return seed.getMetaDescriptorForCategory(categorySlug)
}

export async function getSectorForCategory(categorySlug: string) {
  return seed.getSectorForCategory(categorySlug)
}

export async function getAllPlaces(): Promise<Place[]> {
  return (await supabaseAllPlaces()) ?? []
}

/** 업체 ReviewSummary 배열 업서트 — 특정 소스 요약을 새로 갱신. */
export async function updatePlaceReviewSummaries(
  slug: string,
  summaries: import('@/lib/types').ReviewSummary[],
): Promise<void> {
  try {
    const supabase = getAdminClient()
    if (!supabase) return
    await supabase
      .from('places')
      .update({ review_summaries: summaries })
      .eq('slug', slug)
  } catch (err) {
    console.error('[data.supabase] updatePlaceReviewSummaries failed:', err)
  }
}

/** Google Places API 결과를 DB에 저장 — 빌드 시 상세페이지에서 호출.
 *  Phase 11: 기존 rating/review_count 에 더해 google_rating/google_review_count 도 동시 저장. */
export async function updatePlaceGoogleData(slug: string, data: {
  rating: number
  reviewCount: number
  googleBusinessUrl?: string
}): Promise<void> {
  try {
    const supabase = getAdminClient()
    if (!supabase) return
    await supabase
      .from('places')
      .update({
        rating: data.rating,
        review_count: data.reviewCount,
        google_rating: data.rating,
        google_review_count: data.reviewCount,
        ...(data.googleBusinessUrl && { google_business_url: data.googleBusinessUrl }),
      })
      .eq('slug', slug)
  } catch (err) {
    console.error('[data.supabase] updatePlaceGoogleData failed:', err)
  }
}

// --- 비교/가이드/키워드 페이지: 아직 시드 데이터만 (Phase 6에서 DB 전환) ---

export async function getComparisonTopics(city: string, category: string): Promise<ComparisonTopic[]> {
  return seed.getComparisonTopics(city, category)
}

export async function getComparisonPage(city: string, category: string, topicSlug: string): Promise<ComparisonPage | undefined> {
  return seed.getComparisonPage(city, category, topicSlug)
}

export async function getAllComparisonTopics(): Promise<ComparisonTopic[]> {
  return seed.getAllComparisonTopics()
}

export async function getGuidePage(city: string, category: string): Promise<GuidePage | undefined> {
  return seed.getGuidePage(city, category)
}

export async function getAllGuidePages(): Promise<GuidePage[]> {
  return seed.getAllGuidePages()
}

export async function getCategoryFaqs(city: string, category: string): Promise<FAQ[]> {
  return seed.getCategoryFaqs(city, category)
}

export async function getKeywordPage(city: string, category: string, slug: string): Promise<KeywordPage | undefined> {
  return seed.getKeywordPage(city, category, slug)
}

export async function getAllKeywordPages(): Promise<KeywordPage[]> {
  return seed.getAllKeywordPages()
}

export async function getGuidesForPlace(placeSlug: string): Promise<GuidePage[]> {
  return seed.getGuidesForPlace(placeSlug)
}

export async function getComparisonsForPlace(placeSlug: string): Promise<ComparisonPage[]> {
  return seed.getComparisonsForPlace(placeSlug)
}
