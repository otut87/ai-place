// 업체 중복 판정 로직 (T-014)
// 1) roadAddress 정규화 동일 → same
// 2) 좌표 ≤50m + 이름 유사도 ≥0.6 → same
// 3) 둘 다 없음 → false

import { normalizeAddress } from '@/lib/format/address'
import { distanceMeters } from '@/lib/search/google-match'

export interface BusinessLike {
  name?: string
  roadAddress?: string | null
  jibunAddress?: string | null
  latitude?: number
  longitude?: number
}

const COORD_THRESHOLD_M = 50
const COORD_EXACT_M = 10 // 거의 동일 좌표 (건물 단위) — 이름 언어 차이 허용
const NAME_SIMILARITY_THRESHOLD = 0.6

/**
 * 주소 정규화 (매칭 전용) — region 약어 + 공백 축약 + 건물명/층 제거.
 * "충청남도 천안시 서북구 불당25로 32 연세나무스퀘어 2층" → "충남천안시서북구불당25로32"
 */
export function normalizeAddressForMatch(raw: string | null | undefined): string {
  if (!raw) return ''
  // Google Places 가 반환하는 영어 prefix 제거
  const withoutCountry = raw
    .replace(/^(Republic of Korea|South Korea|Korea|대한민국)[,\s]+/i, '')
    .replace(/,\s*Korea$/i, '')
    .replace(/\s*\d{5}\s*,?/g, '') // 우편번호 제거
  const normalized = normalizeAddress(withoutCountry)
    .replace(/\s+\d+층.*$/, '')
    .replace(/\s+[가-힣]+(빌딩|타워|스퀘어|아파트|프라자|몰|센터)(\s|$)/, ' ')
    .replace(/\s/g, '')
  return normalized.toLowerCase()
}

/** 두 이름이 서로 다른 스크립트(한글 vs 라틴)인지 — cross-language business name 대응 */
function isCrossScript(a: string, b: string): boolean {
  const hasHangul = (s: string) => /[\uAC00-\uD7AF]/.test(s)
  const hasLatin = (s: string) => /[A-Za-z]/.test(s)
  const aHan = hasHangul(a)
  const bHan = hasHangul(b)
  const aLat = hasLatin(a) && !aHan
  const bLat = hasLatin(b) && !bHan
  return (aHan && bLat) || (aLat && bHan)
}

/** Dice coefficient — 2-gram 기반. 0~1. */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const bigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const pair = s.slice(i, i + 2)
      map.set(pair, (map.get(pair) ?? 0) + 1)
    }
    return map
  }
  const x = bigrams(a)
  const y = bigrams(b)
  if (x.size === 0 || y.size === 0) return 0
  let intersection = 0
  for (const [k, v] of x) {
    const other = y.get(k)
    if (other) intersection += Math.min(v, other)
  }
  return (2 * intersection) / (x.size + y.size)
}

export function isSameBusiness(a: BusinessLike, b: BusinessLike): boolean {
  const addrA = normalizeAddressForMatch(a.roadAddress ?? a.jibunAddress)
  const addrB = normalizeAddressForMatch(b.roadAddress ?? b.jibunAddress)
  const addressMatch = Boolean(addrA && addrB && addrA === addrB)

  const canUseCoord =
    a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null
  const coordDist = canUseCoord
    ? distanceMeters(a.latitude!, a.longitude!, b.latitude!, b.longitude!)
    : Infinity
  const coordClose = coordDist <= COORD_THRESHOLD_M
  const coordExact = coordDist <= COORD_EXACT_M

  // 주소 동일 + 좌표 거의 일치 + 이름이 서로 다른 스크립트(한↔영) → same
  // (Google 이 "Chaandpark Dermatology" 로 영어 반환하는 케이스)
  if (addressMatch && coordExact && a.name && b.name && isCrossScript(a.name, b.name)) {
    return true
  }

  // 주소 동일 + 좌표 사용 가능 → 이름 유사해야 same (같은 건물 다른 층/호 구분)
  if (addressMatch && canUseCoord && a.name && b.name) {
    return stringSimilarity(a.name, b.name) >= NAME_SIMILARITY_THRESHOLD
  }

  // 주소 동일 + 좌표 불가(혹은 이름 불완전) → 방어적 same (정보 부족 시 병합 우선)
  if (addressMatch) return true

  // 주소 동일 + 좌표 불가 → 방어적 same (정보 부족 시 병합 우선)
  if (addressMatch) return true

  // 주소 불일치 but 좌표 가까움 + 이름 유사
  if (coordClose && a.name && b.name) {
    return stringSimilarity(a.name, b.name) >= NAME_SIMILARITY_THRESHOLD
  }
  return false
}
