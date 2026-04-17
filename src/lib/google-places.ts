// Google Places API (New) — Place Details + Photos
// 문서: https://developers.google.com/maps/documentation/places/web-service/place-details

const BASE_URL = 'https://places.googleapis.com/v1'

// ESM 호이스팅 대비: scripts 가 @next/env 를 먼저 호출할 수 있도록
// 환경변수 접근을 함수 내부로 지연시킨다.
function getApiKey(): string {
  return process.env.GOOGLE_PLACES_API_KEY ?? ''
}

export interface PlaceDetailsResult {
  name: string
  nameEn?: string
  rating: number
  reviewCount: number
  phone?: string
  websiteUri?: string
  openingHours?: string[]
  editorialSummary?: string
  reviews: Array<{
    text: string
    rating: number
    relativeTime: string
  }>
  photoRefs: string[]
  googleMapsUri?: string
}

/** Place Details API (New) 호출 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const fields = 'displayName,rating,userRatingCount,reviews,photos,googleMapsUri,nationalPhoneNumber,websiteUri,regularOpeningHours,editorialSummary'
  const url = `${BASE_URL}/places/${placeId}?fields=${fields}&languageCode=ko`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(url, {
      headers: { 'X-Goog-Api-Key': getApiKey() },
      signal: controller.signal,
    })
    clearTimeout(timeout)
    if (!res.ok) {
      console.error(`Google Places API error ${res.status}: ${await res.text()}`)
      return null
    }

    const data = await res.json()

    // 영문 이름 별도 조회
    let nameEn: string | undefined
    try {
      const enUrl = `${BASE_URL}/places/${placeId}?fields=displayName&languageCode=en`
      const enRes = await fetch(enUrl, { headers: { 'X-Goog-Api-Key': getApiKey() } })
      if (enRes.ok) {
        const enData = await enRes.json()
        nameEn = enData.displayName?.text
      }
    } catch { /* 영문 이름 조회 실패는 무시 */ }

    return {
      name: data.displayName?.text ?? '',
      nameEn,
      rating: data.rating ?? 0,
      reviewCount: data.userRatingCount ?? 0,
      phone: data.nationalPhoneNumber ?? undefined,
      websiteUri: data.websiteUri ?? undefined,
      openingHours: data.regularOpeningHours?.weekdayDescriptions ?? undefined,
      editorialSummary: data.editorialSummary?.text ?? undefined,
      reviews: (data.reviews ?? []).map((r: { text?: { text?: string }; rating?: number; relativePublishTimeDescription?: string }) => ({
        text: r.text?.text ?? '',
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? '',
      })),
      photoRefs: (data.photos ?? []).map((p: { name?: string }) => p.name ?? ''),
      googleMapsUri: data.googleMapsUri ?? undefined,
    }
  } catch (err) {
    console.error('Google Places API fetch failed:', err)
    return null
  }
}

/** Text Search API (New) — 업체명으로 검색 */
export interface PlaceSearchResult {
  placeId: string
  name: string
  address: string
  rating?: number
  reviewCount?: number
  latitude?: number
  longitude?: number
}

export async function searchPlaceByText(query: string): Promise<PlaceSearchResult[] | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': getApiKey(),
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        textQuery: query,
        languageCode: 'ko',
        regionCode: 'KR',
        maxResultCount: 5,
      }),
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.error(`Google Places Text Search error ${res.status}: ${await res.text()}`)
      return null
    }

    const data = await res.json()
    const places = data.places ?? []

    return places.map((p: {
      id?: string
      displayName?: { text?: string }
      formattedAddress?: string
      rating?: number
      userRatingCount?: number
      location?: { latitude?: number; longitude?: number }
    }) => ({
      placeId: p.id ?? '',
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? '',
      rating: p.rating,
      reviewCount: p.userRatingCount,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
    }))
  } catch (err) {
    console.error('[google-places] searchPlaceByText failed:', err)
    return null
  }
}

/**
 * Photo URL 생성 (Places API New)
 * WARNING: 서버 사이드에서만 사용할 것. 클라이언트에 반환하면 API 키 노출됨.
 * 클라이언트에 이미지를 제공하려면 API route를 통해 프록시할 것.
 */
export function getPhotoUrl(photoRef: string, maxWidth = 400): string {
  if (typeof window !== 'undefined') {
    throw new Error('getPhotoUrl은 서버에서만 호출 가능합니다. API 키 노출 위험.')
  }
  return `${BASE_URL}/${photoRef}/media?maxWidthPx=${maxWidth}&key=${getApiKey()}`
}
