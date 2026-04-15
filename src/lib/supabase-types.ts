// AI Place — Supabase Database Row Types
// Phase 1: DB 스키마와 1:1 매핑되는 snake_case 타입.
// camelCase 앱 타입(types.ts)과 변환 함수도 포함.

import type { Place, City, Category, Service, FAQ, ReviewSummary, PlaceImage } from './types'

// --- Database Row Types (snake_case, matches SQL columns) ---

/** places 테이블 row */
export interface DbPlace {
  id: string
  slug: string
  name: string
  name_en: string | null
  city: string
  category: string
  description: string
  address: string
  phone: string | null
  opening_hours: string[] | null
  image_url: string | null
  rating: number | null
  review_count: number
  services: Service[]
  faqs: FAQ[]
  tags: string[]
  naver_place_url: string | null
  kakao_map_url: string | null
  google_business_url: string | null
  google_place_id: string | null
  review_summaries: ReviewSummary[] | null
  images: PlaceImage[] | null
  latitude: number | null
  longitude: number | null
  owner_id: string | null
  status: 'active' | 'pending' | 'rejected'
  created_at: string
  updated_at: string
}

/** cities 테이블 row */
export interface DbCity {
  id: string
  slug: string
  name: string
  name_en: string
  created_at: string
}

/** categories 테이블 row */
export interface DbCategory {
  id: string
  slug: string
  name: string
  name_en: string
  icon: string | null
  created_at: string
}

/** blog_posts 테이블 row */
export interface DbBlogPost {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  city: string
  category: string | null
  tags: string[]
  status: 'draft' | 'published'
  published_at: string | null
  created_at: string
  updated_at: string
}

// --- Transformation Functions ---

/** DbPlace → Place (snake_case → camelCase) */
export function dbPlaceToPlace(row: DbPlace): Place {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en ?? undefined,
    city: row.city,
    category: row.category,
    description: row.description,
    address: row.address,
    phone: row.phone ?? undefined,
    openingHours: row.opening_hours ?? undefined,
    imageUrl: row.image_url ?? undefined,
    rating: row.rating ?? undefined,
    reviewCount: row.review_count,
    services: row.services,
    faqs: row.faqs,
    tags: row.tags,
    naverPlaceUrl: row.naver_place_url ?? undefined,
    kakaoMapUrl: row.kakao_map_url ?? undefined,
    googleBusinessUrl: row.google_business_url ?? undefined,
    googlePlaceId: row.google_place_id ?? undefined,
    reviewSummaries: row.review_summaries ?? undefined,
    images: row.images ?? undefined,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    lastUpdated: row.updated_at.slice(0, 10), // ISO datetime → date
  }
}

/** DbCity → City */
export function dbCityToCity(row: DbCity): City {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en,
  }
}

/** DbCategory → Category */
export function dbCategoryToCategory(row: DbCategory): Category {
  return {
    slug: row.slug,
    name: row.name,
    nameEn: row.name_en,
    icon: row.icon ?? undefined,
  }
}

/** Place → Partial DbPlace (insert용, id/timestamps 제외) */
export function placeToDbInsert(place: Place): Omit<DbPlace, 'id' | 'created_at' | 'updated_at'> {
  return {
    slug: place.slug,
    name: place.name,
    name_en: place.nameEn ?? null,
    city: place.city,
    category: place.category,
    description: place.description,
    address: place.address,
    phone: place.phone ?? null,
    opening_hours: place.openingHours ?? null,
    image_url: place.imageUrl ?? null,
    rating: place.rating ?? null,
    review_count: place.reviewCount ?? 0,
    services: place.services,
    faqs: place.faqs,
    tags: place.tags,
    naver_place_url: place.naverPlaceUrl ?? null,
    kakao_map_url: place.kakaoMapUrl ?? null,
    google_business_url: place.googleBusinessUrl ?? null,
    google_place_id: place.googlePlaceId ?? null,
    review_summaries: place.reviewSummaries ?? null,
    images: place.images ?? null,
    latitude: place.latitude ?? null,
    longitude: place.longitude ?? null,
    owner_id: null,
    status: 'active',
  }
}
