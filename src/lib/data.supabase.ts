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

/**
 * Phase 2 / P1-3 (codex review 2026-04-30): DB 실패 vs 빈 결과 구분.
 * - DB error / null client → return null (caller 가 seed fallback)
 * - 정상 응답이지만 0건 → return [] (정상, fallback 안 함)
 *
 * 기존엔 두 케이스를 모두 null 로 묶어서 caller 가 [] 로 fallback → DB 장애 시
 * sitemap.xml / llms.txt 가 "빈 사이트" 200 응답으로 나가는 회귀 발생.
 */
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

    if (error) {
      console.error('[data.supabase] supabasePlaces error:', error.message)
      return null
    }
    return (data ?? []).map(row => dbPlaceToPlace(row as Parameters<typeof dbPlaceToPlace>[0]))
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

    if (error) {
      console.error('[data.supabase] supabaseAllPlaces error:', error.message)
      return null
    }
    return (data ?? []).map(row => dbPlaceToPlace(row as Parameters<typeof dbPlaceToPlace>[0]))
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
  // Phase 2 / P1-3: DB 장애 시 seed 폴백. cities/categories 와 동일 패턴.
  const result = await supabasePlaces(city, category)
  if (result !== null) return result
  console.error('[data.supabase] getPlaces: DB unavailable — falling back to seed', { city, category })
  return seed.getPlaces(city, category)
}

export async function getPlaceBySlug(city: string, category: string, slug: string): Promise<Place | undefined> {
  // 단일 row 조회는 404 가 정상 케이스 — DB 폴백 적용 안 함 (잘못된 페이지 노출 방지).
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
  // Phase 2 / P1-3: DB 장애 시 seed 폴백. sitemap.xml / llms.txt 가 빈 사이트로
  // 송출되는 회귀 차단. cities/categories 와 동일 패턴.
  const result = await supabaseAllPlaces()
  if (result !== null) return result
  console.error('[data.supabase] getAllPlaces: DB unavailable — falling back to seed')
  return seed.getAllPlaces()
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

// --- 비교/가이드/키워드 페이지: T-259 R4 — 사실상 dead code ---
//
// 이 12개 함수는 Phase 6 에서 /blog/ 라우트로 마이그레이션 완료된 후 production
// 어디서도 호출되지 않는다 (호출처: migrate-to-blog 일회성 스크립트 + 테스트만).
//
// 실제 라우트 상태:
//   - src/app/compare/, src/app/guide/, src/app/[city]/[category]/k/ 모두 부재
//   - next.config.ts 의 redirects() 가 모든 legacy URL → /blog/[city]/[sector]/[slug]
//     301 redirect 처리 (천안/피부과 12개 룰)
//
// 다음 도시·카테고리 진입 시:
//   1) places DB 에 새 city×category 등록 → 자동 sitemap 노출
//   2) next.config.ts redirects() 에 3 룰 추가 (compare/guide/keyword 패턴)
//      예시: '/cheonan/orthopedics/k/:keyword' → '/blog/cheonan/medical/cheonan-orthopedics-:keyword'
//   3) seed 데이터 추가 불필요 — blog_posts 테이블에서 자동 조회
//
// 이 wrappers 는 backward compat / 테스트 호환을 위해 동작 유지 — 호출 시 천안/피부과
// seed 만 반환. 새 도시는 빈 배열. /blog/ 로 redirect 가 처리하므로 사용자 영향 없음.

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
