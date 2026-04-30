import { getAllPlaces, getCities, getCategories } from '@/lib/data.supabase'

// ISR — 1시간마다 자동 재생성. 블로그 발행 액션의
// revalidatePath('/feed.xml') 로 on-demand 갱신도 함께 작동.
export const revalidate = 3600

export async function GET() {
  const places = await getAllPlaces()
  const cities = await getCities()
  const categories = await getCategories()
  const baseUrl = 'https://aiplace.kr'

  // T-259 R5 — pubDate 를 place 별 lastUpdated 로. lastBuildDate 는 max(lastUpdated).
  //   이전엔 모든 item 에 동일한 now() 를 박아 reader/검색엔진이 freshness 신뢰 약화.
  const sorted = [...places].sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''))
  const fallbackPubDate = new Date().toUTCString()
  const toUtc = (iso: string | null | undefined): string => {
    if (!iso) return fallbackPubDate
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? new Date(ms).toUTCString() : fallbackPubDate
  }
  const lastBuildDate = sorted[0]?.lastUpdated ? toUtc(sorted[0].lastUpdated) : fallbackPubDate

  const items = sorted.map(place => {
    const cityObj = cities.find(c => c.slug === place.city)
    const catObj = categories.find(c => c.slug === place.category)
    return `    <item>
      <title>${escapeXml(place.name)} - ${cityObj?.name ?? place.city} ${catObj?.name ?? place.category}</title>
      <link>${baseUrl}/${place.city}/${place.category}/${place.slug}</link>
      <description>${escapeXml(place.description)}</description>
      <pubDate>${toUtc(place.lastUpdated)}</pubDate>
      <guid>${baseUrl}/${place.city}/${place.category}/${place.slug}</guid>
    </item>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Place — AI가 추천하는 우리 동네 업체</title>
    <link>${baseUrl}</link>
    <description>ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요.</description>
    <language>ko</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
