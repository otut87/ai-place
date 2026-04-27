// /directory — 전국 디렉토리 허브 (Live AI Index 리믹스).
// 디자인 핸드오프: claude.ai/design uRhcLcCb0d4ji8ugLGPVPw, directory.html
// 데이터는 모두 실 DB 바인딩 — 17개 시·도 같은 가짜 데이터 미사용.
//   - Hero stats: getSiteStats (totalPlaces / activeCategories / totalCategories / totalBlogPosts)
//   - Compose Query: 활성 도시 + 활성 카테고리만 enable, 의도 칩은 검색 의도 표시 용도
//   - Live Index Feed: getRecentBlogPosts(8) 실 발행 글
//   - 확장 로드맵 (heatmap 변형): 활성 도시는 카운트, 그 외는 "모집중" 라벨
//   - Featured: 평점·리뷰 수 상위 6개 업체 + 연결된 블로그 글 1편
//   - Industry Cloud: 10 sector × 83 카테고리, 활성 여부 표시

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCities, getCategories, getSectors, getAllPlaces } from '@/lib/data.supabase'
import { getRecentBlogPosts } from '@/lib/blog/data.supabase'
import { getSiteStats } from '@/lib/site-stats'
import { HomeNav } from '../_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { FeedTabs } from './_components/feed-tabs'
import { RoadmapFilter } from './_components/roadmap-filter'
import { readCityCookieServer, CITY_ALL } from '@/lib/geo/city-cookie'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/directory-remix.css'

// T-246 쿠키 기반 city 컨텍스트 — revalidate 제거하고 dynamic 렌더링.
// (정적 캐시 시 모든 사용자가 같은 도시 페이지를 보게 됨.)
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://aiplace.kr'

export async function generateMetadata(): Promise<Metadata> {
  const cookieCity = await readCityCookieServer()
  const cities = await getCities()
  const matched = cities.find(c => c.slug === cookieCity)
  const isNational = cookieCity === CITY_ALL || !matched
  const title = isNational
    ? '전국 디렉토리 — AI Place'
    : `${matched.name} 디렉토리 — AI Place`
  const description = isNational
    ? 'ChatGPT·Claude·Gemini 인용 데이터를 기반으로 한 라이브 로컬 디렉토리. 도시 × 업종 매트릭스에서 바로 답변까지.'
    : `${matched.name}의 활성 업종을 ChatGPT·Claude·Gemini 인용 가능 형태로 정리. 헤더 도시 칩으로 다른 지역 전환 가능.`
  return {
    title,
    description,
    alternates: { canonical: '/directory' },
    openGraph: {
      type: 'website',
      url: BASE_URL + '/directory',
      siteName: 'AI Place',
      locale: 'ko_KR',
      title,
      description,
    },
  }
}

const POST_TYPE_LABEL: Record<string, string> = {
  keyword: '키워드',
  compare: '비교',
  guide: '가이드',
  general: '글',
}

