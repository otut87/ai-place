// T-130 — 블로그 추천 업체 자동 선정 로직.
// "LLM 이 어떤 업체를 정하는가" 의 실체: 관리자 등록 업체 중
// 평점·리뷰·컴플라이언스 기준으로 상위 N 곳을 후보로 선출.
// 실제 콘텐츠 생성(T-129)은 이 후보 목록을 프롬프트에 주입해 진행.

import type { Place } from '@/lib/types'

export interface SelectionInput {
  city: string
  category: string
  places: Place[]                // 사전 조회된 후보 풀 (전체 places)
  maxCount?: number              // 기본 5
  minRating?: number             // 기본 4.0
  minReviewCount?: number        // 기본 10
  requireComplianceMetadata?: boolean  // 의료·법률·세무 카테고리 전용
  /** 수동 선택: 이 slug 들만 후보로 쓰고 자동 필터 생략 (city/category 일치는 유지). */
  manualSlugs?: string[]
}

export interface SelectionResult {
  places: Place[]
  reasoning: string
  warning?: string
}

type PlaceWithQuality = Place & { qualityScore?: number | null }

const MEDICAL_CATEGORIES = new Set([
  'dermatology', 'dental', 'oriental-medicine', 'orthopedic', 'internal-medicine',
  'pediatric', 'ophthalmology', 'ent', 'obstetrics', 'psychiatric',
  'urology', 'plastic-surgery', 'rehabilitation',
])
const LEGAL_CATEGORIES = new Set(['legal'])
const TAX_CATEGORIES = new Set(['tax'])

function isComplianceCategory(slug: string): boolean {
  return MEDICAL_CATEGORIES.has(slug) || LEGAL_CATEGORIES.has(slug) || TAX_CATEGORIES.has(slug)
}

/**
 * 후보 업체 선정.
 * 기본 필터: city/category 일치, status 미고려(상위 호출이 active 만 주입),
 *   rating >= minRating, reviewCount >= minReviewCount
 * 정렬: qualityScore DESC, rating DESC, reviewCount DESC
 */
export function selectCandidatePlaces(input: SelectionInput): SelectionResult {
  const {
    city, category, places,
    maxCount = 5,
    minRating = 4.0,
    minReviewCount = 10,
    requireComplianceMetadata = false,
    manualSlugs,
  } = input

  // 수동 모드: 지정된 slug 만 쓰고 필터 생략.
  if (manualSlugs && manualSlugs.length > 0) {
    const manualSet = new Set(manualSlugs)
    const matched = places.filter(p =>
      manualSet.has(p.slug) && p.city === city && p.category === category,
    )
    return {
      places: matched.slice(0, Math.max(maxCount, manualSlugs.length)),
      reasoning: `관리자 수동 선택 ${matched.length}곳 (${city}/${category})`,
      warning: matched.length === 0
        ? `수동 선택한 업체가 ${city}/${category} 에서 찾을 수 없습니다.`
        : undefined,
    }
  }

  // compliance 필터는 명시적 요청 시만 엄격 적용.
  const filtered = places.filter(p => {
    if (p.city !== city) return false
    if (p.category !== category) return false
    if ((p.rating ?? 0) < minRating) return false
    if ((p.reviewCount ?? 0) < minReviewCount) return false
    if (requireComplianceMetadata && !p.placeType) return false
    return true
  }) as PlaceWithQuality[]

  const sorted = [...filtered].sort((a, b) => {
    const qa = a.qualityScore ?? 0
    const qb = b.qualityScore ?? 0
    if (qa !== qb) return qb - qa
    const ra = a.rating ?? 0
    const rb = b.rating ?? 0
    if (ra !== rb) return rb - ra
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
  })

  const top = sorted.slice(0, maxCount)
  const reasoning = buildReasoning(city, category, top, {
    minRating, minReviewCount, totalFiltered: filtered.length, totalCandidates: places.length,
  })

  const warning = top.length === 0
    ? `${city}/${category} 에서 평점 ${minRating}+ / 리뷰 ${minReviewCount}+ 업체가 없습니다. 등록 업체를 확인해 주세요.`
    : undefined

  return { places: top, reasoning, warning }
}

function buildReasoning(
  city: string,
  category: string,
  selected: Place[],
  ctx: { minRating: number; minReviewCount: number; totalFiltered: number; totalCandidates: number },
): string {
  const complianceNote = isComplianceCategory(category) ? ' (규제 카테고리 — 컴플라이언스 메타 권장)' : ''
  if (selected.length === 0) {
    return `${city}/${category} 후보 0개 (전체 ${ctx.totalCandidates}개 중 기준 통과 ${ctx.totalFiltered}개).${complianceNote}`
  }
  const avgRating = selected.reduce((s, p) => s + (p.rating ?? 0), 0) / selected.length
  const totalReviews = selected.reduce((s, p) => s + (p.reviewCount ?? 0), 0)
  return [
    `${city}/${category} 등록 업체 ${ctx.totalCandidates}개 중 `,
    `평점 ${ctx.minRating}+ / 리뷰 ${ctx.minReviewCount}+ 필터 통과 ${ctx.totalFiltered}개, `,
    `상위 ${selected.length}곳 선정. `,
    `평균 평점 ${avgRating.toFixed(2)}, 리뷰 합계 ${totalReviews}건.${complianceNote}`,
  ].join('')
}
