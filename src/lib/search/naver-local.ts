// Naver Local Search API 클라이언트 (T-013)
// https://openapi.naver.com/v1/search/local.json
//
// 인증 헤더: X-Naver-Client-Id, X-Naver-Client-Secret
// display 최대 5 (API 제약)
// mapx/mapy: 정수 (실제 좌표 × 1e7). 1e7 로 나눠 degree 로 변환.

export interface NaverPlaceResult {
  title: string                 // <b> 태그 제거
  link: string
  category: string              // "피부과" 등 단일 문자열
  description: string
  telephone: string | null
  address: string               // 지번
  roadAddress: string | null
  longitude: number
  latitude: number
  raw: unknown
}

interface NaverItem {
  title: string
  link: string
  category: string
  description: string
  telephone?: string
  address: string
  roadAddress?: string
  mapx: string
  mapy: string
}

const ENDPOINT = 'https://openapi.naver.com/v1/search/local.json'
const COORD_SCALE = 1e7

function stripHtml(s: string): string {
  // <b> 태그 및 HTML 엔티티 디코드
  return s
    .replace(/<\/?b>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function toCoordinate(raw: string): number {
  const n = Number(raw)
  if (!Number.isFinite(n)) return 0
  // 정수형(1271199000) → degree (127.1199)
  return Math.abs(n) > 1000 ? n / COORD_SCALE : n
}

export async function naverLocalSearch(
  query: string,
  opts: { display?: number } = {},
): Promise<NaverPlaceResult[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.warn('[naver-local] NAVER_CLIENT_ID/SECRET 미설정 — 검색 스킵')
    return []
  }

  const display = Math.max(1, Math.min(5, opts.display ?? 5))
  const url = `${ENDPOINT}?query=${encodeURIComponent(trimmed)}&display=${display}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })
    if (!res.ok) {
      console.error(`[naver-local] HTTP ${res.status} ${res.statusText}`)
      return []
    }
    const data = (await res.json()) as { items?: NaverItem[] }
    const items = data.items ?? []
    return items.map(it => ({
      title: stripHtml(it.title),
      link: it.link,
      category: it.category,
      description: stripHtml(it.description ?? ''),
      telephone: it.telephone && it.telephone.trim() ? it.telephone : null,
      address: it.address,
      roadAddress: it.roadAddress || null,
      longitude: toCoordinate(it.mapx),
      latitude: toCoordinate(it.mapy),
      raw: it,
    }))
  } catch (err) {
    console.error('[naver-local] 요청 실패:', err)
    return []
  }
}
