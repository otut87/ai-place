// Google Places 매칭 보강 (T-012)
// Kakao/Naver 에서 찾은 업체를 Google 쪽에서 좌표 근접도(≤50m)로 매칭.

import { searchPlaceByText, type PlaceSearchResult } from '@/lib/google-places'

const EARTH_RADIUS_M = 6_371_000
const MATCH_THRESHOLD_M = 50

/** Haversine — 두 위도/경도 사이 거리(m). */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * "{name} {address}" 로 Google Text Search → 기준 좌표와 50m 이내 첫 결과 반환.
 * 기준 좌표 미지정 시 첫 결과 그대로.
 * 실패/미매칭 시 null.
 */
export async function matchGooglePlaceByAddress(
  name: string,
  address: string,
  base?: { latitude: number; longitude: number },
): Promise<PlaceSearchResult | null> {
  const query = `${name} ${address}`.trim()
  if (!query) return null

  const results = await searchPlaceByText(query)
  if (!results || results.length === 0) return null

  if (!base) return results[0]

  for (const candidate of results) {
    if (candidate.latitude == null || candidate.longitude == null) continue
    const d = distanceMeters(base.latitude, base.longitude, candidate.latitude, candidate.longitude)
    if (d <= MATCH_THRESHOLD_M) return candidate
  }
  return null
}
