// 커스텀 404 — paper/orange aip 톤 (T-233 리스킨).
// 사용자가 브레드크럼 오타 URL 등에 떨어져도 홈·도시·카테고리로 복귀 가능.
// 철학 10% UI 비중 내 최소 구현. 애니메이션·일러스트 금지.

import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { getCities, getSectors, getCategories, getAllPlaces } from '@/lib/data.supabase'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/legal-page.css'

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
  // 섹터별 대표 카테고리 4개씩만 노출 (간결)
  const featuredCategoriesBySector = sectors
    .map(sec => ({
      sector: sec,
      categories: categories
        .filter(c => c.sector === sec.slug && activeCategorySlugs.has(c.slug))
        .slice(0, 4),
    }))
    .filter(g => g.categories.length > 0)
  const firstCity = featuredCities[0]?.slug ?? cities[0]?.slug ?? 'cheonan'

  return (
    <div className="aip-root legal-page">
      <HomeNav />
      <main>
        <div className="legal-wrap">
          <h1 className="title">
            페이지를 <span className="it">찾을 수 없습니다</span>
          </h1>
          <p
            style={{
              fontSize: 16,
              color: 'var(--ink-2)',
              lineHeight: 1.65,
              maxWidth: '52ch',
              margin: '6px 0 0',
            }}
          >
            찾으시는 주소가 삭제됐거나 오타가 있을 수 있습니다. 아래에서 원하시는 업종·도시로 이동하세요.
          </p>

          <div className="nf-cta">
            <Link href="/" className="btn primary">
              홈으로 이동
            </Link>
            <Link href="/directory" className="btn ghost">
              디렉토리 전체
            </Link>
          </div>

          {featuredCities.length > 0 && (
            <section className="nf-section">
              <h2>도시</h2>
              <div className="nf-chips">
                {featuredCities.map(c => (
                  <Link key={c.slug} href={`/${c.slug}`}>
                    {c.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {featuredCategoriesBySector.length > 0 && (
            <section className="nf-section">
              <h2>업종</h2>
              {featuredCategoriesBySector.map(g => (
                <div className="nf-sector-group" key={g.sector.slug}>
                  <h3>{g.sector.name}</h3>
                  <div className="nf-chips">
                    {g.categories.map(cat => (
                      <Link key={cat.slug} href={`/${firstCity}/${cat.slug}`}>
                        {cat.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