function formatRelative(iso: string | null): string {
  if (!iso) return '발행 대기'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '발행 대기'
  const diff = Date.now() - t
  const m = Math.floor(diff / 60_000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  return `${d}일 전`
}

export default async function DirectoryPage() {
  const [cities, sectors, categories, places, blogs, stats, cookieCity] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
    getRecentBlogPosts(5),
    getSiteStats(),
    readCityCookieServer(),
  ])

  // ---- 활성 집합 ----
  const activeCitySet = new Set(stats.activeCities)
  const activeCategorySet = new Set(places.map(p => p.category))

  const countByCity = new Map<string, number>()
  for (const p of places) {
    countByCity.set(p.city, (countByCity.get(p.city) ?? 0) + 1)
  }

  // ---- Mode 결정: 쿠키가 'all' 이거나 매칭 도시 없으면 전국, 그 외엔 도시 ----
  const cookieMatchedCity = cities.find(c => c.slug === cookieCity) ?? null
  const isNationalMode = cookieCity === CITY_ALL || !cookieMatchedCity
  const focusCity = cookieMatchedCity ?? cities.find(c => activeCitySet.has(c.slug)) ?? cities[0]
  const focusCitySlug = focusCity?.slug ?? ''

  // ---- countByCategory: 전국이면 전체, 도시 모드면 그 도시 안에서만 ----
  const countByCategory = new Map<string, number>()
  const countSource = isNationalMode ? places : places.filter(p => p.city === focusCitySlug)
  for (const p of countSource) {
    countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1)
  }

  // ---- Quick Browse: 도시 모드에서만 노출 ----
  const activeCategoriesForCity = categories
    .filter(c => activeCategorySet.has(c.slug))
    .map(c => ({
      slug: c.slug,
      name: c.name,
      sector: c.sector,
      count: places.filter(p => p.category === c.slug && p.city === focusCitySlug).length,
    }))
    .filter(c => c.count > 0)
    .sort((a, b) => b.count - a.count)

  // ---- 전국 모드용 도시 카드 ----
  const cityCards = cities.map(c => ({
    city: c,
    placeCount: countByCity.get(c.slug) ?? 0,
    blogCount: blogs.filter(b => b.city === c.slug).length,
    isActive: activeCitySet.has(c.slug),
  }))

  // 매트릭스 컬럼: 활성 카테고리 우선 + 부족하면 sector 별 첫 카테고리 보충.
  const matrixIndustriesRaw: Array<{ slug: string; name: string; active: boolean }> = []
  for (const cat of categories) {
    if (activeCategorySet.has(cat.slug)) {
      matrixIndustriesRaw.push({ slug: cat.slug, name: cat.name, active: true })
    }
    if (matrixIndustriesRaw.length >= 8) break
  }
  if (matrixIndustriesRaw.length < 8) {
    for (const sector of sectors) {
      const first = categories.find(c => c.sector === sector.slug)
      if (!first) continue
      if (matrixIndustriesRaw.some(i => i.slug === first.slug)) continue
      matrixIndustriesRaw.push({
        slug: first.slug,
        name: first.name,
        active: activeCategorySet.has(first.slug),
      })
      if (matrixIndustriesRaw.length >= 8) break
    }
  }

  // ---- Featured: 평점·리뷰 상위 6개 업체 (모드별 scope) ----
  const featuredSource = isNationalMode ? places : places.filter(p => p.city === focusCitySlug)
  const ratedPlaces = [...featuredSource]
    .filter(p => typeof p.rating === 'number' && (p.rating ?? 0) > 0)
    .sort((a, b) => {
      const ra = a.rating ?? 0
      const rb = b.rating ?? 0
      if (rb !== ra) return rb - ra
      return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
    })
    .slice(0, 6)

  // 업체별 연결 블로그 글 1편 매핑.
  // BlogPostSummary 에는 relatedPlaceSlugs 가 없어 정확 매칭이 불가하므로,
  // city + category 가 동일한 가장 최근 글을 약한 매칭으로 사용 (페이지 내 blogs 8건 기준).
  function findRelatedBlog(placeCity: string, placeCategory: string) {
    return (
      blogs.find(b => b.city === placeCity && b.category === placeCategory) ??
      blogs.find(b => b.city === placeCity) ??
      null
    )
  }

  // ---- Industry Cloud: 10 sector × 카테고리 ----
  const sectorGroups = sectors.map(s => ({
    sector: s,
    categories: categories.filter(c => c.sector === s.slug),
  }))

  // ---- 확장 로드맵 매트릭스 ----
  // 도시 행 × 업종 컬럼 (매트릭스용 후보 최대 10개).
  const matrixIndustries = matrixIndustriesRaw.slice(0, 10)
  const matrixCols = matrixIndustries.length

  function intensity(n: number): string {
    if (n <= 0) return 'empty'
    if (n >= 120) return 'l5'
    if (n >= 60) return 'l4'
    if (n >= 30) return 'l3'
    if (n >= 15) return 'l2'
    return 'l1'
  }

  const today = new Date().toISOString().slice(0, 10)
  const sectorTabKeys = new Set<string>()
  for (const b of blogs) sectorTabKeys.add(b.sector)
  const sectorTabs = [
    { key: 'all', label: '전체' },
    ...sectors
      .filter(s => sectorTabKeys.has(s.slug))
      .map(s => ({ key: s.slug, label: s.name })),
  ]

  return (
    <div className="aip-root">
      <HomeNav />

      <main>
        {/* ====================== HERO ====================== */}
        <section className="dh-hero">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">디렉토리</span>
            </nav>

            <div className="aip-grid">
              <div>
                <span className="eyebrow">
                  <span className="pulse" /> Live AI Index ·{' '}
                  {isNationalMode ? '전국 종합' : `📍 ${focusCity?.name}`} ·{' '}
                  <time dateTime={today}>{today}</time> 기준
                </span>
                <h1>
                  {isNationalMode ? (
                    <>
                      AI가 지금 <span className="it">인용 중인</span>
                      <br />
                      <span className="u">전국 색인</span>.
                    </>
                  ) : (
                    <>
                      <span className="it">{focusCity?.name}</span>의<br />
                      AI 검색 <span className="u">로컬 색인</span>.
                    </>
                  )}
                </h1>
                <p className="lede">
                  {isNationalMode ? (
                    <>
                      현재 {stats.activeCities.length}개 도시 × {stats.activeCategories}개 활성
                      업종을 ChatGPT·Claude·Gemini 인용 가능 형태로 정렬했습니다. 도시를 선택하면
                      해당 지역의 빠른 인덱스로 이동합니다.
                    </>
                  ) : (
                    <>
                      <b>{focusCity?.name}</b>의 활성 업종 {activeCategoriesForCity.length}개를
                      ChatGPT·Claude·Gemini 인용 가능 형태로 정렬했습니다. 다른 지역을 보려면
                      좌상단 도시 칩을 사용하세요.
                    </>
                  )}
                </p>

                {/* 전국 모드 — 도시 카드 그리드 */}
                {isNationalMode && (
                  <div className="qb" aria-label="도시 인덱스">
                    <div className="qb-region">
                      <span className="lbl">도시별 인덱스</span>
                      <span className="city">전국</span>
                      <span className="city-en">All cities</span>
                      <span className="stat">
                        <b>{cities.length}</b>개 도시 등록 ·{' '}
                        <b>{stats.activeCities.length}</b>개 활성
                      </span>
                    </div>
                    <div className="qb-cats">
                      <span className="lbl">도시 선택</span>
                      <div className="cards">
                        {cityCards.map(({ city: c, placeCount, blogCount, isActive }) => (
                          <Link key={c.slug} href={`/${c.slug}`} className="card-link">
                            <span className="nm">
                              📍 {c.name}{' '}
                              {!isActive && (
                                <span style={{ color: 'var(--aip-muted)', fontSize: 11 }}>
                                  · 모집 중
                                </span>
                              )}
                            </span>
                            <span className="ct">
                              {isActive ? (
                                <>
                                  <b>{placeCount}곳</b> · 글 <b>{blogCount}</b>편
                                </>
                              ) : (
                                <>발행 준비 중</>
                              )}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                    <div className="qb-foot">
                      <span>+ 도시 추가 요청은 헤더 칩에서</span>
                      <a href="#by-industry">전체 {stats.totalCategories}개 업종 카탈로그 →</a>
                    </div>
                  </div>
                )}

                {/* 도시 모드 — 활성 업종 직접 라우팅 */}
                {!isNationalMode && (
                  <div className="qb" aria-label="빠른 둘러보기">
                    <div className="qb-region">
                      <span className="lbl">지역</span>
                      <span className="city">{focusCity?.name ?? '천안'}</span>
                      <span className="city-en">{focusCity?.nameEn ?? 'Cheonan'}</span>
                      <span className="stat">
                        <b>{(countByCity.get(focusCitySlug) ?? 0).toLocaleString()}</b>곳 등록 ·{' '}
                        <b>{activeCategoriesForCity.length}</b>개 활성 업종
                      </span>
                    </div>
                    <div className="qb-cats">
                      <span className="lbl">바로 살펴보기</span>
                      {activeCategoriesForCity.length > 0 ? (
                        <div className="cards">
                          {activeCategoriesForCity.map(c => (
                            <Link
                              key={c.slug}
                              href={`/${focusCitySlug}/${c.slug}`}
                              className="card-link"
                            >
                              <span className="nm">{c.name}</span>
                              <span className="ct">
                                <b>{c.count}곳</b> 등록
                              </span>
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="ct" style={{ color: 'var(--aip-muted)' }}>
                          {focusCity?.name}에 등록된 업체가 아직 없습니다. 헤더 칩에서 다른 도시를
                          선택해보세요.
                        </p>
                      )}
                    </div>
                    <div className="qb-foot">
                      <span>
                        등록 예정 업종 {stats.totalCategories - stats.activeCategories}개
                      </span>
                      <a href="#by-industry">전체 {stats.totalCategories}개 카탈로그 보기 →</a>
                    </div>
                  </div>
                )}
              </div>

              {/* Live Index Feed (블로그 발행 피드 변형) */}
              <aside className="ticker" aria-label="최근 발행 인덱스 피드">
                <FeedTabs liveLabel="Live · 인덱스 피드" tabs={sectorTabs}>
                  <ul className="feed-list">
                    {blogs.length === 0 && (
                      <li
                        className="feed-row"
                        style={{ display: 'grid', gridTemplateColumns: '1fr', color: '#9b9890' }}
                      >
                        <span className="q">발행 대기 중 — 곧 첫 글이 올라옵니다.</span>
                      </li>
                    )}
                    {blogs.map((b, idx) => {
                      const sectorObj = sectors.find(s => s.slug === b.sector)
                      return (
                        <Link
                          key={b.slug}
                          href={`/blog/${b.city}/${b.sector}/${b.slug}`}
                          className="feed-row"
                          data-sector={b.sector}
                        >
                          <span className="marker">{String(idx + 1).padStart(2, '0')}</span>
                          <span className="body">
                            <span className="q">
                              <b>{b.title}</b>
                              {b.summary}
                            </span>
                            <span className="cite">
                              {sectorObj?.name ?? b.sector} ·{' '}
                              {POST_TYPE_LABEL[b.postType] ?? '글'}
                            </span>
                          </span>
                          <span className="ago">{formatRelative(b.publishedAt)}</span>
                        </Link>
                      )
                    })}
                  </ul>
                </FeedTabs>
                <div className="ft">
                  <span>
                    누적 <b>{stats.totalBlogPosts.toLocaleString()}</b>편
                  </span>
                  <span>
                    최근 <b>{Math.min(5, blogs.length)}</b>건 표시
                  </span>
                  <span>업데이트 <b>방금 전</b></span>
                </div>
              </aside>
            </div>

            {/* Stats strip */}
            <div className="dh-stats">
              <div className="stat">
                <span className="lab">등록 업체</span>
                <span className="val">{stats.totalPlaces.toLocaleString()}</span>
                <span className="delta aip-muted">파일럿 운영 중</span>
              </div>
              <div className="stat">
                <span className="lab">활성 업종</span>
                <span className="val">
                  {stats.activeCategories} / {stats.totalCategories}
                </span>
                <span className="delta aip-muted">대분류 {sectors.length}개</span>
              </div>
              <div className="stat">
                <span className="lab">발행 콘텐츠</span>
                <span className="val">{stats.totalBlogPosts.toLocaleString()}</span>
                <span className="delta aip-muted">가이드·비교·키워드 통합</span>
              </div>
              <div className="stat">
                <span className="lab">활성 도시</span>
                <span className="val">{stats.activeCities.length}</span>
                <span className="delta aip-muted">
                  {stats.activeCities
                    .map(slug => cities.find(c => c.slug === slug)?.name ?? slug)
                    .join(' · ') || '모집 중'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== EXPANSION ROADMAP MATRIX ====================== */}
        {matrixCols > 0 && (
          <section className="dh">
            <div className="wrap">
              <div className="dh-head">
                <div>
                  <div className="kick">Live Map · 지역 × 업종</div>
                  <h2>
                    어디에 어떤 <span className="it">업종이 살아있나</span>.
                  </h2>
                  <p className="sub">
                    셀의 색이 짙을수록 등록 업체가 많습니다. 점 표시는 가이드/비교 글이 발행된
                    라이브 매트릭스이며, 다른 행은 모집 단계입니다.
                  </p>
                </div>
              </div>

              <div className="matrix-shell">
                <div className="matrix-toolbar">
                  <span className="legend">
                    밀도
                    <span className="scale" aria-hidden>
                      <i style={{ background: 'color-mix(in oklab, var(--aip-accent) 6%, var(--card))' }} />
                      <i style={{ background: 'color-mix(in oklab, var(--aip-accent) 14%, var(--card))' }} />
                      <i style={{ background: 'color-mix(in oklab, var(--aip-accent) 24%, var(--card))' }} />
                      <i style={{ background: 'color-mix(in oklab, var(--aip-accent) 38%, var(--card))' }} />
                      <i style={{ background: 'color-mix(in oklab, var(--aip-accent) 56%, var(--card))' }} />
                    </span>
                    <span style={{ color: 'var(--aip-muted)' }}>0 → 120+</span>
                  </span>
                  <span style={{ color: 'var(--aip-muted)' }}>·</span>
                  <span className="legend">
                    <span className="live-dot" /> 가이드 발행 중
                  </span>
                  <RoadmapFilter>
                    <div
                      className="matrix"
                      role="table"
                      aria-label="지역 업종 매트릭스"
                      style={{
                        gridTemplateColumns: `132px repeat(${matrixCols}, minmax(74px, 1fr))`,
                        minWidth: 132 + matrixCols * 74,
                      }}
                    >
                      <div className="corner">지역 \ 업종</div>
                      {matrixIndustries.map(ind => (
                        <div key={ind.slug} className="h">
                          {ind.name}
                          <span className="small">{ind.active ? '활성' : '예정'}</span>
                        </div>
                      ))}

                      {cities.map(c => {
                        const isActive = activeCitySet.has(c.slug)
                        return (
                          <div
                            key={c.slug}
                            className="row-h"
                            role="row"
                            data-state={isActive ? 'live' : 'recruiting'}
                          >
                            {c.name}
                            <span className="c">{c.nameEn}</span>
                          </div>
                        )
                      })}
                      {cities.flatMap(c => {
                        const isActive = activeCitySet.has(c.slug)
                        return matrixIndustries.map(ind => {
                          if (!isActive) {
                            return (
                              <div
                                key={`${c.slug}:${ind.slug}`}
                                className="cell recruiting"
                                data-state="recruiting"
                                aria-label={`${c.name} ${ind.name} — 모집 중`}
                              >
                                <span className="n">모집중</span>
                              </div>
                            )
                          }
                          const n =
                            places.filter(p => p.city === c.slug && p.category === ind.slug).length
                          const lvl = intensity(n)
                          const isLive = n > 0 // 등록 업체 1곳 이상 = 가이드 발행 가능 라이브
                          const stateAttr = isLive ? 'live' : 'empty'
                          const inner =
                            n > 0 ? (
                              <>
                                <span className="n">{n}</span>
                                <span className="t">업체</span>
                              </>
                            ) : (
                              <span className="n">·</span>
                            )
                          if (n > 0) {
                            return (
                              <Link
                                key={`${c.slug}:${ind.slug}`}
                                className={`cell ${lvl}${isLive ? ' live' : ''}`}
                                href={`/${c.slug}/${ind.slug}`}
                                data-state={stateAttr}
                                aria-label={`${c.name} ${ind.name} ${n}개`}
                              >
                                {inner}
                              </Link>
                            )
                          }
                          return (
                            <div
                              key={`${c.slug}:${ind.slug}`}
                              className={`cell ${lvl}`}
                              data-state="empty"
                              aria-label={`${c.name} ${ind.name} 등록 예정`}
                            >
                              {inner}
                            </div>
                          )
                        })
                      })}
                    </div>
                  </RoadmapFilter>
                </div>
              </div>

              <p
                style={{
                  marginTop: 12,
                  fontFamily: 'var(--mono)',
                  fontSize: 11.5,
                  color: 'var(--aip-muted)',
                }}
              >
                * 실제 등록 업체 수 기준. 다른 도시 행은 파일럿 확장 단계로 노출 전 상태입니다.
              </p>
            </div>
          </section>
        )}

        {/* ====================== FEATURED ====================== */}
        {ratedPlaces.length > 0 && (
          <section className="dh" style={{ background: 'var(--bg-2)' }}>
            <div className="wrap">
              <div className="dh-head">
                <div>
                  <div className="kick">Featured · 평점 상위 업체</div>
                  <h2>
                    AI가 <span className="it">자주 발견하는</span> 업체.
                  </h2>
                  <p className="sub">
                    평점·리뷰 수 기준 상위 {ratedPlaces.length}곳. 각 업체와 연결된 가이드·비교
                    글을 함께 노출합니다.
                  </p>
                </div>
                <div className="meta">집계 기준: 등록 업체 평점·리뷰 수</div>
              </div>

              <div className="ans-grid">
                {ratedPlaces.map((p, idx) => {
                  const sector = sectors.find(s =>
                    categories.some(c => c.slug === p.category && c.sector === s.slug),
                  )
                  const cityName = cities.find(c => c.slug === p.city)?.name ?? p.city
                  const catName = categories.find(c => c.slug === p.category)?.name ?? p.category
                  const blog = findRelatedBlog(p.city, p.category)
                  const stars = '★'.repeat(Math.round(p.rating ?? 0))
                  const avChar = p.name?.[0] ?? '·'
                  return (
                    <Link
                      key={p.slug}
                      className="ans-card"
                      href={`/${p.city}/${p.category}/${p.slug}`}
                    >
                      <div className="ans-head">
                        <div className="who">
                          <b>{cityName}</b>
                          <span className="q">&ldquo;{catName}&rdquo;</span>
                        </div>
                        <span className="ago">#{idx + 1}</span>
                      </div>
                      <div className="answer">
                        {p.description ?? `${cityName} ${catName} 카테고리에 등록된 업체입니다.`}
                      </div>
                      <div className="biz">
                        <div className="av" aria-hidden>
                          {avChar}
                        </div>
                        <div className="info">
                          <h3>{p.name}</h3>
                          <div className="meta">
                            {p.rating != null && <span className="stars">{stars}</span>}
                            {p.rating != null && (
                              <span>
                                {p.rating.toFixed(1)}
                                {p.reviewCount != null && ` · 리뷰 ${p.reviewCount}`}
                              </span>
                            )}
                            <span style={{ color: 'var(--aip-accent)' }}>
                              {sector?.name ?? '업체'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="reason">
                        <span className="pin">{idx + 1}</span>
                        <span>
                          {blog
                            ? `연결 글: ${blog.title}`
                            : `${cityName} ${catName} 카테고리 페이지로 이동`}
                        </span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* ====================== INDUSTRY CLOUD ====================== */}
        <section className="dh" id="by-industry">
          <div className="wrap">
            <div className="dh-head">
              <div>
                <div className="kick">By Industry · 업종 카탈로그</div>
                <h2>
                  {sectors.length}개 대분류, <span className="it">{categories.length}개 세부 업종</span>.
                </h2>
                <p className="sub">
                  주황 점이 켜진 업종은 등록 업체와 가이드가 발행 중입니다. 점선은 등록 예정 업종.
                </p>
              </div>
            </div>

            <div className="ind-cloud">
              {sectorGroups.map(({ sector, categories: cats }) => {
                const activeInSector = cats.filter(c => activeCategorySet.has(c.slug)).length
                return (
                  <div className="group" key={sector.slug}>
                    <h3>
                      {sector.name}
                      <span className="s">
                        {sector.nameEn.toUpperCase()} · {cats.length}
                        {activeInSector > 0 ? ` · ${activeInSector} 활성` : ''}
                      </span>
                    </h3>
                    <div className="chips">
                      {cats.map(cat => {
                        const cnt = countByCategory.get(cat.slug) ?? 0
                        // 도시 모드: 그 도시 / 전국 모드: 활성 도시 첫 번째 (실데이터 기준)
                        const targetCity = isNationalMode
                          ? stats.activeCities[0] ?? cities[0]?.slug ?? 'cheonan'
                          : focusCitySlug
                        if (cnt === 0) {
                          return (
                            <span className="ind-chip empty" key={cat.slug}>
                              {cat.name} <span className="ct">예정</span>
                            </span>
                          )
                        }
                        return (
                          <Link
                            className="live"
                            key={cat.slug}
                            href={`/${targetCity}/${cat.slug}`}
                          >
                            {cat.name} <span className="ct">{cnt}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ====================== BOTTOM CTA ====================== */}
        <section className="dh" style={{ borderTop: 'none' }}>
          <div className="wrap">
            <div className="bottom-cta">
              <div>
                <h3>
                  찾는 업종이 <span className="it">없으신가요?</span>
                </h3>
                <p>
                  네이버 플레이스 URL과 주력 서비스 3가지만 알려주시면 AI 검색 인용 가능한
                  프로필이 자동으로 발행됩니다.
                </p>
                <div className="row">
                  <Link className="btn accent" href="/owner/places/new">
                    무료로 업체 등록 →
                  </Link>
                  <Link
                    className="btn ghost"
                    style={{ color: '#fff', borderColor: 'rgba(255,255,255,.25)' }}
                    href="/check"
                  >
                    내 업체 AI 점수 진단
                  </Link>
                </div>
              </div>
              <div className="panel">
                <div className="row2">
                  <span>현재 등록 업체</span>
                  <b>{stats.totalPlaces.toLocaleString()} 곳</b>
                </div>
                <div className="row2">
                  <span>활성 업종</span>
                  <b>
                    {stats.activeCategories} / {stats.totalCategories}
                  </b>
                </div>
                <div className="row2">
                  <span>발행 콘텐츠</span>
                  <b>{stats.totalBlogPosts.toLocaleString()} 편</b>
                </div>
                <div className="row2">
                  <span>활성 도시</span>
                  <b>
                    {stats.activeCities
                      .map(slug => cities.find(c => c.slug === slug)?.name ?? slug)
                      .join(' · ') || '모집 중'}
                  </b>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
