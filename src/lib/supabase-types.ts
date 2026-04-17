// AI Place — Supabase Database Row Types
// Phase 1: DB 스키마와 1:1 매핑되는 snake_case 타입.
// camelCase 앱 타입(types.ts)과 변환 함수도 포함.

import type {
  Place, City, Category, Service, FAQ, ReviewSummary, PlaceImage,
  BlogPost, BlogPostSummary,
} from './types'

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
  recommended_for: string[]  // jsonb DEFAULT '[]', never null for new rows
  strengths: string[]        // jsonb DEFAULT '[]', never null for new rows
  place_type: string | null
  recommendation_note: string | null
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
  sector: string
  created_at: string
}

/** blog_posts 테이블 row (T-010a 확장 후) */
export interface DbBlogPost {
  id: string
  slug: string
  title: string
  summary: string
  content: string
  city: string
  category: string | null
  tags: string[]
  status: 'draft' | 'active' | 'archived'
  published_at: string | null
  created_at: string
  updated_at: string
  // T-010a 확장 컬럼
  sector: string                                                   // 의료/뷰티/리빙 등 대분류
  post_type: 'keyword' | 'compare' | 'guide' | 'general'
  related_place_slugs: string[]
  target_query: string | null                                      // 키워드 페이지의 SEO 쿼리
  faqs: Array<{ question: string; answer: string }>
  statistics: Array<{ label: string; value: string; note?: string }>
  sources: Array<{ title: string; url: string }>
  view_count: number
  quality_score: number | null
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
    recommendedFor: row.recommended_for?.length ? row.recommended_for : undefined,
    strengths: row.strengths?.length ? row.strengths : undefined,
    placeType: row.place_type ?? undefined,
    recommendationNote: row.recommendation_note ?? undefined,
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
    sector: row.sector,
  }
}

/** DbBlogPost → BlogPost (snake_case → camelCase, T-010b) */
export function dbBlogPostToBlogPost(row: DbBlogPost): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    content: row.content,
    city: row.city,
    sector: row.sector,
    category: row.category,
    tags: row.tags,
    postType: row.post_type,
    relatedPlaceSlugs: row.related_place_slugs ?? [],
    targetQuery: row.target_query,
    faqs: row.faqs,
    statistics: row.statistics,
    sources: row.sources,
    viewCount: row.view_count,
    qualityScore: row.quality_score,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** DbBlogPost → BlogPostSummary (목록용 경량 변환) */
export function dbBlogPostToSummary(row: DbBlogPost): BlogPostSummary {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    city: row.city,
    sector: row.sector,
    category: row.category,
    postType: row.post_type,
    tags: row.tags,
    viewCount: row.view_count,
    publishedAt: row.published_at,
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
    recommended_for: place.recommendedFor ?? [],
    strengths: place.strengths ?? [],
    place_type: place.placeType ?? null,
    recommendation_note: place.recommendationNote ?? null,
    owner_id: null,
    status: 'active',
  }
}
