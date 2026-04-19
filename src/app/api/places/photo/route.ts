// Google Places Photos 프록시 — API 키 노출 없이 브라우저에서 이미지 표시.
// 사용: <img src="/api/places/photo?ref=places/{PLACE_ID}/photos/{PHOTO_ID}&w=800" />

import { NextResponse, type NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://places.googleapis.com/v1'

export async function GET(req: NextRequest) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_PLACES_API_KEY unset' }, { status: 500 })
  }

  const ref = req.nextUrl.searchParams.get('ref')
  const widthRaw = req.nextUrl.searchParams.get('w') ?? '800'
  const width = Math.max(100, Math.min(2400, parseInt(widthRaw, 10) || 800))

  // ref 는 "places/{PLACE_ID}/photos/{PHOTO_ID}" 형태만 허용.
  if (!ref || !/^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(ref)) {
    return NextResponse.json({ error: 'invalid ref' }, { status: 400 })
  }

  try {
    const upstream = `${BASE_URL}/${ref}/media?maxWidthPx=${width}&key=${apiKey}`
    const res = await fetch(upstream, { redirect: 'follow' })
    if (!res.ok) {
      return NextResponse.json({ error: `upstream ${res.status}` }, { status: res.status })
    }
    const ctype = res.headers.get('content-type') ?? 'image/jpeg'
    const buf = await res.arrayBuffer()
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': ctype,
        // 캐시 — Google 사진은 같은 ref 면 동일 이미지. 1일 캐시.
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (err) {
    console.error('[/api/places/photo] fetch failed:', err)
    return NextResponse.json({ error: 'fetch_failed' }, { status: 502 })
  }
}
