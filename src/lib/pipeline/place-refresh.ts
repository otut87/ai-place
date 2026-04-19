// Phase 11 — Place refresh 파이프라인.
// pipeline-consume/route.ts 에서 호출되는 순수 서버 로직.
//
// 설계:
// - 각 함수는 placeId 받아서 DB 읽고 → 외부 API / LLM 호출 → DB 쓰기
// - 성공/실패 결과를 result_payload 형태로 반환
// - 에러 throw 하면 consumer 가 retry 판정

import { getAdminClient } from '@/lib/supabase/admin-client'
import { getPlaceDetails } from '@/lib/google-places'
import { summarizeReviewsForSource, upsertReviewSummary, isSummaryStale } from '@/lib/ai/summarize-reviews'
import type { ReviewSummary } from '@/lib/types'

interface PlaceRow {
  id: string
  slug: string
  name: string
  category: string
  google_place_id: string | null
  review_summaries: ReviewSummary[] | null
}

async function loadPlace(placeId: string): Promise<PlaceRow | null> {
  const admin = getAdminClient()
  if (!admin) return null
  const { data, error } = await admin
    .from('places')
    .select('id, slug, name, category, google_place_id, review_summaries')
    .eq('id', placeId)
    .single()
  if (error || !data) return null
  return data as PlaceRow
}

export interface EnrichGoogleResult {
  slug: string
  rating: number | null
  reviewCount: number | null
  reviewsFetched: number
}

/** Google Places API 로 rating/reviewCount/googleBusinessUrl 재수집 → DB 업데이트. */
export async function runPlaceEnrichGoogle(placeId: string): Promise<EnrichGoogleResult> {
  const place = await loadPlace(placeId)
  if (!place) throw new Error(`place not found: ${placeId}`)
  if (!place.google_place_id) {
    return { slug: place.slug, rating: null, reviewCount: null, reviewsFetched: 0 }
  }

  const details = await getPlaceDetails(place.google_place_id)
  if (!details) throw new Error('Google Places detail fetch returned null')

  const admin = getAdminClient()
  if (!admin) throw new Error('admin_unavailable')

  await admin
    .from('places')
    .update({
      rating: details.rating,
      review_count: details.reviewCount,
      google_rating: details.rating,
      google_review_count: details.reviewCount,
      ...(details.googleMapsUri && { google_business_url: details.googleMapsUri }),
    })
    .eq('id', placeId)

  return {
    slug: place.slug,
    rating: details.rating,
    reviewCount: details.reviewCount,
    reviewsFetched: details.reviews.length,
  }
}

export interface SummarizeGoogleReviewsResult {
  slug: string
  summaryWritten: boolean
  reason?: string
}

/** Google 리뷰 원문 → Haiku 요약 → review_summaries 업서트. */
export async function runPlaceSummarizeGoogleReviews(
  placeId: string,
): Promise<SummarizeGoogleReviewsResult> {
  const place = await loadPlace(placeId)
  if (!place) throw new Error(`place not found: ${placeId}`)
  if (!place.google_place_id) {
    return { slug: place.slug, summaryWritten: false, reason: 'no_google_place_id' }
  }

  const details = await getPlaceDetails(place.google_place_id)
  if (!details || details.reviews.length === 0) {
    return { slug: place.slug, summaryWritten: false, reason: 'no_reviews' }
  }

  const existing = (place.review_summaries ?? []).find(
    s => s.source.toLowerCase() === 'google',
  )
  if (!isSummaryStale(existing, 7)) {
    return { slug: place.slug, summaryWritten: false, reason: 'fresh' }
  }

  const result = await summarizeReviewsForSource(
    'Google',
    details.reviews.map(r => ({ text: r.text, rating: r.rating, relativeTime: r.relativeTime })),
    { businessName: place.name, category: place.category },
  )
  if (!result) {
    return { slug: place.slug, summaryWritten: false, reason: 'summarizer_returned_null' }
  }

  const admin = getAdminClient()
  if (!admin) throw new Error('admin_unavailable')

  const nextSummaries = upsertReviewSummary(place.review_summaries ?? undefined, result.summary)
  await admin
    .from('places')
    .update({ review_summaries: nextSummaries })
    .eq('id', placeId)

  return { slug: place.slug, summaryWritten: true }
}
