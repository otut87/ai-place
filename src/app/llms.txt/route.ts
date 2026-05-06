import { NextResponse } from 'next/server'
import { getCities, getCategories, getSectors, getAllPlaces } from '@/lib/data.supabase'
import { getRecentBlogPosts } from '@/lib/blog/data.supabase'

// T-263: ISR 1시간. 매 요청 전체 places·blog 재계산을 차단. 신규 업체/글 발행 시
// publish 액션이 revalidatePath('/llms.txt') 호출하면 즉시 갱신.
export const revalidate = 3600

// T-263: llmstxt.org 권장 구조 — "사이트 entrypoint + hub 링크". 개별 업체·글 dump 는
// sitemap.xml / feed.xml 로 위임. 안정적인 카테고리 hub 만 노출하므로 도시·업체 수가
// 늘어도 문서 크기·생성 비용이 선형적으로만 증가.
const RECENT_BLOG_LIMIT = 30

export async function GET() {
  const cities = await getCities()
  const categories = await getCategories()
  const sectors = await getSectors()
  const allPlaces = await getAllPlaces()
  const blogPosts = await getRecentBlogPosts(RECENT_BLOG_LIMIT)

  // 활성 카테고리 = 1개 이상 업체 등록된 city/category 조합. 빈 카테고리는 thin content
  // 회피 차원에서 hub 노출 안 함 (sitemap 도 동일 정책).
  const placeCountByHub = new Map<string, number>()
  for (const p of allPlaces) {
    const key = `${p.city}/${p.category}`
    placeCountByHub.set(key, (placeCountByHub.get(key) ?? 0) + 1)
  }

  const baseUrl = 'https://aiplace.kr'

  let text = `# AI Place\n\n> AI가 추천하는 로컬 업체 디렉토리\n\n`
  text += `AI Place는 ChatGPT, Claude, Gemini 등 AI 검색 엔진에서 추천되는 한국 로컬 업체 정보를 구조화된 형태로 제공하는 디렉토리 서비스입니다.\n\n`

  // Authoritative indexes — LLM 이 전체 corpus 를 따라갈 entrypoint.
  text += `## 인덱스\n\n`
  text += `- [전체 사이트맵](${baseUrl}/sitemap.xml) — 모든 페이지 URL + lastModified\n`
  text += `- [RSS 피드](${baseUrl}/feed.xml) — 최신 업체·블로그\n`
  text += `- [robots.txt](${baseUrl}/robots.txt) — 크롤러 정책\n\n`

  // Sector overview — 안정적 요약 (도시 추가에도 거의 변하지 않음).
  text += `## 업종 분류 (${sectors.length}개 대분류)\n\n`
  for (const sector of sectors) {
    const sectorCats = categories.filter(c => c.sector === sector.slug)
    const activeCats = sectorCats.filter(c =>
      cities.some(city => placeCountByHub.has(`${city.slug}/${c.slug}`))
    )
    if (activeCats.length > 0) {
      text += `- ${sector.name} (${sector.nameEn}): ${activeCats.length}개 업종 활성\n`
    }
  }

  // Hub 링크만 노출. 개별 업체는 hub 페이지 또는 sitemap 따라가도록 위임.
  text += `\n## 활성 카테고리 페이지\n\n`
  for (const city of cities) {
    for (const cat of categories) {
      const count = placeCountByHub.get(`${city.slug}/${cat.slug}`)
      if (!count) continue
      text += `- [${city.name} ${cat.name} (${count}곳)](${baseUrl}/${city.slug}/${cat.slug})\n`
    }
  }

  // 블로그 hub + 최근 글 요약 (전체 dump 아님). 도시·섹터별 sub-hub 도 함께 노출.
  text += `\n## 블로그\n\n`
  text += `- [블로그 홈](${baseUrl}/blog) — 가이드·비교·키워드 글 통합\n`
  for (const city of cities) {
    if (blogPosts.some(p => p.city === city.slug)) {
      text += `- [${city.name} 블로그](${baseUrl}/blog/${city.slug})\n`
    }
  }
  if (blogPosts.length > 0) {
    text += `\n### 최근 발행 (${blogPosts.length}편)\n\n`
    const typeLabel: Record<string, string> = {
      keyword: '키워드', compare: '비교', guide: '가이드', general: '일반',
    }
    for (const post of blogPosts) {
      text += `- [${post.title}](${baseUrl}/blog/${post.city}/${post.sector}/${post.slug}) — ${typeLabel[post.postType] ?? ''}: ${post.summary.slice(0, 80)}\n`
    }
  }

  // Data format
  text += `\n## 데이터 형식\n\n`
  text += `모든 페이지는 Schema.org JSON-LD 구조화 데이터를 포함합니다:\n`
  text += `- LocalBusiness (MedicalClinic, BeautySalon, Restaurant 등 업종별 서브타입)\n`
  text += `- BreadcrumbList (3단계 계층)\n`
  text += `- ItemList (목록 페이지)\n`
  text += `- Article (비교/가이드 페이지)\n\n`
  text += `## 연락처\n\n- 웹사이트: ${baseUrl}\n- 이메일: support@aiplace.kr\n`

  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // ISR 외 CDN edge / 크롤러 캐시도 명시 — Vercel 의 s-maxage = 1h, stale-while-revalidate = 24h.
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}
