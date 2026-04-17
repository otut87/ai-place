// 네이버 지역검색 + 카카오 키워드 장소검색 API
// 업체 등록 시 sameAs URL 자동 조회용

// ESM 호이스팅 대비: env 접근은 함수 내부에서만.
// (scripts 가 @next/env 를 먼저 호출하는 구조 지원)

export interface NaverPlaceResult {
  title: string
  link: string       // 네이버 플레이스 검색 URL (고유 URL은 API 미제공)
  address: string
}

export interface KakaoPlaceResult {
  placeName: string
  placeUrl: string   // 카카오맵 URL
  address: string
}

/** 네이버 지역검색 — 업체명으로 네이버 플레이스 URL 조회 */
export async function searchNaverPlace(query: string): Promise<NaverPlaceResult | null> {
  const clientId = process.env.NAVER_CLIENT_ID ?? ''
  const clientSecret = process.env.NAVER_CLIENT_SECRET ?? ''
  if (!clientId || !clientSecret) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1`,
      {
        headers: {
          'X-Naver-Client-Id': clientId,
          'X-Naver-Client-Secret': clientSecret,
        },
        signal: controller.signal,
      },
    )
    clearTimeout(timeout)

    if (!res.ok) return null

    const data = await res.json()
    const item = data.items?.[0]
    if (!item) return null

    // 네이버 지역검색 API의 link는 업체 외부 홈페이지이므로,
    // 네이버 플레이스 검색 URL을 생성하여 반환
    const cleanTitle = item.title.replace(/<[^>]+>/g, '')
    return {
      title: cleanTitle,
      link: `https://m.place.naver.com/place/search/${encodeURIComponent(cleanTitle)}`,
      address: item.roadAddress ?? item.address ?? '',
    }
  } catch {
    return null
  }
}

/** 카카오 키워드 장소검색 — 업체명으로 카카오맵 URL 조회 */
export async function searchKakaoPlace(query: string): Promise<KakaoPlaceResult | null> {
  const kakaoKey = process.env.KAKAO_REST_KEY ?? ''
  if (!kakaoKey) return null

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`,
      {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
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
