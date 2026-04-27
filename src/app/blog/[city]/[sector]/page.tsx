// /blog/[city]/[sector] — 섹터 블로그 허브 (T-251 paper/orange aip 리믹스).
// 카테고리별 글 묶음 + 다른 섹터 cross-nav + 디렉토리로 점프 링크.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { getBlogPostsBySector, getBlogPostsByCity } from '@/lib/blog/data.supabase'
import { getCities, getSectors, getCategories } from '@/lib/data.supabase'
import { groupBlogPostsByCategory } from '@/lib/blog/hub'
import { generateCollectionPage, generateBlogItemList } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import { clampDirectAnswer } from '@/lib/seo/direct-answer'
import { safeJsonLd } from '@/lib/utils'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/city-hub-remix.css'

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

const POST_TYPE_LABEL: Record<string, string> = {
  guide: '가이드',
  compare: '비교',
  keyword: '키워드',
  detail: '디테일',
  general: '일반',
}

interface Props {
  params: Promise<{ city: string; sector: string }>
}

export async function generateStaticParams() {
  const [cities, sectors] = await Promise.all([getCities(), getSectors()])
  return cities.flatMap(c => sectors.map(s => ({ city: c.slug, sector: s.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, sector } = await params
  const [cities, sectors] = await Promise.all([getCities(), getSectors()])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  if (!cityObj || !sectorObj) return {}
  const title = composePageTitle(`${cityObj.name} ${sectorObj.name} 블로그`)
  const url = `/blog/${city}/${sector}`
  const description = `${cityObj.name} ${sectorObj.name} 업종 가이드·비교·추천 글 모음. AI 검색 최적화.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function BlogSectorHubPage({ params }: Props) {
  const { city, sector } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(sector)) notFound()

  const [cities, sectors, categories, posts, cityPosts] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getBlogPostsBySector(city, sector),
    getBlogPostsByCity(city), // 다른 섹터 cross-nav 카운트용
  ])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  if (!cityObj || !sectorObj) notFound()

  const categoryGroups = groupBlogPostsByCategory(posts)

  // 다른 섹터 카운트 (이 도시 안에서)
  const sectorCounts = new Map<string, number>()
  for (const p of cityPosts) sectorCounts.set(p.sector, (sectorCounts.get(p.sector) ?? 0) + 1)
  const activeSectorsForCity = sectors.filter(s => sectorCounts.has(s.slug))

  const lastUpdated = posts[0]?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const pageUrl = `${BASE_URL}/blog/${city}/${sector}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
    { name: cityObj.name, url: `${BASE_URL}/blog/${city}` },
    { name: sectorObj.name, url: pageUrl },
  ]

  const dab = clampDirectAnswer(
    `${cityObj.name} ${sectorObj.name} 카테고리 가이드 ${posts.length}편. 업종별 비교·추천·키워드 글 모음.`,
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
              name: `${cityObj.name} ${sectorObj.name} 블로그`,
              description: dab,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(generateBreadcrumbList(breadcrumbItems)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLd(
            generateBlogItemList(posts, `${cityObj.name} ${sectorObj.name} 블로그`, BASE_URL),
          ),
        }}
      />

      <main>
        {/* HEAD */}
        <header className="ch-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <Link href="/blog">블로그</Link>
              <span className="sep">/</span>
              <Link href={`/blog/${city}`}>{cityObj.name}</Link>
              <span className="sep">/</span>
              <span className="cur">{sectorObj.name}</span>
            </nav>

            <div className="ch-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">Sector Blog · Live</span>
              <span>doc-id <b>aip-blog-{city}-{sector}</b></span>
              <span>·</span>
              <span>updated <b>{lastUpdated}</b></span>
              <span>·</span>
              <span>posts <b>{posts.length}</b></span>
              <span>·</span>
              <span>categories <b>{categoryGroups.length}</b></span>
            </div>

            <h1 className="ch-title">
              {cityObj.name} <span className="it">{sectorObj.name}</span>.
            </h1>
            <p className="ch-lede">{dab}</p>

            {/* Stat strip */}
            <dl className="ch-stat-strip">
              <div className="s">
                <dt>발행 글</dt>
                <dd>{posts.length}</dd>
                <span className="sub">{cityObj.name} {sectorObj.name} 단독</span>
              </div>
              <div className="s">
                <dt>활성 카테고리</dt>
                <dd>{categoryGroups.length}</dd>
                <span className="sub">세부 업종 단위</span>
              </div>
              <div className="s">
                <dt>마지막 발행</dt>
                <dd className="accent">{lastUpdated.slice(5, 10).replace('-', '/')}</dd>
                <span className="sub">{lastUpdated}</span>
              </div>
              <div className="s">
                <dt>디렉토리</dt>
                <dd>→</dd>
                <span className="sub">
                  <Link href={`/${city}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                    {cityObj.name} 업체 보기
                  </Link>
                </span>
              </div>
            </dl>

            {/* Cross-nav: 같은 도시 다른 섹터 */}
            {activeSectorsForCity.length > 1 && (
              <div className="ch-xnav" aria-label="같은 도시 다른 섹터">
                <span className="lab">{cityObj.name} 다른 섹터</span>
                {activeSectorsForCity.map(s => {
                  if (s.slug === sector) {
                    return (
                      <span key={s.slug} className="cur">
                        {s.name}
                      </span>
                    )
                  }
                  const cnt = sectorCounts.get(s.slug) ?? 0
                  return (
                    <Link key={s.slug} href={`/blog/${city}/${s.slug}`}>
                      {s.name}
                      <span className="ct">{cnt}편</span>
                    </Link>
                  )
                })}
                <Link href={`/blog/${city}`} style={{ marginLeft: 'auto' }}>
                  {cityObj.name} 전체 →
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* CATEGORY GROUPS */}
        <section className="ch-section no-border">
          <div className="wrap">
            <div className="ch-h">
              <div>
                <h2>
                  <span className="it">카테고리별</span> 글 묶음
                </h2>
                <p className="sub">
                  세부 업종(예: 피부과·치과)별로 정리합니다. 카테고리명을 클릭하면 해당 업체 디렉토리로 점프합니다.
                </p>
              </div>
              <div className="anchor">categories</div>
            </div>

            {categoryGroups.length === 0 ? (
              <div className="ch-empty">
                {cityObj.name} {sectorObj.name} 블로그 글이 아직 없습니다 — 다른 섹터를 확인해보세요.
              </div>
            ) : (
              categoryGroups.map(group => {
                const cat = categories.find(c => c.slug === group.category)
                const catName = cat?.name ?? group.category
                return (
                  <div className="ch-sector-group" key={group.category}>
                    <div className="ch-sec-h">
                      <h3>
                        <span className="it">{catName}</span>
                        <span className="ct">{group.posts.length}편</span>
                      </h3>
                      <Link className="more" href={`/${city}/${group.category}`}>
                        {catName} 디렉토리 →
                      </Link>
                    </div>
                    <div className="ch-post-list">
                      {group.posts.map(p => (
                        <Link
                          key={p.slug}
                          className="ch-post-row"
                          href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                        >
                          <div className="lab-row">
                            <span className={`ch-type-tag ${p.postType}`}>
                              {POST_TYPE_LABEL[p.postType] ?? '글'}
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
                  </div>
                )
              })
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
