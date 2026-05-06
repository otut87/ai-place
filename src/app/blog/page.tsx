// /blog — 블로그 홈 (T-237 paper/orange aip 리믹스).
// 디자인 핸드오프: claude.ai/design sPykHVCeCy1vyCAffUkGmA, guides.html
//
// 필터·정렬은 URL 쿼리 기반 (sector + sort) — JS 없이 동작.
// 디자인 시안의 type 필터는 새로 추가 (URL 쿼리 type=guide 등).

import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { getRecentBlogPosts, getPopularBlogPosts } from '@/lib/blog/data.supabase'
import { getCities, getSectors } from '@/lib/data.supabase'
import { getSiteStats } from '@/lib/site-stats'
import { generateCollectionPage, generateBlogItemList } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { safeJsonLd } from '@/lib/utils'
import { searchBlogPosts } from '@/lib/blog/search'
import { pageNumbers } from '@/lib/blog/pagination'
import type { BlogPostSummary } from '@/lib/types'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/blog-index-remix.css'

// Phase 2 / P1-1 (codex review 2026-04-30) — 쿠키 의존 제거.
//   기존: 쿠키 city 가 본문 필터에 영향 + canonical 은 항상 /blog → 같은 canonical
//   URL 이 사용자별로 다른 본문을 노출. 검색엔진/LLM 이 단일 문서로 해석 못함.
//   현재: city 필터는 URL 쿼리만 신뢰. /blog 는 쿠키 영향 없는 전역 인덱스.
//   쿠키는 헤더 city picker UX 로만 사용 (별도 컴포넌트, server side filter 와 분리).
//
// dynamic='force-dynamic' 은 검색·페이지네이션 렌더 비용 때문에 유지 — caching 부재가
// canonical 신호와 충돌하진 않음.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 20

const BASE_URL = 'https://aiplace.kr'

const POST_TYPE_LABEL: Record<string, string> = {
  guide: '가이드',
  compare: '비교',
  keyword: '키워드',
  detail: '디테일',
  general: '일반',
}

const POST_TYPE_DESC: Record<string, { name: string; desc: string }> = {
  guide: { name: '구조화 절차형', desc: '예산·체크리스트·계약 포인트가 단계별 정리. "선택 가이드" 류.' },
  compare: { name: '표 기반 N대N', desc: '여러 업체를 시술·가격·위치로 매트릭스화.' },
  keyword: { name: '단일 질의 답변', desc: '"천안 N 잘하는 곳" 같은 자연어 검색에 1:1 매칭.' },
  detail: { name: '심층 분석', desc: '단일 업체의 면허·이력·리뷰를 깊이 있게 검증.' },
  general: { name: '리뷰 분석', desc: '리뷰 데이터 정량 분석 + 정성 인용.' },
}

async function activeCityLabel(): Promise<string> {
  const [stats, cities] = await Promise.all([getSiteStats(), getCities()])
  const names = stats.activeCities
    .map(slug => cities.find(c => c.slug === slug)?.name ?? slug)
    .filter(Boolean)
  return names.length > 0 ? names.join('·') : '전국'
}

export async function generateMetadata(): Promise<Metadata> {
  const cityLabel = await activeCityLabel()
  const title = `AI Place 블로그 — ${cityLabel} 지역 업체 가이드·비교·추천`
  const description = `AI Place 블로그는 ${cityLabel} 지역 로컬 업체의 비교, 가이드, 추천 키워드 글을 제공합니다. ChatGPT, Claude, Gemini 검색에 최적화된 콘텐츠.`
  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: {
      title: `AI Place 블로그 — ${cityLabel} 업체 가이드`,
      description: `${cityLabel} 지역 업체 비교·가이드·추천 글 모음. AI 검색 최적화 콘텐츠.`,
      url: '/blog',
      type: 'website',
    },
  }
}

interface BlogHomeProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

interface FilterHrefParams {
  type?: string
  city?: string
  sector?: string
  sort?: string
  q?: string
  page?: number
}

