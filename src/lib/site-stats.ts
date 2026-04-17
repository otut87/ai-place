// AI Place — Site-wide Stats Aggregation (T-003)
// GEO 원칙(§2.2 Statistics Addition, §3 fact consistency): 모든 수치는
// 단일 소스 via site-stats 에서 집계. 하드코딩된 "2026년", "N곳" 제거.
//
// 소비자:
// - 홈(/) DAB, 통계 박스
// - SEO 문자열 (카테고리 DAB "2026년 기준" → getFullYear())
// - footer 통계
// - 가이드/블로그 본문 생성 시

import { getAllPlaces, getCities, getCategories } from './data.supabase'

export interface SiteStats {
  /** 전체 등록 업체 수 (status=active) */
  totalPlaces: number
  /** 업체가 하나 이상 등록된 카테고리 수 */
  activeCategories: number
  /** 전체 카테고리 수 (83개 하드코딩 대신 getCategories().length) */
  totalCategories: number
  /** 전체 도시 목록 (slug) — seed 기준 */
  cities: string[]
  /** 실제 업체가 등록된 도시 slug 목록 */
  activeCities: string[]
  /** 현재 연도 — "2026년 기준" 하드코딩 대체 */
  currentYear: number
}

/**
 * 사이트 수치를 단일 집계. SSG 빌드 시에만 호출 (SSR 최소화).
 */
export async function getSiteStats(): Promise<SiteStats> {
  const [places, cities, categories] = await Promise.all([
    getAllPlaces(),
    getCities(),
    getCategories(),
  ])

  const activeCategorySlugs = new Set(places.map(p => p.category))
  const activeCitySlugs = new Set(places.map(p => p.city))

  return {
    totalPlaces: places.length,
    activeCategories: activeCategorySlugs.size,
    totalCategories: categories.length,
    cities: cities.map(c => c.slug),
    activeCities: cities.filter(c => activeCitySlugs.has(c.slug)).map(c => c.slug),
    currentYear: new Date().getFullYear(),
  }
}

/**
 * 업체 수 표기 헬퍼.
 * - 0 이면 "등록 예정" (placeholder) 으로 thin-page 방지
 * - 그 외는 "N곳"
 */
export function formatCountClause(count: number): string {
  if (count <= 0) return '등록 예정'
  return `${count}곳`
}
