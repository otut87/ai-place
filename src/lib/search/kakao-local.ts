// Kakao Local Search — Keyword API 클라이언트 (T-011)
// https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-keyword
//
// 인증: Authorization: KakaoAK {KAKAO_REST_KEY}
// x = longitude (경도), y = latitude (위도) — Kakao 좌표계 convention

export interface KakaoPlaceResult {
  id: string
  placeName: string
  addressName: string
  roadAddressName: string | null
  phone: string | null
  categoryName: string              // "의료,건강 > 병원 > 피부과"
  categoryGroupCode: string | null  // "HP8" 등
  longitude: number
  latitude: number
  placeUrl: string
  raw: unknown                      // 원본 응답 (디버깅/merge 용)
}

interface KakaoDocument {
  id: string
  place_name: string
  address_name: string
  road_address_name?: string
  phone?: string
  category_name: string
  category_group_code?: string
  x: string
  y: string
  place_url: string
}

const ENDPOINT = 'https://dapi.kakao.com/v2/local/search/keyword.json'

function toNumber(s: string | undefined, fallback = 0): number {
  const n = Number(s)
  return Number.isFinite(n) ? n : fallback
}

/** Kakao 카테고리 키워드 검색. 실패 시 빈 배열. */
export async function kakaoLocalSearch(
  query: string,
  opts: { size?: number } = {},
): Promise<KakaoPlaceResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const key = process.env.KAKAO_REST_KEY
  if (!key) {
    console.warn('[kakao-local] KAKAO_REST_KEY 미설정 — 검색 스킵')
    return []
  }

  const size = Math.max(1, Math.min(15, opts.size ?? 15))
  const url = `${ENDPOINT}?query=${encodeURIComponent(trimmed)}&size=${size}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` },
    })
    if (!res.ok) {
      console.error(`[kakao-local] HTTP ${res.status} ${res.statusText}`)
      return []
    }
    const data = (await res.json()) as { documents?: KakaoDocument[] }
    const docs = data.documents ?? []
    return docs.map(d => ({
      id: d.id,
      placeName: d.place_name,
      addressName: d.address_name,
      roadAddressName: d.road_address_name || null,
      phone: d.phone || null,
      categoryName: d.category_name,
      categoryGroupCode: d.category_group_code || null,
      longitude: toNumber(d.x),
      latitude: toNumber(d.y),
      placeUrl: d.place_url,
      raw: d,
    }))
  } catch (err) {
    console.error('[kakao-local] 요청 실패:', err)
    return []
  }
}