function buildFilterHref(params: FilterHrefParams): string {
  const sp = new URLSearchParams()
  if (params.type && params.type !== 'all') sp.set('type', params.type)
  if (params.city && params.city !== 'all') sp.set('city', params.city)
  if (params.sector && params.sector !== 'all') sp.set('sector', params.sector)
  if (params.sort && params.sort !== 'recent') sp.set('sort', params.sort)
  if (params.q) sp.set('q', params.q)
  if (params.page && params.page > 1) sp.set('page', String(params.page))
  const qs = sp.toString()
  return qs ? `/blog?${qs}` : '/blog'
}

const POST_POOL_LIMIT = 500

export default async function BlogHomePage({ searchParams }: BlogHomeProps) {
  const raw = await searchParams
  const sectorFilter = typeof raw.sector === 'string' ? raw.sector : ''
  const urlCityFilter = typeof raw.city === 'string' ? raw.city : ''
  const typeFilter = typeof raw.type === 'string' ? raw.type : ''
  const query = typeof raw.q === 'string' ? raw.q : ''
  const pageParam = typeof raw.page === 'string' ? parseInt(raw.page, 10) : 1
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1
  const sortMode = raw.sort === 'popular' ? 'popular' : raw.sort === 'cited' ? 'cited' : 'recent'

  // 전체 글 풀 (POST_POOL_LIMIT — 현재 규모 기준 충분히 여유). 인기글은 viewCount 정렬용으로 별도.
  const [recent, popular, cities, sectors, stats] = await Promise.all([
    getRecentBlogPosts(POST_POOL_LIMIT),
    getPopularBlogPosts(20),
    getCities(),
    getSectors(),
    getSiteStats(),
  ])

  // Phase 2 / P1-1: city 필터는 URL 쿼리만 신뢰 (쿠키 의존 제거).
  //   쿠키 도시는 헤더 picker UX 로만 — 본문 필터에는 영향 없음.
  //   결과: /blog 는 모든 사용자에게 동일 본문, canonical=/blog 와 일관.
  const cityFilter = urlCityFilter && cities.some(c => c.slug === urlCityFilter)
    ? urlCityFilter
    : ''

  const all: BlogPostSummary[] = recent

  // 필터
  let filtered = all
  if (typeFilter) filtered = filtered.filter(p => p.postType === typeFilter)
  if (cityFilter) filtered = filtered.filter(p => p.city === cityFilter)
  if (sectorFilter) filtered = filtered.filter(p => p.sector === sectorFilter)
  filtered = searchBlogPosts(filtered, query)

  // 정렬
  let sorted: BlogPostSummary[]
  if (sortMode === 'popular') {
    sorted = [...filtered].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
  } else {
    sorted = [...filtered].sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''))
  }

  // 페이지네이션
  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * PAGE_SIZE
  const pageEnd = pageStart + PAGE_SIZE
  const pageItems = sorted.slice(pageStart, pageEnd)

  // city 카운트 — 도시 chip 옆에 노출되는 숫자는 전체 기준.
  const cityCounts = new Map<string, number>()
  for (const p of all) cityCounts.set(p.city, (cityCounts.get(p.city) ?? 0) + 1)

  // 전역 sector 카운트 — HEAD stat strip 의 "발행 글" sub 에 사용 (필터와 무관).
  const sectorCountsGlobal = new Map<string, number>()
  for (const p of all) sectorCountsGlobal.set(p.sector, (sectorCountsGlobal.get(p.sector) ?? 0) + 1)
  const activeSectorsGlobal = sectors.filter(s => sectorCountsGlobal.has(s.slug))

  // 도시 필터 적용 카운트 — 툴바 chip 의 숫자가 "이 chip 을 누르면 보일 글 수"와 일치하도록.
  const cityScoped = cityFilter ? all.filter(p => p.city === cityFilter) : all

  const typeCounts: Record<string, number> = {}
  for (const p of cityScoped) typeCounts[p.postType] = (typeCounts[p.postType] ?? 0) + 1

  const sectorCounts = new Map<string, number>()
  for (const p of cityScoped) sectorCounts.set(p.sector, (sectorCounts.get(p.sector) ?? 0) + 1)
  const activeSectors = sectors.filter(s => (sectorCounts.get(s.slug) ?? 0) > 0)

  // Featured: 조회수 1위 (popular 우선, 없으면 all 풀에서)
  const featured = popular[0] ?? [...all].sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))[0] ?? null

  // sector별 상위 글 (sector band) — 현재 활성 city 필터 적용
  const sectorBandSource = cityFilter ? all.filter(p => p.city === cityFilter) : all
  const sectorBands = activeSectors.map(s => ({
    sector: s,
    posts: sectorBandSource.filter(p => p.sector === s.slug).slice(0, 6),
    count: sectorBandSource.filter(p => p.sector === s.slug).length,
  })).filter(b => b.count > 0)

  // sector summary 텍스트 (간단한 정적 카피)
  const SECTOR_SUMMARY: Record<string, { desc: string; queries: string[] }> = {
    medical: {
      desc: '시술 단가가 정량화 가능해 AI 인용 빈도가 가장 높은 카테고리.',
      queries: ['보톡스 잘하는 곳', '피부과 야간진료', '기미 치료 어디'],
    },
    living: {
      desc: '평당·평수 단위 시세가 자주 인용되는 영역.',
      queries: ['인테리어 평당가', '인테리어 면허 보유 업체'],
    },
    professional: {
      desc: '견적 변동성이 커 검증 글이 핵심.',
      queries: ['홈페이지 제작 비용', '디자인 에이전시 추천'],
    },
    auto: {
      desc: '1급·2급 공업사 구분이 인용 포인트.',
      queries: ['1급 공업사', '수입차 정비'],
    },
    food: {
      desc: '메뉴 단가·분위기 카테고리화가 핵심.',
      queries: ['기념일 레스토랑', '점심 한식 주차'],
    },
    beauty: {
      desc: '시술 단가·소요시간 정량화가 인용 근거.',
      queries: ['미용실 남성컷', '왁싱 잘하는 곳'],
    },
  }

  const cityLabel = await activeCityLabel()
  const dab = `AI Place 블로그는 ${cityLabel} 지역 ${stats.totalBlogPosts}편의 글로 업체 비교·가이드·추천을 제공합니다.`

  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
  ]
  const breadcrumbJsonLd = generateBreadcrumbList(breadcrumbItems)
  const itemListJsonLd = generateBlogItemList(recent, 'AI Place 최근 블로그 글', BASE_URL)
  const collectionJsonLd = generateCollectionPage({
    name: 'AI Place 블로그',
    url: `${BASE_URL}/blog`,
    description: dab,
    mainEntity: itemListJsonLd,
  })

  const docId = 'aip-blog-index'
  // Phase 2 / P1-5: 가짜 freshness 제거. 글이 0건이면 null — 표시 안 함.
  const lastPublished: string | null = recent[0]?.publishedAt?.slice(0, 10) ?? null
  const draftCount = Math.max(0, stats.totalCategories - stats.activeCategories)

  // 유형별 카운트가 0인 것은 legend 에서 제외
  const presentTypes = ['guide', 'compare', 'keyword', 'detail', 'general'].filter(
    t => (typeCounts[t] ?? 0) > 0,
  )

  return (
    <div className="aip-root">
      <HomeNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

      <main>
        {/* HEAD */}
        <header className="bi-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">블로그</span>
            </nav>

            <div className="bi-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">AI Answer Document Index</span>
              <span>
                doc-id <b>{docId}</b>
              </span>
              {lastPublished && (
                <>
                  <span>·</span>
                  <span>
                    last published <b>{lastPublished}</b>
                  </span>
                </>
              )}
              <span>·</span>
              <span>
                posts <b>{stats.totalBlogPosts}</b>
                {draftCount > 0 && (
                  <>
                    {' '}· drafts <b>{draftCount}</b>
                  </>
                )}
              </span>
            </div>

            <h1 className="bi-title">
              AI가 인용하는
              <br />
              <span className="it">근거형</span> 로컬 비교 <span className="num">{stats.totalBlogPosts}</span>편.
            </h1>
            <p className="bi-lede">
              AI Place 블로그는 <mark>{cityLabel} 지역</mark> 업체를 시술·가격·시간·위치 단위로 정리한
              비교·가이드 콘텐츠입니다. 모든 수치에 출처와 날짜를 명시하고 FAQ 구조로 마크업해 —
              ChatGPT·Claude·Gemini가 답변 시 그대로 인용할 수 있도록 설계했습니다.
            </p>

            <dl className="bi-stat-strip">
              <div className="s">
                <dt>발행 글</dt>
                <dd>{stats.totalBlogPosts}</dd>
                <span className="sub">
                  {activeSectorsGlobal.map(s => `${s.name} ${sectorCountsGlobal.get(s.slug)}`).join(' · ')}
                </span>
              </div>
              <div className="s">
                <dt>활성 카테고리</dt>
                <dd>{stats.activeCategories}</dd>
                <span className="sub">/ {stats.totalCategories}개 업종</span>
              </div>
              <div className="s">
                <dt>도시별 글</dt>
                <dd>{cities.length}</dd>
                <span className="sub">
                  {cities.map(c => `${c.name} ${cityCounts.get(c.slug) ?? 0}`).join(' · ')}
                </span>
              </div>
              <div className="s">
                <dt>등록 업체</dt>
                <dd>{stats.totalPlaces}</dd>
                <span className="sub">디렉토리 등재</span>
              </div>
              <div className="s">
                <dt>갱신 주기</dt>
                <dd className="accent">14d</dd>
                <span className="sub">2주마다 재검토</span>
              </div>
            </dl>
          </div>
        </header>

        {/* TOOLBAR */}
        <div className="bi-toolbar">
          <div className="wrap">
            <div className="row">
              <span className="lab">City</span>
              <div className="bi-filt">
                <Link
                  href={buildFilterHref({ type: typeFilter, sector: sectorFilter, sort: sortMode })}
                  className={cityFilter === '' ? 'active' : ''}
                >
                  전체 <span className="n">{all.length}</span>
                </Link>
                {cities.map(c => (
                  <Link
                    key={c.slug}
                    href={buildFilterHref({ type: typeFilter, city: c.slug, sector: sectorFilter, sort: sortMode })}
                    className={cityFilter === c.slug ? 'active' : ''}
                  >
                    {c.name} <span className="n">{cityCounts.get(c.slug) ?? 0}</span>
                  </Link>
                ))}
              </div>
              <span className="bi-filt-sep" />
              <span className="lab">Sector</span>
              <div className="bi-filt">
                <Link
                  href={buildFilterHref({ type: typeFilter, city: cityFilter, sort: sortMode })}
                  className={sectorFilter === '' ? 'active' : ''}
                >
                  전체
                </Link>
                {activeSectors.map(s => (
                  <Link
                    key={s.slug}
                    href={buildFilterHref({ type: typeFilter, city: cityFilter, sector: s.slug, sort: sortMode })}
                    className={sectorFilter === s.slug ? 'active' : ''}
                  >
                    {s.name} <span className="n">{sectorCounts.get(s.slug) ?? 0}</span>
                  </Link>
                ))}
              </div>
              <span className="bi-filt-sep" />
              <span className="lab">Type</span>
              <div className="bi-filt">
                <Link
                  href={buildFilterHref({ city: cityFilter, sector: sectorFilter, sort: sortMode })}
                  className={typeFilter === '' ? 'active' : ''}
                >
                  전체
                </Link>
                {presentTypes.map(t => (
                  <Link
                    key={t}
                    href={buildFilterHref({ type: t, city: cityFilter, sector: sectorFilter, sort: sortMode })}
                    className={typeFilter === t ? 'active' : ''}
                  >
                    {POST_TYPE_LABEL[t]} <span className="n">{typeCounts[t]}</span>
                  </Link>
                ))}
              </div>
              <div className="sort">
                <Link
                  href={buildFilterHref({ type: typeFilter, city: cityFilter, sector: sectorFilter })}
                  className={sortMode === 'recent' ? 'active' : ''}
                >
                  Recent
                </Link>
                <Link
                  href={buildFilterHref({ type: typeFilter, city: cityFilter, sector: sectorFilter, sort: 'popular' })}
                  className={sortMode === 'popular' ? 'active' : ''}
                >
                  Popular
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* CITY INDEX — 다중 도시일 때만 노출 */}
        {cities.length > 1 && !cityFilter && !sectorFilter && !typeFilter && (
          <section className="bi-section no-border">
            <div className="wrap">
              <div className="bi-h">
                <div>
                  <h2>
                    <span className="it">By City</span> · 지역별 인덱스
                  </h2>
                  <p className="sub">
                    도시별 블로그 허브로 바로 이동. 각 도시 안에서 섹터별로 다시 탐색할 수 있습니다.
                  </p>
                </div>
                <div className="anchor">cities</div>
              </div>

              <div className="bi-city-grid">
                {cities.map(c => {
                  const cnt = cityCounts.get(c.slug) ?? 0
                  return (
                    <Link key={c.slug} className="bi-city-card" href={cnt > 0 ? `/blog/${c.slug}` : buildFilterHref({ city: c.slug })}>
                      <div className="bi-city-name">
                        <span className="it">{c.name}</span>
                      </div>
                      <div className="bi-city-meta">
                        <span className="num">{cnt}</span>
                        <small>편</small>
                      </div>
                      <div className="bi-city-sub">
                        {cnt > 0 ? `${c.name} 블로그 허브 →` : '발행 준비 중'}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* TYPE LEGEND */}
        {presentTypes.length > 0 && (
          <section className="bi-section no-border">
            <div className="wrap">
              <div className="bi-h">
                <div>
                  <h2>
                    <span className="it">Post Types</span> · {presentTypes.length}가지 형식
                  </h2>
                  <p className="sub">
                    콘텐츠 유형마다 LLM이 인용하는 방식이 다릅니다. 가이드는 절차로, 비교는 표로,
                    키워드는 단답형으로 인용됩니다.
                  </p>
                </div>
                <div className="anchor">post-types</div>
              </div>

              <div className="bi-legend">
                {presentTypes.map(t => (
                  <div className="l" key={t}>
                    <span className={`bi-type-tag ${t}`}>{POST_TYPE_LABEL[t]}</span>
                    <b>{POST_TYPE_DESC[t]?.name ?? POST_TYPE_LABEL[t]}</b>
                    <span className="desc">{POST_TYPE_DESC[t]?.desc ?? ''}</span>
                    <span className="num">
                      {typeCounts[t]}
                      <small>편</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FEATURED */}
        {featured && !typeFilter && !sectorFilter && !cityFilter && (
          <section className="bi-section">
            <div className="wrap">
              <div className="bi-h">
                <div>
                  <h2>
                    <span className="it">This Week</span> · 추천 1편
                  </h2>
                  <p className="sub">조회수 기준 이번 주 추천.</p>
                </div>
                <div className="anchor">featured</div>
              </div>

              <Link className="bi-feat" href={`/blog/${featured.city}/${featured.sector}/${featured.slug}`}>
                <div>
                  <div className="lab-row">
                    <span className={`bi-type-tag ${featured.postType}`}>
                      {POST_TYPE_LABEL[featured.postType]}
                    </span>
                    <span className="when">PUBLISHED {featured.publishedAt?.slice(0, 10)}</span>
                  </div>
                  <h3>{featured.title}</h3>
                  <p className="excerpt">{featured.summary}</p>
                  <div className="meta">
                    <span>
                      조회 <b>{(featured.viewCount ?? 0).toLocaleString()}</b>
                    </span>
                    {featured.tags.length > 0 && (
                      <span>
                        태그 <b>{featured.tags.length}</b>개
                      </span>
                    )}
                  </div>
                </div>
                <div className="bi-feat-side">
                  <h3>같은 분야의 다른 글</h3>
                  {all
                    .filter(p => p.sector === featured.sector && p.slug !== featured.slug)
                    .slice(0, 2)
                    .map(p => (
                      <span key={p.slug} className="related-link">
                        <b>{p.title}</b>
                        {p.summary.slice(0, 50)}…
                      </span>
                    ))}
                </div>
              </Link>
            </div>
          </section>
        )}

        {/* POST LIST */}
        <section className="bi-section no-border" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            {/* SEARCH */}
            <form className="bi-search" action="/blog" method="get" role="search">
              {/* 다른 필터 보존을 위한 hidden inputs (q 변경 시 page 는 리셋) */}
              {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
              {urlCityFilter && <input type="hidden" name="city" value={urlCityFilter} />}
              {sectorFilter && <input type="hidden" name="sector" value={sectorFilter} />}
              {sortMode !== 'recent' && <input type="hidden" name="sort" value={sortMode} />}
              <label htmlFor="bi-q" className="lab">검색</label>
              <input
                id="bi-q"
                type="search"
                name="q"
                placeholder="제목 · 요약 · 태그에서 검색"
                defaultValue={query}
                aria-label="블로그 글 검색"
              />
              <button type="submit" className="btn-go">검색 →</button>
              {query && (
                <Link
                  className="btn-clear"
                  href={buildFilterHref({
                    type: typeFilter,
                    city: urlCityFilter,
                    sector: sectorFilter,
                    sort: sortMode,
                  })}
                >
                  지우기
                </Link>
              )}
            </form>

            <div className="bi-h">
              <div>
                <h2 id="all-posts">
                  <span className="it">All Posts</span> · <span className="num">{totalCount}</span>편
                  {(typeFilter || sectorFilter || cityFilter || query) && (
                    <span style={{ fontSize: 14, color: 'var(--aip-muted)', marginLeft: 8 }}>
                      / 전체 {all.length}편
                    </span>
                  )}
                  {totalPages > 1 && (
                    <span style={{ fontSize: 14, color: 'var(--aip-muted)', marginLeft: 8 }}>
                      · 페이지 {safePage}/{totalPages}
                    </span>
                  )}
                </h2>
                <p className="sub">
                  {query && (
                    <>
                      &ldquo;<b>{query}</b>&rdquo; 검색 결과.
                      {totalCount === 0 && ' 일치하는 글이 없습니다.'}
                    </>
                  )}
                  {!query && '발행된 모든 글을 페이지당 20편씩 나열합니다. 위 툴바에서 도시·섹터·유형 필터, 정렬 방식 변경 가능.'}
                  {(typeFilter || sectorFilter || cityFilter || query) && (
                    <>
                      {' '}
                      <Link href="/blog" style={{ color: 'var(--aip-accent)', textDecoration: 'underline' }}>
                        필터 초기화
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="anchor">all</div>
            </div>

            {pageItems.length > 0 ? (
              <>
                <div className="bi-list">
                  {pageItems.map((p, idx) => (
                    <Link key={p.slug} href={`/blog/${p.city}/${p.sector}/${p.slug}`} className="bi-row">
                      <div className="idx">{String(pageStart + idx + 1).padStart(2, '0')}</div>
                      <div className="type-cell">
                        <span className={`bi-type-tag ${p.postType}`}>{POST_TYPE_LABEL[p.postType]}</span>
                        <span className="when">{p.publishedAt?.slice(0, 10) ?? '발행 대기'}</span>
                      </div>
                      <div className="body">
                        <h3>{p.title}</h3>
                        <p>{p.summary}</p>
                        {p.tags.length > 0 && (
                          <div className="tag-row">
                            {p.tags.slice(0, 4).map(tag => (
                              <span className="tag" key={tag}>
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="meta-side">
                        <div className="views">{(p.viewCount ?? 0).toLocaleString()}</div>
                        <div className="when-sub">{sectors.find(s => s.slug === p.sector)?.name ?? p.sector}</div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <nav className="bi-pager" aria-label="페이지 이동">
                    {safePage > 1 ? (
                      <Link
                        className="pg prev"
                        href={buildFilterHref({
                          type: typeFilter,
                          city: urlCityFilter,
                          sector: sectorFilter,
                          sort: sortMode,
                          q: query,
                          page: safePage - 1,
                        })}
                      >
                        ← 이전
                      </Link>
                    ) : (
                      <span className="pg disabled">← 이전</span>
                    )}

                    <span className="pg-nums">
                      {pageNumbers(safePage, totalPages).map((n, i) =>
                        n === '...' ? (
                          <span key={`gap-${i}`} className="pg gap">…</span>
                        ) : n === safePage ? (
                          <span key={n} className="pg active" aria-current="page">{n}</span>
                        ) : (
                          <Link
                            key={n}
                            className="pg"
                            href={buildFilterHref({
                              type: typeFilter,
                              city: urlCityFilter,
                              sector: sectorFilter,
                              sort: sortMode,
                              q: query,
                              page: n,
                            })}
                          >
                            {n}
                          </Link>
                        ),
                      )}
                    </span>

                    {safePage < totalPages ? (
                      <Link
                        className="pg next"
                        href={buildFilterHref({
                          type: typeFilter,
                          city: urlCityFilter,
                          sector: sectorFilter,
                          sort: sortMode,
                          q: query,
                          page: safePage + 1,
                        })}
                      >
                        다음 →
                      </Link>
                    ) : (
                      <span className="pg disabled">다음 →</span>
                    )}
                  </nav>
                )}
              </>
            ) : (
              <div className="bi-empty">
                {query
                  ? `"${query}" 검색 결과가 없습니다 — 다른 키워드를 시도해보세요.`
                  : '해당 조건에 맞는 글이 없습니다 — 필터를 바꿔보세요.'}
              </div>
            )}
          </div>
        </section>

        {/* SECTOR BANDS */}
        {!typeFilter && !sectorFilter && sectorBands.length > 0 && (
          <section className="bi-section">
            <div className="wrap">
              <div className="bi-h">
                <div>
                  <h2>
                    <span className="it">By Sector</span> · 업종별 인덱스
                    {cityFilter && (
                      <span style={{ fontSize: 14, color: 'var(--aip-muted)', marginLeft: 8 }}>
                        · {cities.find(c => c.slug === cityFilter)?.name ?? cityFilter} 한정
                      </span>
                    )}
                  </h2>
                  <p className="sub">
                    섹터별 상위 글을 묶어 LLM이 카테고리 단위로 인용 가능하도록 구성.
                  </p>
                </div>
                <div className="anchor">sectors</div>
              </div>

              {sectorBands.map(band => {
                const summary = SECTOR_SUMMARY[band.sector.slug]
                const moreHref = buildFilterHref({
                  city: cityFilter,
                  sector: band.sector.slug,
                  sort: sortMode,
                })
                return (
                  <div className="bi-sector-band" key={band.sector.slug}>
                    <div className="bi-sector-info">
                      <h3>
                        <span className="n">{band.count}</span>
                        <span className="it">{band.sector.name}</span>
                      </h3>
                      {summary && <p>{summary.desc}</p>}
                      {summary?.queries && summary.queries.length > 0 && (
                        <div className="top-q">
                          TOP 인용 질의
                          <br />
                          {summary.queries.map((q, idx) => (
                            <span key={idx}>
                              <span className="acc">→</span> &ldquo;<b>{q}</b>&rdquo;
                              <br />
                            </span>
                          ))}
                        </div>
                      )}
                      <Link
                        href={moreHref}
                        style={{
                          marginTop: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--mono)',
                          fontSize: 11.5,
                          color: 'var(--aip-accent)',
                          textDecoration: 'none',
                          letterSpacing: '.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {band.sector.name} 전체 {band.count}편 →
                      </Link>
                    </div>
                    <div className="bi-sector-posts">
                      {band.posts.map(p => (
                        <Link
                          key={p.slug}
                          className="bi-sp-row"
                          href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                        >
                          <span className={`bi-type-tag ${p.postType}`}>
                            {POST_TYPE_LABEL[p.postType]}
                          </span>
                          <h3>{p.title}</h3>
                          <span className="when">{p.publishedAt?.slice(5, 10) ?? '—'}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* METHODOLOGY */}
        <section className="bi-section no-border" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="bi-h">
              <div>
                <h2>
                  <span className="it">Methodology</span> · 우리는 이렇게 씁니다
                </h2>
                <p className="sub">모든 글이 같은 3단계 검증을 통과합니다.</p>
              </div>
              <div className="anchor">methodology</div>
            </div>

            <div className="bi-method">
              <div className="item">
                <span className="num">01</span>
                <b>표 + 출처</b>
                <p>
                  모든 가격·시간·평점은 <b style={{ color: '#fff' }}>표 형식</b>으로 정리하고, 각
                  셀에 출처(Google·카카오·업체 제공)와 수집 날짜를 명시. AI는 출처 있는 표만 그대로
                  인용합니다.
                </p>
              </div>
              <div className="item">
                <span className="num">02</span>
                <b>FAQ 마크업</b>
                <p>
                  독자가 실제로 검색하는 자연어 질문을 글 안에 수록하고 FAQPage 스키마로 마크업.
                  ChatGPT가 답변 시 단답으로 추출 가능합니다.
                </p>
              </div>
              <div className="item">
                <span className="num">03</span>
                <b>14일 갱신 주기</b>
                <p>
                  모든 글은 14일마다 가격·운영시간·신규 업체를 체크해 업데이트.{' '}
                  <b style={{ color: '#fff' }}>last reviewed</b> 날짜를 글 상단에 명시합니다.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
