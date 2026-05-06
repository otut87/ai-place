import { getAllPlaces, getCities, getCategories } from '@/lib/data.supabase'
import { getRecentBlogPosts } from '@/lib/blog/data.supabase'

// ISR — 1시간마다 자동 재생성. 블로그 발행 액션의
// revalidatePath('/feed.xml') 로 on-demand 갱신도 함께 작동.
export const revalidate = 3600

// Phase 2 / P1-2 (codex review 2026-04-30) — 블로그 글도 RSS item 으로 포함.
//   기존엔 업체 상세만 노출되어 GEO/AEO 핵심 자산인 블로그가 freshness 채널에서 누락.
//   블로그 발행 액션이 이미 revalidatePath('/feed.xml') 호출 중인데 정작 피드에 글이
//   없던 의도/구현 불일치 해소.
const BLOG_FEED_LIMIT = 50

export async function GET() {
  const [places, cities, categories, blogPosts] = await Promise.all([
    getAllPlaces(),
    getCities(),
    getCategories(),
    getRecentBlogPosts(BLOG_FEED_LIMIT),
  ])
  const baseUrl = 'https://aiplace.kr'

  // T-259 R5 — 모든 item 의 pubDate 를 콘텐츠 자체의 timestamp 로.
  //   - place: lastUpdated
  //   - blog: publishedAt
  // 이전엔 모든 item 에 동일한 now() 를 박아 reader/검색엔진이 freshness 신뢰 약화.
  const fallbackPubDate = new Date().toUTCString()
  const toUtc = (iso: string | null | undefined): string => {
    if (!iso) return fallbackPubDate
    const ms = Date.parse(iso)
    return Number.isFinite(ms) ? new Date(ms).toUTCString() : fallbackPubDate
  }

  // 통합 정렬 — places · blog 합쳐서 최신순. lastBuildDate 는 max.
  type FeedItem = { title: string; link: string; description: string; pubDateIso: string | null }
  const placeItems: FeedItem[] = places.map(place => {
    const cityObj = cities.find(c => c.slug === place.city)
    const catObj = categories.find(c => c.slug === place.category)
    return {
      title: `${place.name} - ${cityObj?.name ?? place.city} ${catObj?.name ?? place.category}`,
      link: `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
      description: place.description,
      pubDateIso: place.lastUpdated ?? null,
    }
  })
  const blogItems: FeedItem[] = blogPosts.map(post => ({
    title: post.title,
    link: `${baseUrl}/blog/${post.city}/${post.sector}/${post.slug}`,
    description: post.summary,
    pubDateIso: post.publishedAt,
  }))
  const merged: FeedItem[] = [...placeItems, ...blogItems].sort((a, b) =>
    (b.pubDateIso ?? '').localeCompare(a.pubDateIso ?? ''),
  )
  const lastBuildDate = merged[0]?.pubDateIso ? toUtc(merged[0].pubDateIso) : fallbackPubDate

  const items = merged.map(it => `    <item>
      <title>${escapeXml(it.title)}</title>
      <link>${it.link}</link>
      <description>${escapeXml(it.description)}</description>
      <pubDate>${toUtc(it.pubDateIso)}</pubDate>
      <guid>${it.link}</guid>
    </item>`)

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
