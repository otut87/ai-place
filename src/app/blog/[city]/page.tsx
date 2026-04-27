// /blog/[city] — 도시 블로그 허브 (T-250 paper/orange aip 리믹스).
// 도시 컨텍스트 stat strip + 다른 도시 cross-nav + 섹터별 글 묶음 + 전체보기 링크.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { getBlogPostsByCity, getRecentBlogPosts } from '@/lib/blog/data.supabase'
import { getCities, getSectors } from '@/lib/data.supabase'
import { groupBlogPostsBySector } from '@/lib/blog/hub'
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
  const title = composePageTitle(`${cityObj.name} 업체 블로그`)
  const url = `/blog/${city}`
  const description = `${cityObj.name}의 업종별 가이드·비교·추천 글 모음. AI 검색에 최적화된 로컬 비즈니스 콘텐츠.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function BlogCityHubPage({ params }: Props) {
  const { city } = await params
  if (!SLUG_PATTERN.test(city)) notFound()

  const [cities, sectors, posts, allRecent] = await Promise.all([
    getCities(),
    getSectors(),
    getBlogPostsByCity(city),
    getRecentBlogPosts(500), // cross-nav 도시 카운트용
  ])
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) notFound()

  // 도시별 글 카운트 (cross-nav)
  const countByCity = new Map<string, number>()
  for (const p of allRecent) countByCity.set(p.city, (countByCity.get(p.city) ?? 0) + 1)

  const sectorGroups = groupBlogPostsBySector(posts)
  const lastUpdated = posts[0]?.publishedAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)

  const pageUrl = `${BASE_URL}/blog/${city}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
    { name: cityObj.name, url: pageUrl },
  ]

  const dab = clampDirectAnswer(
    `${cityObj.name}에 공개된 업종 가이드 ${posts.length}편입니다. 피부과·미용·음식·인테리어 등 섹터별 추천·비교 정리.`,
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
              name: `${cityObj.name} 블로그`,
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
          __html: safeJsonLd(generateBlogItemList(posts, `${cityObj.name} 블로그`, BASE_URL)),
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
              <span className="cur">{cityObj.name}</span>
            </nav>

            <div className="ch-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">City Blog · Live</span>
              <span>doc-id <b>aip-blog-{city}</b></span>
              <span>·</span>
              <span>updated <b>{lastUpdated}</b></span>
              <span>·</span>
              <span>posts <b>{posts.length}</b></span>
              <span>·</span>
              <span>sectors <b>{sectorGroups.length}</b></span>
            </div>

            <h1 className="ch-title">
              <span className="it">{cityObj.name}</span> 업체 블로그.
            </h1>
            <p className="ch-lede">{dab}</p>

            {/* Stat strip */}
            <dl className="ch-stat-strip">
              <div className="s">
                <dt>발행 글</dt>
                <dd>{posts.length}</dd>
                <span className="sub">{cityObj.name} 단독 인덱스</span>
              </div>
              <div className="s">
                <dt>활성 섹터</dt>
                <dd>{sectorGroups.length}</dd>
                <span className="sub">/ 대분류 {sectors.length}개</span>
              </div>
              <div className="s">
                <dt>마지막 발행</dt>
                <dd className="accent">{lastUpdated.slice(5, 10).replace('-', '/')}</dd>
                <span className="sub">{lastUpdated}</span>
              </div>
              <div className="s">
                <dt>갱신 주기</dt>
                <dd>14d</dd>
                <span className="sub">2주마다 재검토</span>
              </div>
            </dl>

            {/* Cross-nav: 다른 도시 */}
            {cities.length > 1 && (
              <div className="ch-xnav" aria-label="다른 도시 블로그">
                <span className="lab">다른 도시 블로그</span>
                {cities.map(c => {
                  if (c.slug === city) {
                    return (
                      <span key={c.slug} className="cur">
                        📍 {c.name}
                      </span>
                    )
                  }
                  const cnt = countByCity.get(c.slug) ?? 0
                  return (
                    <Link key={c.slug} href={`/blog/${c.slug}`}>
                      {c.name}
                      {cnt > 0 ? <span className="ct">{cnt}편</span> : <span className="ct">예정</span>}
                    </Link>
                  )
                })}
                <Link href="/blog" style={{ marginLeft: 'auto' }}>
                  전국 블로그 →
                </Link>
              </div>
            )}
          </div>
        </header>

        {/* SECTOR GROUPS */}
        <section className="ch-section no-border">
          <div className="wrap">
            <div className="ch-h">
              <div>
                <h2>
                  <span className="it">섹터별</span> 글 묶음
                </h2>
                <p className="sub">
                  활성 섹터의 글만 노출합니다. 섹터별 &ldquo;전체보기&rdquo; 클릭 시 카테고리 단위 인덱스로 이동합니다.
                </p>
              </div>
              <div className="anchor">sectors</div>
            </div>

            {sectorGroups.length === 0 ? (
              <div className="ch-empty">
                {cityObj.name}에 공개된 블로그 글이 아직 없습니다 — 다른 도시를 확인해보세요.
              </div>
            ) : (
              sectorGroups.map(group => {
                const sec = sectors.find(s => s.slug === group.sector)
                const sectorName = sec?.name ?? group.sector
                return (
                  <div className="ch-sector-group" key={group.sector}>
                    <div className="ch-sec-h">
                      <h3>
                        <span className="it">{sectorName}</span>
                        <span className="ct">{group.posts.length}편</span>
                      </h3>
                      <Link className="more" href={`/blog/${city}/${group.sector}`}>
                        {sectorName} 전체보기 →
                      </Link>
                    </div>
                    <div className="ch-post-list">
                      {group.posts.slice(0, 5).map(p => (
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
