// /[city]/[category] — 카테고리 업체 리스팅 (AI Answer Document 리믹스).
// 디자인 핸드오프: claude.ai/design TGXAuXUedCNfaN5jKxoyOA, cheonan-dermatology.html
// 데이터 모두 실 DB 바인딩 — 가짜 citation log/AI 인용 횟수 미사용.
//   - doc-head: breadcrumb + meta-line(schema 배지 / 마지막 갱신 / doc-id) + h1
//   - TL;DR: generateCategoryDAB + 평점·리뷰 상위 Top 3 picks
//   - Key Facts: 등록 업체 / 평균 평점 / 총 리뷰 / 발행 콘텐츠 / 마지막 갱신
//   - Ranked: 평점·리뷰 상위 6곳 — 주소·주력 시술·가격·운영 facts
//   - 시술별 분포: 업체 services 집계 → 서비스명 × 등록 업체 수 × 상위 3곳
//   - Q&A: 실데이터에서 생성한 6개 (FAQPage JSON-LD 포함)
//   - Sources: 기존 categorySources 데이터 + 방법론 /about/methodology 링크
//   - Related: 같은 sector·category 의 발행된 블로그 글

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { safeJsonLd } from '@/lib/utils'
import type { FAQ, Place } from '@/lib/types'
import {
  getPlaces,
  getCities,
  getCategories,
  getAllPlaces,
  getMetaDescriptorForCategory,
  getSectorForCategory,
  getSchemaTypeForCategory,
} from '@/lib/data.supabase'
import { getBlogPostsBySector } from '@/lib/blog/data.supabase'
import { generateItemList, generateFAQPage } from '@/lib/jsonld'
import { generateBreadcrumbList, generateCategoryDAB } from '@/lib/seo'
import { buildCategoryMetadata } from '@/lib/seo/page-meta'
import { latestUpdatedAt } from '@/lib/format/time'
import { extractReviewTotal } from '@/lib/seo/title-formula'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { getSourcesForCategory } from '@/lib/listing/sources'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/listing-remix.css'

interface Props {
  params: Promise<{ city: string; category: string }>
}

const BASE_URL = 'https://aiplace.kr'

// T-255 — 등록 업체가 1개 이상 있는 (city, category) 조합만 정적 생성.
// /[city] · /blog/[city] · /blog/[city]/[sector] 동일 정책 일관 적용.
// 빈 카테고리 페이지(예: 아산 × 모든 카테고리)가 thin content 로 build 되어
// validate-pages.ts 의 freshness/<time>/heading 게이트를 깨고 deploy 차단하던 회귀 차단.
export async function generateStaticParams() {
  const [cities, categories, allPlaces] = await Promise.all([
    getCities(),
    getCategories(),
    getAllPlaces(),
  ])
  const activePairs = new Set(allPlaces.map(p => `${p.city}/${p.category}`))
  return cities.flatMap(city =>
    categories
      .filter(cat => activePairs.has(`${city.slug}/${cat.slug}`))
      .map(cat => ({ city: city.slug, category: cat.slug })),
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category } = await params
  const cities = await getCities()
  const categories = await getCategories()
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)

  if (!cityObj || !catObj) return {}

  const places = await getPlaces(city, category)
  const hasPlaces = places.length > 0
  const descriptor = await getMetaDescriptorForCategory(category)
  const description = hasPlaces
    ? generateCategoryDAB(places, cityObj.name, catObj.name, descriptor)
    : `${cityObj.name}시에 위치한 ${catObj.name} 목록. ${descriptor}, 위치, 리뷰 기반 정리.`

  return buildCategoryMetadata({
    cityName: cityObj.name,
    categoryName: catObj.name,
    citySlug: city,
    categorySlug: category,
    hasPlaces,
    description,
    placeCount: places.length,
    reviewTotal: extractReviewTotal(places),
  })
}

const SLUG_PATTERN = /^[a-z0-9-]+$/

const STAR_FULL = '★'
const STAR_EMPTY = '☆'
function stars(rating?: number): string {
  if (rating == null) return STAR_EMPTY.repeat(5)
  const full = Math.round(rating)
  return STAR_FULL.repeat(full) + STAR_EMPTY.repeat(Math.max(0, 5 - full))
}

