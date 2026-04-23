// T-209 — 오너 AI 인용 페이지의 AEO 패널용 데이터.
// 기존 /owner/reports 의 "AI 가독성 점수 + top 이슈" 를 citations 페이지에 흡수한다.
//
// 기존 dashboard-data.ts 의 AEO 계산 로직(scorePlaceAeo)과 동일 산식을 재사용하되,
// 여기선 "citations 에서만 보여주는 슬림 데이터" 만 반환 (대시보드의 OwnerPlaceSummary 와 중복 방지).

import { getAdminClient } from '@/lib/supabase/admin-client'
import { scorePlaceAeo, type AeoGrade } from './place-aeo-score'
import { countMentionsByPlace } from './place-mentions'
import type { FAQ, PlaceImage, ReviewSummary, Service } from '@/lib/types'

export interface AeoSnapshot {
  placeId: string
  placeName: string
  citySlug: string
  categorySlug: string
  placeSlug: string
  score: number
  grade: AeoGrade
  topIssues: Array<{ label: string; detail: string | undefined }>
  passedCount: number
  totalCount: number
}

interface PlaceRow {
  id: string; name: string; slug: string; city: string; category: string
  description: string | null
  phone: string | null
  address: string | null
  opening_hours: string[] | null
  images: unknown
  image_url: string | null
  review_count: number | null
  services: unknown
  faqs: unknown
  review_summaries: unknown
  updated_at: string | null
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

export async function loadAeoSnapshotsForPlaces(
  placeIds: string[],
  now: Date = new Date(),
): Promise<AeoSnapshot[]> {
  if (placeIds.length === 0) return []
  const admin = getAdminClient()
  if (!admin) return []

  const [{ data: placesData }, mentionMap] = await Promise.all([
    admin
      .from('places')
      .select(`
        id, name, slug, city, category, description, phone, address,
        opening_hours, images, image_url, review_count,
        services, faqs, review_summaries, updated_at
      `)
      .in('id', placeIds),
    countMentionsByPlace(placeIds),
  ])

  const rows = (placesData ?? []) as PlaceRow[]
  const out: AeoSnapshot[] = []
  for (const row of rows) {
    const mc = mentionMap.get(row.id)
    const contentMentions = mc?.contentMentions ?? 0
    const aeo = scorePlaceAeo({
      place: {
        name: row.name,
        address: row.address ?? '',
        phone: row.phone ?? undefined,
        lastUpdated: row.updated_at ?? undefined,
        faqs: parseJsonArray<FAQ>(row.faqs),
        reviewSummaries: parseJsonArray<ReviewSummary>(row.review_summaries),
        reviewCount: row.review_count ?? undefined,
        images: parseJsonArray<PlaceImage>(row.images),
        imageUrl: row.image_url ?? undefined,
        openingHours: row.opening_hours ?? undefined,
        services: parseJsonArray<Service>(row.services),
      },
      mentionCount: contentMentions,
      now,
    })

    const failed = aeo.rules.filter((r) => !r.passed)
    // 가중치 큰 순 = 감점이 큰 이슈부터 — 우선 개선 항목 3개.
    const topIssues = failed
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((r) => ({ label: r.label, detail: r.detail }))

    out.push({
      placeId: row.id,
      placeName: row.name,
      citySlug: row.city,
      categorySlug: row.category,
      placeSlug: row.slug,
      score: aeo.score,
      grade: aeo.grade,
      topIssues,
      passedCount: aeo.rules.filter((r) => r.passed).length,
      totalCount: aeo.rules.length,
    })
  }
  return out
}
