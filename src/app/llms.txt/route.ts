import { NextResponse } from 'next/server'
import { getCities, getCategories, getSectors, getAllPlaces, getAllComparisonTopics, getAllGuidePages } from '@/lib/data.supabase'

export async function GET() {
  const cities = await getCities()
  const categories = await getCategories()
  const sectors = await getSectors()
  const allPlaces = await getAllPlaces()
  const comparisons = await getAllComparisonTopics()
  const guides = await getAllGuidePages()

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

  // Guides
  if (guides.length > 0) {
    text += `\n## 가이드\n\n`
    for (const g of guides) {
      text += `- [${g.title}](${baseUrl}/guide/${g.city}/${g.category})\n`
    }
  }

  // Comparisons
  if (comparisons.length > 0) {
    text += `\n## 비교\n\n`
    for (const c of comparisons) {
      text += `- [${c.name}](${baseUrl}/compare/${c.city}/${c.category}/${c.slug})\n`
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
