// T-106 — 커스텀 404. 철학 10% UI 비중 내 최소 구현. 애니메이션·일러스트 금지.
// 사용자가 브레드크럼 오타 URL 등에 떨어져도 홈·도시·카테고리로 복귀 가능.

import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { getCities, getSectors, getCategories, getAllPlaces } from '@/lib/data.supabase'
import { composePageTitle } from '@/lib/seo/compose-title'

export const metadata: Metadata = {
  title: composePageTitle('페이지를 찾을 수 없습니다'),
  robots: { index: false, follow: true },
}

export default async function NotFound() {
  const [cities, sectors, categories, places] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
  ])

  const activeCitySlugs = new Set(places.map(p => p.city))
  const activeCategorySlugs = new Set(places.map(p => p.category))
  const featuredCities = cities.filter(c => activeCitySlugs.has(c.slug))
  // 섹터별 대표 카테고리 하나씩만 노출 (간결)
  const featuredCategoriesBySector = sectors.map(sec => ({
    sector: sec,
    categories: categories
      .filter(c => c.sector === sec.slug && activeCategorySlugs.has(c.slug))
      .slice(0, 4),
  })).filter(g => g.categories.length > 0)

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-6 py-20">
        <h1 className="text-[32px] font-bold text-[#1a1a1a]">페이지를 찾을 수 없습니다</h1>
        <p className="mt-4 text-base text-[#444] leading-relaxed">
          찾으시는 주소가 삭제됐거나 오타가 있을 수 있습니다. 아래에서 원하시는 업종·도시로 이동해 주세요.
        </p>

        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center rounded-lg bg-[#1a1a1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#333]"
          >
            홈으로 이동
          </Link>
        </div>

        {featuredCities.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">도시</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {featuredCities.map(c => (
                <li key={c.slug}>
                  <Link
                    href={`/${c.slug}`}
                    className="rounded-full border border-[#e0e0e0] px-3 py-1 text-sm text-[#1a1a1a] hover:bg-[#f7f7f7]"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {featuredCategoriesBySector.length > 0 && (
          <section className="mt-10 space-y-6">
            <h2 className="text-lg font-semibold text-[#1a1a1a]">업종</h2>
            {featuredCategoriesBySector.map(g => (
              <div key={g.sector.slug}>
                <h3 className="text-sm font-medium text-[#444]">{g.sector.name}</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {g.categories.map(cat => {
                    // 카테고리가 존재하는 도시 하나를 선택 (천안 기본)
                    const firstCity = Array.from(activeCitySlugs)[0] ?? 'cheonan'
                    return (
                      <li key={cat.slug}>
                        <Link
                          href={`/${firstCity}/${cat.slug}`}
                          className="rounded-full border border-[#e0e0e0] px-3 py-1 text-xs text-[#444] hover:bg-[#f7f7f7]"
                        >
                          {cat.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </section>
        )}
      </main>
      <Footer />
    </>
  )
}
