// T-194 — 외부 업체 참조 (실시간 Google Places, DB 저장 X).
//
// 핵심 제약 (사용자 결정):
//  - SaaS 전환 funnel 을 보호하기 위해 **aiplace.kr 에 등록되지 않은 업체는 DB 에 저장하지 않는다**.
//  - 결과는 pipeline in-memory 에서 writer 프롬프트에 주입되고 본문 텍스트로만 등장.
//  - 내부 링크 대상이 아니므로 slug/id 필드를 가지지 않는다.

import { searchPlaceByText, type PlaceSearchResult } from '@/lib/google-places'

export interface ExternalPlace {
  name: string
  address: string
  rating: number | null
  reviewCount: number | null
  source: 'google_external'     // 향후 'naver_external' 등 추가 대비
}

export interface FetchExternalReferencesInput {
  sector: string               // 'medical', 'beauty', ...
  category?: string            // 'dermatology', 'hair-salon', ...
  cityName: string             // 한글 도시명 ('천안')
  internalActiveCount: number  // 현재 DB active 업체 수
  minReferenceCount?: number   // 외부 참조 필요 최소치 (기본 5)
  maxResults?: number          // Google 반환 상한 (기본 5, API 최대 5)
  excludeNames?: string[]      // 이미 내부 등록된 업체명 — 중복 참조 방지
}

export interface FetchExternalReferencesResult {
  places: ExternalPlace[]
  skipped: boolean             // DB 업체 충분 → API 호출 생략한 경우 true
  query: string | null         // 호출된 실제 검색어 (디버그용)
}

/**
 * 내부 active 업체가 minReferenceCount 미만일 때만 Google Places Text Search 호출.
 * 절대 DB 에 저장하지 않는다.
 */
export async function fetchExternalReferences(
  input: FetchExternalReferencesInput,
): Promise<FetchExternalReferencesResult> {
  const {
    sector,
    category,
    cityName,
    internalActiveCount,
    minReferenceCount = 5,
    maxResults = 5,
    excludeNames = [],
  } = input

  if (internalActiveCount >= minReferenceCount) {
    return { places: [], skipped: true, query: null }
  }

  // 한글 도시명 + 카테고리 조합. Google Places 는 자연어 쿼리 처리.
  const categoryHint = category ?? sector
  const query = `${cityName} ${categoryHint}`

  const raw = await searchPlaceByText(query)
  if (!raw || raw.length === 0) {
    return { places: [], skipped: false, query }
  }

  const excludeSet = new Set(excludeNames.map(n => n.trim()))
  const external: ExternalPlace[] = raw
    .filter((p: PlaceSearchResult) => !excludeSet.has(p.name.trim()))
    .slice(0, maxResults)
    .map((p: PlaceSearchResult) => ({
      name: p.name,
      address: p.address,
      rating: p.rating ?? null,
      reviewCount: p.reviewCount ?? null,
      source: 'google_external' as const,
    }))

  return { places: external, skipped: false, query }
}
