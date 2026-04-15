// AI Place — Supabase Data Repository
// Supabase에서 데이터 fetch, 실패 시 data.ts 시드 데이터 폴백.
// 함수 시그니처는 data.ts와 100% 동일.

import type { Place, City, Category, ComparisonTopic, ComparisonPage, GuidePage, FAQ, KeywordPage } from './types'
import { dbPlaceToPlace, dbCityToCity, dbCategoryToCategory } from './supabase-types'
import { getReadClient } from './supabase/read-client'

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
      .eq('city', city)
      .eq('category', category)
      .eq('slug', slug)
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
  return (await supabasePlaces(city, category)) ?? (await seed.getPlaces(city, category))
}

export async function getPlaceBySlug(city: string, category: string, slug: string): Promise<Place | undefined> {
  const result = await supabasePlaceBySlug(city, category, slug)
  return result ?? (await seed.getPlaceBySlug(city, category, slug))
}

export async function getCities(): Promise<City[]> {
  return (await supabaseCities()) ?? (await seed.getCities())
}

export async function getCategories(): Promise<Category[]> {
  return (await supabaseCategories()) ?? (await seed.getCategories())
}

export async function getAllPlaces(): Promise<Place[]> {
  return (await supabaseAllPlaces()) ?? (await seed.getAllPlaces())
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
