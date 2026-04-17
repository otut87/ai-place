import { NextResponse } from 'next/server'
import { getCities, getCategories, getSectors, getAllPlaces } from '@/lib/data.supabase'
import { getRecentBlogPosts } from '@/lib/blog/data.supabase'

export async function GET() {
  const cities = await getCities()
  const categories = await getCategories()
  const sectors = await getSectors()
  const allPlaces = await getAllPlaces()
  const blogPosts = await getRecentBlogPosts(50)

  const activeCategoryKeys = new Set(allPlaces.map(p => `${p.city}/${p.category}`))
  const baseUrl = 'https://aiplace.kr'

  let text = `# AI Place\n\n> AI가 추천하는 로컬 업체 디렉토리\n\n`
  text += `AI Place는 ChatGPT, Claude, Gemini 등 AI 검색 엔진에서 추천되는 한국 로컬 업체 정보를 구조화된 형태로 제공하는 디렉토리 서비스입니다.\n\n`

  // Sector overview
  text += `## 업종 분류 (${sectors.length}개 대분류)\n\n`
  for (const sector of sectors) {
    const sectorCats = categories.filter(c => c.sector === sector.slug)
    const activeCats = sectorCats.filter(c =>
      cities.some(city => activeCategoryKeys.has(`${city.slug}/${c.slug}`))
    )
    if (activeCats.length > 0) {
      text += `- ${sector.name} (${sector.nameEn}): ${activeCats.length}개 업종 활성\n`
    }
  }

  // Active category pages
  text += `\n## 활성 카테고리 페이지\n\n`
  for (const city of cities) {
    for (const cat of categories) {
      if (!activeCategoryKeys.has(`${city.slug}/${cat.slug}`)) continue
      const count = allPlaces.filter(p => p.city === city.slug && p.category === cat.slug).length
      text += `- [${city.name} ${cat.name} (${count}곳)](${baseUrl}/${city.slug}/${cat.slug})\n`
    }
  }

  // Registered businesses
  text += `\n## 등록 업체 (${allPlaces.length}곳)\n\n`
  for (const place of allPlaces) {
    text += `- [${place.name}](${baseUrl}/${place.city}/${place.category}/${place.slug}): ${place.description?.slice(0, 80) ?? ''}\n`
  }

  // 블로그 (가이드/비교/키워드 통합 — T-010g 마이그레이션)
  if (blogPosts.length > 0) {
    text += `\n## 블로그 (${blogPosts.length}편)\n\n`
    text += `[블로그 홈](${baseUrl}/blog)\n\n`
    for (const post of blogPosts) {
      const typeLabel: Record<string, string> = {
        keyword: '키워드', compare: '비교', guide: '가이드', general: '일반',
      }
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
  text += `## 연락처\n\n- 웹사이트: ${baseUrl}\n- 이메일: support@dedo.kr\n`

  return new NextResponse(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
