// 3-Source 병합 (T-014)
// - Kakao 이름 (한글 정식명) 우선
// - Kakao roadAddress (가장 정확한 한국 주소) 우선
// - Google 평점/리뷰 우선
// - sameAs: 각 소스 URL 수집

import type { KakaoPlaceResult } from './kakao-local'
import type { NaverPlaceResult } from './naver-local'
import type { PlaceSearchResult } from '@/lib/google-places'
import { isSameBusiness, type BusinessLike } from './dedup'

export type SearchSource = 'kakao' | 'google' | 'naver'

export interface MergedCandidate {
  // Identity
  displayName: string
  kakaoPlaceId?: string
  googlePlaceId?: string
  naverLink?: string

  // Address
  roadAddress?: string | null
  jibunAddress?: string | null

  // Location
  latitude: number
  longitude: number

  // Contact
  phone?: string | null

  // Reviews (Google 우선)
  rating?: number
  reviewCount?: number

  // Category hints
  kakaoCategory?: string
  naverCategory?: string

  // Provenance
  sources: SearchSource[]
  sameAs: string[]

  // Raw (디버깅 / 필드 선택 재개방)
  raw: {
    kakao?: KakaoPlaceResult
    google?: PlaceSearchResult
    naver?: NaverPlaceResult
  }
}

interface NormalizedInput {
  source: SearchSource
  business: BusinessLike
  payload: KakaoPlaceResult | PlaceSearchResult | NaverPlaceResult
}

function normalizeKakao(k: KakaoPlaceResult): NormalizedInput {
  return {
    source: 'kakao',
    business: {
      name: k.placeName,
      roadAddress: k.roadAddressName,
      jibunAddress: k.addressName,
      latitude: k.latitude,
      longitude: k.longitude,
    },
    payload: k,
  }
}

function normalizeGoogle(g: PlaceSearchResult): NormalizedInput {
  return {
    source: 'google',
    business: {
      name: g.name,
      roadAddress: g.address,
      latitude: g.latitude,
      longitude: g.longitude,
    },
    payload: g,
  }
}

function normalizeNaver(n: NaverPlaceResult): NormalizedInput {
  return {
    source: 'naver',
    business: {
      name: n.title,
      roadAddress: n.roadAddress,
      jibunAddress: n.address,
      latitude: n.latitude,
      longitude: n.longitude,
    },
    payload: n,
  }
}

function buildMerged(group: NormalizedInput[]): MergedCandidate {
  const kakao = group.find(g => g.source === 'kakao')?.payload as KakaoPlaceResult | undefined
  const google = group.find(g => g.source === 'google')?.payload as PlaceSearchResult | undefined
  const naver = group.find(g => g.source === 'naver')?.payload as NaverPlaceResult | undefined

  const displayName =
    kakao?.placeName ?? naver?.title ?? google?.name ?? '이름 없음'

  const roadAddress =
    kakao?.roadAddressName ?? naver?.roadAddress ?? google?.address ?? null
  const jibunAddress = kakao?.addressName ?? naver?.address ?? null

  // 첫 번째로 좌표가 있는 것
  const withCoord = group.find(g => g.business.latitude && g.business.longitude)
  const latitude = withCoord?.business.latitude ?? 0
  const longitude = withCoord?.business.longitude ?? 0

  const phone = kakao?.phone ?? naver?.telephone ?? null

  const rating = google?.rating
  const reviewCount = google?.reviewCount

  const sameAs: string[] = []
  if (kakao?.placeUrl) sameAs.push(kakao.placeUrl)
  if (naver?.link) sameAs.push(naver.link)

  return {
    displayName,
    kakaoPlaceId: kakao?.id,
    googlePlaceId: google?.placeId,
    naverLink: naver?.link,
    roadAddress,
    jibunAddress,
    latitude,
    longitude,
    phone,
    rating,
    reviewCount,
    kakaoCategory: kakao?.categoryName,
    naverCategory: naver?.category,
    sources: group.map(g => g.source),
    sameAs,
    raw: { kakao, google, naver },
  }
}

/** 3-Source 결과를 받아 dedup + merge → MergedCandidate[]. */
export function mergeCandidates(input: {
  kakao?: KakaoPlaceResult[]
  google?: PlaceSearchResult[]
  naver?: NaverPlaceResult[]
}): MergedCandidate[] {
  const all: NormalizedInput[] = [
    ...(input.kakao ?? []).map(normalizeKakao),
    ...(input.google ?? []).map(normalizeGoogle),
    ...(input.naver ?? []).map(normalizeNaver),
  ]
  if (all.length === 0) return []

  // 그룹핑: 기존 그룹 중 isSameBusiness 하나라도 true 면 거기 합류
  const groups: NormalizedInput[][] = []
  for (const item of all) {
    let placed = false
    for (const group of groups) {
      if (group.some(g => isSameBusiness(g.business, item.business))) {
        // 같은 소스 중복 제거: 이미 해당 소스가 있으면 먼저 온 것 유지
        if (!group.some(g => g.source === item.source)) group.push(item)
        placed = true
        break
      }
    }
    if (!placed) groups.push([item])
  }

  return groups.map(buildMerged)
}
