// /[city] — 도시 허브 (T-249 paper/orange aip 리믹스).
// 통계 strip + cross-nav(다른 도시) + 섹터별 카테고리 그리드 + 도시 블로그 카드.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import {
  getCities,
  getSectors,
  getCategories,
  getAllPlaces,
} from '@/lib/data.supabase'
import { getRecentBlogPosts } from '@/lib/blog/data.supabase'
import { generateCollectionPage } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import { clampDirectAnswer } from '@/lib/seo/direct-answer'
import { safeJsonLd } from '@/lib/utils'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/city-hub-remix.css'

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ city: string }>
}

export async function generateStaticParams() {
  const cities = await getCities()
  return cities.map(c => ({ city: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  const cities = await getCities()
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) return {}
  const title = composePageTitle(`${cityObj.name} 로컬 업체 허브`)
  const url = `/${city}`
  const description = `${cityObj.name}의 업종별 로컬 업체를 AI 추천과 리뷰로 한눈에. 의료·뷰티·음식·교육·전문서비스 등.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function CityHubPage({ params }: Props) {
  const { city } = await params
  if (!SLUG_PATTERN.test(city)) notFound()

  const [cities, sectors, categories, places, blogs] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
    getRecentBlogPosts(50),
  ])
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) notFound()

  const cityPlaces = places.filter(p => p.city === city)
  const cityBlogs = blogs.filter(b => b.city === city)

  const activeCategoryKeys = new Set(cityPlaces.map(p => p.category))
  const countsByCategory = new Map<string, number>()
  for (const p of cityPlaces) {
    countsByCategory.set(p.category, (countsByCategory.get(p.category) ?? 0) + 1)
  }

  const activeSectors = sectors.filter(s =>
    categories.some(c => c.sector === s.slug && activeCategoryKeys.has(c.slug)),
  )

  const lastUpdated = cityBlogs[0]?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const pageUrl = `${BASE_URL}/${city}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: cityObj.name, url: pageUrl },
  ]

  const dab = clampDirectAnswer(
    `${cityObj.name}의 AI 추천 업체 ${cityPlaces.length}곳을 업종별로 모았습니다. 의료·뷰티·음식·교육·자동차 등.`,
  )

  return (
    <div className="aip-root">
      <HomeNav />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            generateCollectionPage({
              url: pageUrl,
              name: `${cityObj.name} 업체 허브`,
              description: dab,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(generateBreadcrumbList(breadcrumbItems)) }}
      />

      <main>
        {/* HEAD */}
        <header className="ch-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">{cityObj.name}</span>
            </nav>

            <div className="ch-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">City Hub · Live</span>
              <span>doc-id <b>aip-city-{city}</b></span>
              <span>·</span>
              <span>updated <b>{lastUpdated}</b></span>
              <span>·</span>
              <span>places <b>{cityPlaces.length}</b></span>
              <span>·</span>
              <span>posts <b>{cityBlogs.length}</b></span>
            </div>

            <h1 className="ch-title">
              <span className="it">{cityObj.name}</span> 로컬 비즈니스 색인.
            </h1>
            <p className="ch-lede">{dab}</p>

            {/* Stat strip */}
            <dl className="ch-stat-strip">
              <div className="s">
                <dt>등록 업체</dt>
                <dd>{cityPlaces.length}</dd>
                <span className="sub">활성 카테고리 {activeCategoryKeys.size}개</span>
              </div>
              <div className="s">
                <dt>활성 업종</dt>
                <dd>{activeSectors.length}</dd>
                <span className="sub">/ 대분류 {sectors.length}개</span>
              </div>
              <div className="s">
                <dt>발행 글</dt>
                <dd>{cityBlogs.length}</dd>
                <span className="sub">{cityObj.name} 가이드·비교·키워드</span>
              </div>
              <div className="s">
                <dt>마지막 갱신</dt>
                <dd className="accent">{lastUpdated.slice(5, 10).replace('-', '/')}</dd>
                <span className="sub">{lastUpdated}</span>
              </div>
            </dl>

            {/* Cross-nav: 다른 도시 */}
            {cities.length > 1 && (
              <div className="ch-xnav" aria-label="다른 도시로 이동">
                <span className="lab">다른 도시</span>
                {cities.map(c => {
                  if (c.slug === city) {
                    return (
                      <span key={c.slug} className="cur">
                        📍 {c.name}
                      </span>
                    )
                  }
                  const cnt = places.filter(p => p.city === c.slug).length
                  return (
                    <Link key={c.slug} href={`/${c.slug}`}>
                      {c.name}
                      {cnt > 0 ? <span className="ct">{cnt}</span> : <span className="ct">예정</span>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </header>

        {/* SECTOR × CATEGORY GRID */}
        <section className="ch-section no-border">
          <div className="wrap">
            <div className="ch-h">
              <div>
                <h2>
                  <span className="it">업종별</span> 색인
                </h2>
                <p className="sub">
                  활성 업종의 카테고리만 노출합니다. 카테고리를 클릭하면 해당 업체 리스트로 이동합니다.
                </p>
              </div>
              <div className="anchor">categories</div>
            </div>

            {activeSectors.length === 0 ? (
              <div className="ch-empty">
                {cityObj.name}에 등록된 업체가 아직 없습니다. 다른 도시를 확인해보세요.
              </div>
            ) : (
              activeSectors.map(sec => {
                const sectorCats = categories.filter(
                  c => c.sector === sec.slug && activeCategoryKeys.has(c.slug),
                )
                return (
                  <div className="ch-sector-group" key={sec.slug}>
                    <h3>
                      <span className="it">{sec.name}</span>
                      <span className="ct">{sectorCats.length}개 카테고리</span>
                    </h3>
                    <div className="ch-cat-grid">
                      {sectorCats.map(cat => (
                        <Link
                          key={cat.slug}
                          href={`/${city}/${cat.slug}`}
                          className="ch-cat-card"
                        >
                          <span className="nm">{cat.name}</span>
                          <span className="ct">
                            <b>{countsByCategory.get(cat.slug) ?? 0}</b>곳
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>

        {/* BLOG CARD */}
        <section className="ch-section bg-2">
          <div className="wrap">
            <div className="ch-h">
              <div>
                <h2>
                  <span className="it">{cityObj.name}</span> 블로그
                </h2>
                <p className="sub">
                  업종별 가이드·비교·추천 글 모음. 발행 {cityBlogs.length}편.
                </p>
              </div>
              <div className="anchor">blog</div>
            </div>

            {cityBlogs.length > 0 ? (
              <>
                <div className="ch-post-list">
                  {cityBlogs.slice(0, 5).map(p => (
                    <Link
                      key={p.slug}
                      className="ch-post-row"
                      href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                    >
                      <div className="lab-row">
                        <span className={`ch-type-tag ${p.postType}`}>
                          {sectors.find(s => s.slug === p.sector)?.name ?? p.sector}
                        </span>
                        <span className="when">{p.publishedAt?.slice(0, 10)}</span>
                      </div>
                      <div className="body">
                        <h4>{p.title}</h4>
                        <p>{p.summary}</p>
                      </div>
                      <div className="meta-side">
                        <div className="views">{(p.viewCount ?? 0).toLocaleString()}</div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div style={{ marginTop: 16, textAlign: 'right' }}>
                  <Link
                    href={`/blog/${city}`}
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 12,
                      color: 'var(--accent)',
                      letterSpacing: '.04em',
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                  >
                    {cityObj.name} 블로그 전체보기 →
                  </Link>
                </div>
              </>
            ) : (
              <div className="ch-empty">
                {cityObj.name} 블로그가 아직 발행되지 않았습니다 — 첫 글을 곧 올립니다.
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
