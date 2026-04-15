// 네이버 지역검색 + 카카오 키워드 장소검색 API
// 업체 등록 시 sameAs URL 자동 조회용

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID ?? ''
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET ?? ''
const KAKAO_REST_KEY = process.env.KAKAO_REST_KEY ?? ''

export interface NaverPlaceResult {
  title: string
  link: string       // 네이버 플레이스 URL
  address: string
}

export interface KakaoPlaceResult {
  placeName: string
  placeUrl: string   // 카카오맵 URL
  address: string
}

/** 네이버 지역검색 — 업체명으로 네이버 플레이스 URL 조회 */
export async function searchNaverPlace(query: string): Promise<NaverPlaceResult | null> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': NAVER_CLIENT_ID,
          'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
        },
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null

    return {
      title: item.title.replace(/<[^>]+>/g, ''),
      link: item.link ?? '',
      address: item.roadAddress ?? item.address ?? '',
    }
  } catch {
    return null
  }
}

/** 카카오 키워드 장소검색 — 업체명으로 카카오맵 URL 조회 */
export async function searchKakaoPlace(query: string): Promise<KakaoPlaceResult | null> {
  if (!KAKAO_REST_KEY) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` },
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const item = data.documents?.[0]
    if (!item) return null

    return {
      placeName: item.place_name ?? '',
      placeUrl: item.place_url ?? '',
      address: item.road_address_name ?? item.address_name ?? '',
    }
  } catch {
    return null
  }
}