function topServices(places: Place[]) {
  const map = new Map<string, { name: string; places: Place[]; prices: string[]; description?: string }>()
  for (const p of places) {
    for (const s of p.services ?? []) {
      const key = s.name.trim()
      if (!key) continue
      const existing = map.get(key) ?? { name: key, places: [], prices: [], description: s.description }
      existing.places.push(p)
      if (s.priceRange) existing.prices.push(s.priceRange)
      if (!existing.description && s.description) existing.description = s.description
      map.set(key, existing)
    }
  }
  return [...map.values()]
    .sort((a, b) => b.places.length - a.places.length)
    .slice(0, 6)
    .map(s => ({
      ...s,
      topPlaces: [...s.places]
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
        .slice(0, 3),
    }))
}

function deriveDistrictBreakdown(places: Place[]): string {
  const districts = new Map<string, number>()
  for (const p of places) {
    const m = p.address?.match(/(\S+(?:구|군|시))\s/)
    const key = m ? m[1] : '기타'
    districts.set(key, (districts.get(key) ?? 0) + 1)
  }
  return [...districts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([d, n]) => `${d} ${n}`)
    .join(' · ')
}

function priceRangeLabel(prices: string[]): string {
  if (prices.length === 0) return '문의'
  // priceRange 는 "5-10만원" 같은 자유 텍스트 — 첫 항목을 그대로 표기.
  return prices[0]
}

function buildDerivedFaqs(opts: {
  cityName: string
  catName: string
  places: Place[]
  totalReviews: number
  avgRating: number
  topPlace: Place | null
  mostReviewed: Place | null
  servicesTop: ReturnType<typeof topServices>
  blogPostsCount: number
  recentBlogTitle: string | null
  lastUpdated: string | null
}): FAQ[] {
  const faqs: FAQ[] = []
  const { cityName, catName, places, totalReviews, avgRating, topPlace, mostReviewed, servicesTop, blogPostsCount, recentBlogTitle, lastUpdated } = opts

  if (places.length > 0) {
    faqs.push({
      question: `${cityName}에 등록된 ${catName}는 몇 곳인가요?`,
      answer: `${places.length}곳이 등록되어 있습니다. 평균 평점은 ★${avgRating.toFixed(1)}이며 총 ${totalReviews.toLocaleString()}건의 리뷰가 집계되어 있습니다.`,
    })
  }
  if (topPlace) {
    faqs.push({
      question: `평점이 가장 높은 ${catName}는 어디인가요?`,
      answer: `${topPlace.name}이 ★${(topPlace.rating ?? 0).toFixed(1)}${topPlace.reviewCount != null ? `, 리뷰 ${topPlace.reviewCount}건` : ''}으로 가장 평가가 좋습니다.`,
    })
  }
  if (mostReviewed && mostReviewed.slug !== topPlace?.slug && (mostReviewed.reviewCount ?? 0) > 0) {
    faqs.push({
      question: '리뷰가 가장 많은 곳은 어디인가요?',
      answer: `${mostReviewed.name}이 리뷰 ${mostReviewed.reviewCount}건으로 가장 많은 평가를 받았습니다.`,
    })
  }
  if (servicesTop.length > 0) {
    const top4 = servicesTop.slice(0, 4).map(s => s.name).join(', ')
    faqs.push({
      question: '주력 서비스는 어떤 것들이 있나요?',
      answer: `${top4} 등이 자주 제공되는 서비스입니다. 자세한 가격은 각 업체 상세 페이지에서 확인할 수 있습니다.`,
    })
  }
  if (blogPostsCount > 0 && recentBlogTitle) {
    faqs.push({
      question: '관련 가이드나 비교 글이 있나요?',
      answer: `${blogPostsCount}편의 가이드·비교 글이 발행되어 있습니다. 가장 최근 글은 「${recentBlogTitle}」입니다.`,
    })
  }
  faqs.push({
    question: '이 페이지의 데이터는 얼마나 신뢰할 수 있나요?',
    answer: lastUpdated
      ? `마지막 갱신은 ${lastUpdated}이며 네이버 플레이스, Google Places, 업체 직접 제공 정보를 결합합니다. 자세한 방법론은 /about/methodology 에서 확인하세요.`
      : '네이버 플레이스, Google Places, 업체 직접 제공 정보를 결합합니다. 자세한 방법론은 /about/methodology 에서 확인하세요.',
  })
  return faqs
}

