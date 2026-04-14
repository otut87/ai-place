import { getAllPlaces, getCities, getCategories } from '@/lib/data'

export async function GET() {
  const places = await getAllPlaces()
  const cities = await getCities()
  const categories = await getCategories()
  const now = new Date().toUTCString()
  const baseUrl = 'https://aiplace.kr'

  const items = places.map(place => {
    const cityObj = cities.find(c => c.slug === place.city)
    const catObj = categories.find(c => c.slug === place.category)
    return `    <item>
      <title>${escapeXml(place.name)} - ${cityObj?.name ?? place.city} ${catObj?.name ?? place.category}</title>
      <link>${baseUrl}/${place.city}/${place.category}/${place.slug}</link>
      <description>${escapeXml(place.description)}</description>
      <pubDate>${now}</pubDate>
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
    <lastBuildDate>${now}</lastBuildDate>
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
