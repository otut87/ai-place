// Google Places API (New) — Place Details + Photos
// 문서: https://developers.google.com/maps/documentation/places/web-service/place-details

const API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ''
const BASE_URL = 'https://places.googleapis.com/v1'

export interface PlaceDetailsResult {
  name: string
  rating: number
  reviewCount: number
  reviews: Array<{
    text: string
    rating: number
    relativeTime: string
  }>
  photoRefs: string[]
}

/** Place Details API (New) 호출 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetailsResult | null> {
  const fields = 'displayName,rating,userRatingCount,reviews,photos'
  const url = `${BASE_URL}/places/${placeId}?fields=${fields}&languageCode=ko`

  try {
    const res = await fetch(url, {
      headers: { 'X-Goog-Api-Key': API_KEY },
    })
    if (!res.ok) {
      console.error(`Google Places API error ${res.status}: ${await res.text()}`)
      return null
    }

    const data = await res.json()

    return {
      name: data.displayName?.text ?? '',
      rating: data.rating ?? 0,
      reviewCount: data.userRatingCount ?? 0,
      reviews: (data.reviews ?? []).map((r: { text?: { text?: string }; rating?: number; relativePublishTimeDescription?: string }) => ({
        text: r.text?.text ?? '',
        rating: r.rating ?? 0,
        relativeTime: r.relativePublishTimeDescription ?? '',
      })),
      photoRefs: (data.photos ?? []).map((p: { name?: string }) => p.name ?? ''),
    }
  } catch (err) {
    console.error('Google Places API fetch failed:', err)
    return null
  }
}

/** Photo URL 생성 (Places API New) */
export function getPhotoUrl(photoRef: string, maxWidth = 400): string {
  return `${BASE_URL}/${photoRef}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`
}