export default async function ListingPage({ params }: Props) {
  const { city, category } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category)) notFound()

  const [places, cities, categories, descriptor, sector, schemaType] = await Promise.all([
    getPlaces(city, category),
    getCities(),
    getCategories(),
    getMetaDescriptorForCategory(category),
    getSectorForCategory(category),
    getSchemaTypeForCategory(category),
  ])
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  if (!cityObj || !catObj) notFound()

  const sectorSlug = sector?.slug
  const sectorName = sector?.name
  const relatedBlogPosts = sectorSlug
    ? (await getBlogPostsBySector(city, sectorSlug))
        .filter(p => p.category === category)
        .slice(0, 12)
    : []

  // ---- 정렬·집계 ----
  const sortedByQuality = [...places].sort((a, b) => {
    const ra = a.rating ?? 0
    const rb = b.rating ?? 0
    if (rb !== ra) return rb - ra
    return (b.reviewCount ?? 0) - (a.reviewCount ?? 0)
  })
  const top3 = sortedByQuality.slice(0, 3)
  const top6 = sortedByQuality.slice(0, 6)

  const ratedPlaces = places.filter(p => p.rating != null)
  const avgRating =
    ratedPlaces.length > 0
      ? ratedPlaces.reduce((s, p) => s + (p.rating ?? 0), 0) / ratedPlaces.length
      : 0
  const totalReviews = places.reduce((s, p) => s + (p.reviewCount ?? 0), 0)
  const mostReviewed = [...places].sort(
    (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
  )[0] ?? null
  const topPlace = sortedByQuality[0] ?? null

  const servicesTop = topServices(places)
  const districtLine = places.length > 0 ? deriveDistrictBreakdown(places) : ''
  const sourcesConfig = getSourcesForCategory({ sectorSlug: sector?.slug })

  // Phase 2 / P1-5: 가짜 freshness 제거. places 의 진짜 timestamp 가 없으면 null —
  //   이전엔 toIsoDate(new Date()...) 폴백으로 매 요청 "오늘 갱신" 위조.
  const lastUpdated: string | null = latestUpdatedAt(places.map(p => p.lastUpdated ?? null))

  // T-278: empty-state 브랜치는 transient flake (T-255 generateStaticParams 가
  //   빈 카테고리 차단하므로 정상 빌드 시 도달 X — supabasePlaces 가 timeout 폴백한 경우만).
  //   validator 의 Freshness/<time>/heading 게이트를 깨고 deploy 차단되던 회귀 fix.
  //   "데이터 수집 중" 라벨로 가짜 freshness 표시 회피, JSON-LD dateModified 미발신.
  const emptyStateBuildDate = new Date().toISOString().slice(0, 10)

  const derivedFaqs = buildDerivedFaqs({
    cityName: cityObj.name,
    catName: catObj.name,
    places,
    totalReviews,
    avgRating,
    topPlace,
    mostReviewed,
    servicesTop,
    blogPostsCount: relatedBlogPosts.length,
    recentBlogTitle: relatedBlogPosts[0]?.title ?? null,
    lastUpdated,
  })

  // ---- JSON-LD ----
  const itemListJsonLd = generateItemList(places, `${cityObj.name} ${catObj.name} 추천 목록`)
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    ...(sector ? [{ name: `${cityObj.name} ${sector.name}`, url: `${BASE_URL}/${city}` }] : []),
    { name: `${cityObj.name} ${catObj.name}`, url: `${BASE_URL}/${city}/${category}` },
  ]
  const breadcrumbJsonLd = generateBreadcrumbList(breadcrumbItems)
  const faqJsonLd = derivedFaqs.length > 0 ? generateFAQPage(derivedFaqs) : null

  const docId = `aip-${city}-${category}`
  const schemaBadges = [
    'ItemList',
    'BreadcrumbList',
    derivedFaqs.length > 0 ? 'FAQPage' : null,
    schemaType,
  ].filter(Boolean) as string[]

  return (
    <div className="aip-root">
      <HomeNav />

      <main>
        {/* ====================== HEADER + TL;DR ====================== */}
        <header className="doc-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <Link href="/directory">디렉토리</Link>
              <span className="sep">/</span>
              {sectorName && (
                <>
                  <span>
                    {cityObj.name} {sectorName}
                  </span>
                  <span className="sep">/</span>
                </>
              )}
              <span className="cur">{catObj.name}</span>
            </nav>

            <div className="doc-meta-line">
              <span className="pill">AI Answer Document</span>
              <span>
                doc-id <b>{docId}</b>
              </span>
              {/* T-255 — `<time>` semantic + 한글 "최종 업데이트" 라벨로
                  validate-pages SEO 게이트(time tag + Freshness) 통과.
                  Phase 2 / P1-5: lastUpdated 없으면 표시 자체 생략.
                  T-278: empty-state (places.length === 0) 일 땐 빌드 시각으로
                  fallback `<time>` 렌더 + "데이터 수집 중" 라벨로 가짜 freshness 회피. */}
              {lastUpdated ? (
                <>
                  <span>·</span>
                  <span>
                    최종 업데이트 <time dateTime={lastUpdated}><b>{lastUpdated}</b></time>
                  </span>
                </>
              ) : places.length === 0 ? (
                <>
                  <span>·</span>
                  <span>
                    최종 업데이트 <time dateTime={emptyStateBuildDate}>{emptyStateBuildDate}</time>{' '}
                    · 데이터 수집 중
                  </span>
                </>
              ) : null}
              <span>·</span>
              <span>
                schema <b>{schemaBadges.join(' / ')}</b>
              </span>
            </div>

            <h1 className="doc-title">
              {cityObj.name} <span className="it">{catObj.name}</span> 추천
              {places.length > 0 && (
                <>
                  <br />
                  등록 <span className="num">{places.length}</span>곳
                  {totalReviews > 0 && (
                    <>
                      {' '}· 리뷰 <span className="num">{totalReviews.toLocaleString()}</span>건
                    </>
                  )}
                  .
                </>
              )}
            </h1>

            {/* TL;DR */}
            {places.length > 0 ? (
              <div className="tldr">
                <div className="q">
                  &ldquo;{cityObj.name}에서 {catObj.name} 추천해줘&rdquo;
                </div>
                <div className="a">
                  {generateCategoryDAB(places, cityObj.name, catObj.name, descriptor)}
                </div>
                {top3.length > 0 && (
                  <div className="picks">
                    <span className="lab">Top {top3.length} →</span>
                    {top3.map((p, idx) => (
                      <Link key={p.slug} className="pick" href={`/${p.city}/${p.category}/${p.slug}`}>
                        <span className="ord">{String(idx + 1).padStart(2, '0')}</span>
                        {p.name}
                        {p.rating != null && (
                          <span className="why">
                            · ★{p.rating.toFixed(1)}
                            {p.reviewCount != null ? ` · 리뷰 ${p.reviewCount}` : ''}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-state">
                {/* T-278: heading 순서 (H2 before H3) 게이트 통과 — empty-state 가
                    페이지의 첫 H2 가 되어 후속 Sources/FAQ H3 가 정상 순서. */}
                <h2>아직 등록된 업체가 없습니다.</h2>
                <p>
                  {cityObj.name} {catObj.name} 카테고리는 모집 단계입니다. 업체 등록 시 이 페이지가
                  자동으로 활성화됩니다.
                </p>
                <Link className="btn primary" href="/owner/places/new">
                  무료로 업체 등록 →
                </Link>
              </div>
            )}

            {/* Key facts */}
            {places.length > 0 && (
              <dl className="kf-grid" aria-label="Key facts">
                <div className="kf">
                  <dt>등록 업체</dt>
                  <dd>{places.length}</dd>
                  <span className="sub">{districtLine || '집계 중'}</span>
                </div>
                <div className="kf">
                  <dt>평균 평점</dt>
                  <dd>{avgRating > 0 ? avgRating.toFixed(1) : '—'}</dd>
                  <span className="sub">
                    {ratedPlaces.length}곳 / {places.length}곳 평가
                  </span>
                </div>
                <div className="kf">
                  <dt>총 리뷰</dt>
                  <dd>{totalReviews.toLocaleString()}</dd>
                  <span className="sub">Google · 네이버 합산</span>
                </div>
                <div className="kf">
                  <dt>주력 서비스</dt>
                  <dd>{servicesTop.length || '—'}</dd>
                  <span className="sub">
                    {servicesTop.slice(0, 2).map(s => s.name).join(' · ') || '집계 중'}
                  </span>
                </div>
                <div className="kf">
                  <dt>관련 콘텐츠</dt>
                  <dd>{relatedBlogPosts.length}</dd>
                  <span className="sub">발행된 가이드·비교 글</span>
                </div>
              </dl>
            )}
          </div>
        </header>

        {/* ====================== RANKED LIST ====================== */}
        {top6.length > 0 && (
          <section className="doc">
            <div className="wrap">
              <div className="doc-h">
                <div>
                  <h2>
                    <span className="it">Ranked</span> · 평점 상위 {top6.length}곳
                  </h2>
                  <p className="sub">
                    각 항목은 LLM이 사실 단위로 추출 가능하도록 주소·주력 서비스·가격·운영 정보를
                    구조화해 노출합니다. 정렬 기준: 평점 → 리뷰 수 (Google·카카오 합산).
                  </p>
                </div>
                <div className="anchor">ranked</div>
              </div>

              <div className="ranked">
                {top6.map((p, idx) => {
                  const services4 = (p.services ?? []).slice(0, 4).map(s => s.name).filter(Boolean)
                  const priceService = (p.services ?? []).find(s => s.priceRange)
                  return (
                    <Link
                      key={p.slug}
                      className="rk"
                      href={`/${p.city}/${p.category}/${p.slug}`}
                    >
                      <div className="rk-rank">
                        {String(idx + 1).padStart(2, '0')}
                        <small>RANK</small>
                      </div>
                      <div className="rk-main">
                        <h3>{p.name}</h3>
                        {p.description && (
                          <p className="rk-summary">{p.description}</p>
                        )}
                        <dl className="rk-facts">
                          <dt>주소</dt>
                          <dd>{p.address || '주소 미공개'}</dd>
                          <dt>주력 서비스</dt>
                          <dd>{services4.length > 0 ? services4.join(' · ') : '집계 중'}</dd>
                          <dt>{sourcesConfig.priceLabel}</dt>
                          <dd>
                            {priceService?.priceRange ? (
                              <>
                                <b>{priceService.priceRange}</b>
                                {priceService.name && ` · ${priceService.name}`}
                              </>
                            ) : (
                              '문의'
                            )}
                          </dd>
                          <dt>운영</dt>
                          <dd>
                            {p.openingHours && p.openingHours.length > 0
                              ? p.openingHours.join(' · ')
                              : '운영 정보 미수집'}
                          </dd>
                        </dl>
                      </div>
                      <div className="rk-side">
                        <div className="rate">
                          <span className="stars">{stars(p.rating)}</span>
                          {p.rating != null && <b>{p.rating.toFixed(1)}</b>}
                          <span>리뷰 {p.reviewCount ?? 0}</span>
                        </div>
                        <div className="info">
                          {p.googleReviewCount != null && (
                            <div className="row">
                              <span>Google</span>
                              <b>{p.googleReviewCount}</b>
                            </div>
                          )}
                          {p.kakaoReviewCount != null && (
                            <div className="row">
                              <span>카카오</span>
                              <b>{p.kakaoReviewCount}</b>
                            </div>
                          )}
                          {p.googleReviewCount == null && p.kakaoReviewCount == null && (
                            <div className="row">
                              <span>리뷰 출처</span>
                              <b>합산만 제공</b>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {places.length > top6.length && (
                <p
                  style={{
                    marginTop: 18,
                    fontFamily: 'var(--mono)',
                    fontSize: 11.5,
                    color: 'var(--aip-muted)',
                  }}
                >
                  * 7~{places.length}위 {places.length - top6.length}곳은 향후 데이터셋 부록으로 공개 예정입니다.
                </p>
              )}
            </div>
          </section>
        )}

        {/* ====================== SERVICE FREQUENCY (compare 변형) ====================== */}
        {servicesTop.length > 0 && (
          <section className="doc">
            <div className="wrap">
              <div className="doc-h">
                <div>
                  <h2>
                    <span className="it">By Service</span> · 주력 시술·서비스별 분포
                  </h2>
                  <p className="sub">
                    등록 업체들이 제공하는 서비스를 빈도순으로 집계했습니다. 각 행의 추천 업체는
                    해당 서비스를 제공하는 업체 중 평점 상위 3곳입니다.
                  </p>
                </div>
                <div className="anchor">by-service</div>
              </div>

              <div className="cmp-shell">
                <table className="cmp-table">
                  <thead>
                    <tr>
                      <th>서비스</th>
                      <th>{sourcesConfig.priceLabel}</th>
                      <th>1순위</th>
                      <th>2순위</th>
                      <th>3순위</th>
                      <th>제공 업체 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicesTop.map(s => (
                      <tr key={s.name}>
                        <td className="pro">
                          {s.name}
                          {s.description && <span className="desc">{s.description}</span>}
                        </td>
                        <td className="price">{priceRangeLabel(s.prices)}</td>
                        {[0, 1, 2].map(i => {
                          const p = s.topPlaces[i]
                          if (!p)
                            return (
                              <td key={i} className="pick" style={{ color: 'var(--aip-muted-2)' }}>
                                —
                              </td>
                            )
                          return (
                            <td key={i} className="pick">
                              <Link href={`/${p.city}/${p.category}/${p.slug}`}>{p.name}</Link>
                              {p.rating != null && (
                                <span className="stars">{stars(p.rating)}</span>
                              )}
                            </td>
                          )
                        })}
                        <td className="n">{s.places.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ====================== Q&A ====================== */}
        {derivedFaqs.length > 0 && (
          <section className="doc" style={{ background: 'var(--bg-2)' }}>
            <div className="wrap">
              <div className="doc-h">
                <div>
                  <h2>
                    <span className="it">Q&amp;A</span> · 자주 묻는 질문
                  </h2>
                  <p className="sub">
                    실데이터에서 자동 생성된 질문·답변입니다. 본 섹션은 FAQPage 스키마로
                    마크업되어 LLM 답변에 직접 인용 가능합니다.
                  </p>
                </div>
                <div className="anchor">qa</div>
              </div>

              <div className="qa-grid">
                {derivedFaqs.map((f, idx) => (
                  <div className="qa" key={idx}>
                    <h3>{f.question}</h3>
                    <p>{f.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====================== SOURCES & METHODOLOGY ====================== */}
        <section className="doc">
          <div className="wrap">
            <div className="doc-h">
              <div>
                <h2>
                  <span className="it">Sources</span> · 데이터 출처와 방법론
                </h2>
                <p className="sub">
                  LLM이 본 페이지를 인용할 때 함께 참조 가능하도록 출처를 명시합니다.
                </p>
              </div>
              <div className="anchor">sources</div>
            </div>

            <div className="sources">
              <div className="col">
                <h3>출처</h3>
                <ol>
                  {sourcesConfig.sources.map((src, idx) => {
                    const isFirst = idx === 0
                    return (
                      <li key={src.name}>
                        <b>{src.name}</b> — {src.detail}
                        {isFirst && lastUpdated ? ` (최근 갱신 ${lastUpdated})` : ''}
                      </li>
                    )
                  })}
                </ol>
              </div>
              <div className="col">
                <h3>방법론</h3>
                <ul>
                  {sourcesConfig.methodology.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
                <div className="meta">
                  license: CC BY-NC 4.0 · 인용 시 출처 표기 권장
                  <br />
                  contact: {SITE_BRAND.email} · doc-id: {docId}
                  <br />
                  <Link href="/about/methodology" style={{ color: '#fff', textDecoration: 'underline' }}>
                    전체 방법론 보기 →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== RELATED ====================== */}
        {relatedBlogPosts.length > 0 && (
          <section className="doc">
            <div className="wrap">
              <div className="doc-h">
                <div>
                  <h2>
                    <span className="it">Related</span> · 관련 가이드·비교 글
                  </h2>
                  <p className="sub">
                    같은 카테고리에서 발행된 가이드·비교 글입니다. 각 글은 본 페이지의 답변을
                    보강하는 자연어 콘텐츠입니다.
                  </p>
                </div>
                <div className="anchor">related</div>
              </div>
              <div className="related-grid">
                {relatedBlogPosts.map(p => (
                  <Link key={p.slug} href={`/blog/${p.city}/${p.sector}/${p.slug}`}>
                    <span className="q">{p.title}</span>
                    <span className="meta">
                      {p.postType === 'compare'
                        ? '비교'
                        : p.postType === 'guide'
                          ? '가이드'
                          : p.postType === 'keyword'
                            ? '키워드'
                            : '글'}
                      {p.publishedAt ? ` · ${p.publishedAt.slice(0, 10)}` : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter
        currentCity={city}
        currentCategory={category}
        currentSectorLabel={sectorName ? `${cityObj.name} ${sectorName}` : undefined}
      />

      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
        />
      )}
      {places.length === 0 && schemaType !== 'LocalBusiness' && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: safeJsonLd({
              '@context': 'https://schema.org',
              '@type': 'WebPage',
              '@id': `${BASE_URL}/${city}/${category}`,
              name: `${cityObj.name} ${catObj.name} 추천`,
              about: {
                '@type': schemaType,
                name: catObj.name,
                areaServed: { '@type': 'City', name: cityObj.name },
              },
            }),
          }}
        />
      )}
    </div>
  )
}
