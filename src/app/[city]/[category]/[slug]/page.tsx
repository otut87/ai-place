// /[city]/[category]/[slug] — 업체 상세 (AI Answer Document 리믹스).
// 디자인 핸드오프: claude.ai/design P3-2gGfNJK0LMXfXG1qsNA, shinebeam.html
// 데이터 모두 실 DB 바인딩 — 가짜 citation log/AI 인용 횟수·맵 SVG 미사용.

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Disclaimer } from '@/components/business/disclaimer'
import { PlaceExternalLinks } from '@/components/business/place-external-links'
import { ReportPlaceButton } from '@/components/business/report-place-button'
import { PhoneButton } from '@/components/phone-button'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { PlaceTabs } from './_components/place-tabs'
import {
  getPlaceBySlug,
  getPlaces,
  getAllPlaces,
  getCities,
  getCategories,
  getSchemaTypeForCategory,
  getSectorForCategory,
} from '@/lib/data.supabase'
import { getBlogPostsByPlace } from '@/lib/blog/data.supabase'
import { generateLocalBusiness, generateFAQPage, generateWebPage } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { buildPlaceMetadata } from '@/lib/seo/page-meta'
import { safeJsonLd } from '@/lib/utils'
import { getPlaceDetails } from '@/lib/google-places'
import { getSourcesForCategory } from '@/lib/listing/sources'
import { formatHoursKo } from '@/lib/format/hours'
import { normalizeAddress } from '@/lib/format/address'
import type { Place } from '@/lib/types'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/place-detail-remix.css'

interface Props {
  params: Promise<{ city: string; category: string; slug: string }>
}

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

const STAR_FULL = '★'
const STAR_EMPTY = '☆'
function stars(rating?: number): string {
  if (rating == null) return STAR_EMPTY.repeat(5)
  const full = Math.round(rating)
  return STAR_FULL.repeat(full) + STAR_EMPTY.repeat(Math.max(0, 5 - full))
}

const KO_DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const KO_DAY_LABEL: Record<string, string> = { Mo: '월', Tu: '화', We: '수', Th: '목', Fr: '금', Sa: '토', Su: '일' }

/** 도로명 주소에서 첫 시·구·군 토큰 추출 → 디스트릭트 라벨용. */
function extractDistrict(address: string | undefined): string {
  if (!address) return ''
  const m = address.match(/(\S+(?:시|군))\s*(\S+(?:구|군))?/)
  if (!m) return ''
  return [m[1], m[2]].filter(Boolean).join(' ')
}

/** openingHours(["Mo-Fr 09:00-18:00", "Sa 09:00-13:00"]) → 요일별 표 */
function buildHoursRows(openingHours: string[] | undefined): Array<{ day: string; label: string; isToday: boolean }> {
  const todayIdx = new Date().getDay() // Sunday=0
  const todayKey = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][todayIdx]
  const map = new Map<string, string>()
  for (const entry of openingHours ?? []) {
    const m = entry.match(/^([A-Za-z]+(?:-[A-Za-z]+)?)\s+(.+)$/)
    if (!m) continue
    const span = m[1]
    const time = m[2]
    if (span.includes('-')) {
      const [start, end] = span.split('-')
      const startIdx = KO_DAYS.indexOf(start)
      const endIdx = KO_DAYS.indexOf(end)
      if (startIdx >= 0 && endIdx >= 0) {
        for (let i = startIdx; i <= endIdx; i++) map.set(KO_DAYS[i], time)
      }
    } else {
      map.set(span, time)
    }
  }
  return KO_DAYS.map(d => ({
    day: d,
    label: map.get(d) ?? '휴무',
    isToday: d === todayKey,
  }))
}

export async function generateStaticParams() {
  // Phase 2 / P1-4 (codex review 2026-04-30): N×M DB 쿼리 폭증 차단.
  //   기존엔 10도시 × 83카테고리 = 830 DB calls during build. 도시 늘면 그대로 비례.
  //   getAllPlaces() 1회로 전체 slug 셋을 메모리에 로드 후 필터링 — DB 호출 1회로 끝.
  const places = await getAllPlaces()
  return places.map(place => ({
    city: place.city,
    category: place.category,
    slug: place.slug,
  }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category, slug } = await params
  const place = await getPlaceBySlug(city, category, slug)
  if (!place) return {}
  const cities = await getCities()
  const categories = await getCategories()
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  return buildPlaceMetadata({
    place,
    cityName: cityObj?.name ?? city,
    categoryName: catObj?.name ?? category,
    citySlug: city,
    categorySlug: category,
  })
}

export default async function ProfilePage({ params }: Props) {
  const { city, category, slug } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category) || !SLUG_PATTERN.test(slug)) notFound()

  const [place, cities, categories] = await Promise.all([
    getPlaceBySlug(city, category, slug),
    getCities(),
    getCategories(),
  ])
  if (!place) notFound()

  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  if (!cityObj || !catObj) notFound()

  const pageUrl = `${BASE_URL}/${city}/${category}/${slug}`
  const sector = await getSectorForCategory(category)
  const schemaType = await getSchemaTypeForCategory(category)
  const sourcesConfig = getSourcesForCategory({ sectorSlug: sector?.slug })

  const googleData = place.googlePlaceId ? await getPlaceDetails(place.googlePlaceId) : null
  const placeWithGoogleData: Place = googleData
    ? {
        ...place,
        rating: googleData.rating,
        reviewCount: googleData.reviewCount,
        googleBusinessUrl: googleData.googleMapsUri ?? place.googleBusinessUrl,
      }
    : place

  // 같은 카테고리·도시의 평점 상위 비슷한 업체 (자기 자신 제외)
  const sameCategoryPlaces = await getPlaces(city, category)
  const similarPlaces = [...sameCategoryPlaces]
    .filter(p => p.slug !== place.slug && p.rating != null)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 3)

  const relatedBlogPosts = await getBlogPostsByPlace(place.slug)

  // 통계
  const finalRating = googleData?.rating ?? place.rating
  const finalReviewCount = googleData?.reviewCount ?? place.reviewCount
  const totalServices = place.services?.length ?? 0
  const startingPriceService = place.services?.find(s => s.priceRange)
  const district = extractDistrict(place.address)
  const docId = `aip-${city}-${category}-${slug}`
  // Phase 2 / P1-5 (codex review 2026-04-30): 가짜 freshness 제거.
  //   place.lastUpdated 가 없으면 표시 안 함 (이전엔 new Date() 폴백으로 매 요청 "오늘 갱신"
  //   처럼 보였음 — 실제 변경 없는데 freshness 신호 위조). null 시 표시처에서 falsy 분기.
  const lastUpdated: string | null = place.lastUpdated ? place.lastUpdated.slice(0, 10) : null
  const hoursRows = buildHoursRows(place.openingHours)

  // WHY card 합성: description + strengths/recommendedFor 우선 노출
  const whyReasons: Array<{ title: string; sub: string }> = []
  if (place.strengths && place.strengths.length > 0) {
    whyReasons.push({ title: place.strengths[0], sub: '핵심 강점' })
    if (place.strengths[1]) whyReasons.push({ title: place.strengths[1], sub: '핵심 강점' })
  }
  if (place.recommendedFor && place.recommendedFor.length > 0) {
    whyReasons.push({ title: place.recommendedFor[0], sub: '추천 대상' })
  }
  if (whyReasons.length < 3 && finalRating != null) {
    whyReasons.push({
      title: `★${finalRating.toFixed(1)} (리뷰 ${finalReviewCount ?? 0}건)`,
      sub: 'Google·카카오 합산',
    })
  }

  // 리뷰 키워드 카드 (있을 때만)
  type KeywordRow = { word: string; count: number; negative?: boolean }
  const keywordRows: KeywordRow[] = []
  for (const summary of place.reviewSummaries ?? []) {
    for (const theme of summary.positiveThemes ?? []) {
      const existing = keywordRows.find(k => k.word === theme && !k.negative)
      if (existing) existing.count += 1
      else keywordRows.push({ word: theme, count: 1 })
    }
    for (const theme of summary.negativeThemes ?? []) {
      const existing = keywordRows.find(k => k.word === theme && k.negative)
      if (existing) existing.count += 1
      else keywordRows.push({ word: theme, count: 1, negative: true })
    }
  }
  keywordRows.sort((a, b) => Number(a.negative) - Number(b.negative) || b.count - a.count)

  // JSON-LD
  const localBusinessJsonLd = generateLocalBusiness(placeWithGoogleData, pageUrl, schemaType)
  const faqJsonLd = place.faqs.length > 0 ? generateFAQPage(place.faqs) : null
  const webPageJsonLd = generateWebPage({
    url: pageUrl,
    name: `${place.name} - ${cityObj.name} ${catObj.name}`,
    description: place.description,
    lastUpdated: place.lastUpdated,
  })
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    ...(sector ? [{ name: `${cityObj.name} ${sector.name}`, url: `${BASE_URL}/${city}` }] : []),
    { name: `${cityObj.name} ${catObj.name}`, url: `${BASE_URL}/${city}/${category}` },
    { name: place.name, url: pageUrl },
  ])

  const schemaBadges = [schemaType, faqJsonLd ? 'FAQPage' : null, 'WebPage', 'BreadcrumbList']
    .filter(Boolean)
    .join(' / ')

  // Tabs (해당 데이터 있는 섹션만)
  const tabs: Array<{ id: string; label: string }> = []
  if (totalServices > 0) tabs.push({ id: 'services', label: '서비스·가격' })
  if ((place.reviewSummaries ?? []).length > 0 || googleData?.reviews?.length) tabs.push({ id: 'reviews', label: '리뷰' })
  tabs.push({ id: 'hours', label: '영업시간·위치' })
  if (place.faqs.length > 0) tabs.push({ id: 'faq', label: 'FAQ' })
  if (similarPlaces.length > 0) tabs.push({ id: 'similar', label: '비슷한 업체' })
  tabs.push({ id: 'sources', label: '출처' })

  return (
    <div className="aip-root">
      <HomeNav />

      <main>
        {/* ====================== HEAD ====================== */}
        <header className="pd-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <Link href="/directory">디렉토리</Link>
              <span className="sep">/</span>
              {sector && (
                <>
                  <span>
                    {cityObj.name} {sector.name}
                  </span>
                  <span className="sep">/</span>
                </>
              )}
              <Link href={`/${city}/${category}`}>
                {cityObj.name} {catObj.name}
              </Link>
              <span className="sep">/</span>
              <span className="cur">{place.name}</span>
            </nav>

            <div className="pd-meta-line">
              <span className="pill">AI Answer Document</span>
              <span>
                doc-id <b>{docId}</b>
              </span>
              {/* T-255 — `<time>` semantic + 한글 "최종 업데이트" 라벨로
                  validate-pages SEO 게이트(time tag) 통과.
                  Phase 2 / P1-5: lastUpdated 없으면 표시 자체 생략 (가짜 freshness 회피). */}
              {lastUpdated && (
                <>
                  <span>·</span>
                  <span>
                    최종 업데이트 <time dateTime={lastUpdated}><b>{lastUpdated}</b></time>
                  </span>
                </>
              )}
              <span>·</span>
              <span>
                schema <b>{schemaBadges}</b>
              </span>
            </div>

            <div className="biz-head-grid">
              <div>
                <div className="biz-badges">
                  <span className="chip">{catObj.name}</span>
                  {district && <span className="chip">{district}</span>}
                  {place.placeType && <span className="chip accent">{place.placeType}</span>}
                </div>

                {place.imageUrl && (
                  <div
                    style={{
                      marginTop: 14,
                      aspectRatio: '16 / 9',
                      borderRadius: 'var(--r-lg)',
                      overflow: 'hidden',
                      background: 'var(--bg-2)',
                      position: 'relative',
                    }}
                  >
                    <Image
                      src={place.imageUrl}
                      alt={place.name}
                      fill
                      priority
                      className="object-cover"
                      sizes="(max-width: 980px) 100vw, 720px"
                    />
                  </div>
                )}

                {/* T-259 R6 follow-up — owner 가 등록한 추가 사진 갤러리.
                    AEO 룰 'photos-3' (3장 이상) 충족 시 공개 페이지에도 노출되도록.
                    hero(imageUrl) 와 동일 URL 은 중복 배제. */}
                {(() => {
                  const gallery = (place.images ?? []).filter((img) => img.url && img.url !== place.imageUrl)
                  if (gallery.length === 0) return null
                  return (
                    <div
                      style={{
                        marginTop: 12,
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: 8,
                      }}
                      aria-label={`${place.name} 사진 ${gallery.length}장`}
                    >
                      {gallery.map((img, i) => (
                        <div
                          key={`${img.url}-${i}`}
                          style={{
                            aspectRatio: '4 / 3',
                            borderRadius: 'var(--r-md)',
                            overflow: 'hidden',
                            background: 'var(--bg-2)',
                            position: 'relative',
                          }}
                        >
                          <Image
                            src={img.url}
                            alt={img.alt || `${place.name} 사진 ${i + 2}`}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 980px) 33vw, 240px"
                          />
                        </div>
                      ))}
                    </div>
                  )
                })()}

                <h1 className="biz-title">{place.name}</h1>

                <p className="biz-lede">
                  {place.recommendationNote ?? place.description ?? `${cityObj.name} ${catObj.name} 카테고리 등록 업체.`}
                </p>

                {/* Key facts 5개 */}
                <dl className="kf-strip" aria-label="Key facts">
                  <div className="kf">
                    <dt>평점</dt>
                    <dd>{finalRating != null ? finalRating.toFixed(1) : '—'}</dd>
                    <span className="sub">/ 5.0</span>
                  </div>
                  <div className="kf">
                    <dt>리뷰</dt>
                    <dd>{finalReviewCount ?? 0}</dd>
                    <span className="sub">건 · Google·카카오 합산</span>
                  </div>
                  <div className="kf">
                    <dt>주력 서비스</dt>
                    <dd>{totalServices > 0 ? totalServices : '—'}</dd>
                    <span className="sub">{totalServices > 0 ? '종 · 가격 표기' : '집계 중'}</span>
                  </div>
                  <div className="kf">
                    <dt>{sourcesConfig.priceLabel}</dt>
                    <dd className="accent-dd">{startingPriceService?.priceRange ? startingPriceService.priceRange : '문의'}</dd>
                    <span className="sub">{startingPriceService?.name ?? '상담 후 확정'}</span>
                  </div>
                  {lastUpdated && (
                    <div className="kf">
                      <dt>업데이트</dt>
                      <dd style={{ fontSize: 18, lineHeight: 1.2 }}>{lastUpdated.slice(5).replace('-', '/')}</dd>
                      <span className="sub">{lastUpdated.slice(0, 4)}년 갱신</span>
                    </div>
                  )}
                </dl>

                {/* WHY card */}
                {(place.description || whyReasons.length > 0) && (
                  <div className="why-card">
                    <div className="q">
                      &ldquo;{cityObj.name}에서 {catObj.name} 추천해줘&rdquo;
                    </div>
                    <div className="a">
                      <b>{place.name}</b>
                      {district && <> ({district})</>}은(는) {place.description ?? `${catObj.name} 카테고리 등록 업체입니다.`}
                    </div>
                    {whyReasons.length > 0 && (
                      <div className="reasons">
                        {whyReasons.slice(0, 3).map((r, idx) => (
                          <div className="reason" key={idx}>
                            <span className="num">{String(idx + 1).padStart(2, '0')}</span>
                            <b>{r.title}</b>
                            <span>{r.sub}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Side card */}
              <aside className="side-card">
                <p className="label">예약 · 문의</p>

                {place.phone && (
                  <div className="row">
                    <span className="k">전화</span>
                    <span className="v">
                      <b>{place.phone}</b>
                    </span>
                  </div>
                )}
                <div className="row">
                  <span className="k">주소</span>
                  <span className="v">{normalizeAddress(place.address)}</span>
                </div>
                {place.openingHours && place.openingHours.length > 0 && (
                  <div className="row">
                    <span className="k">영업시간</span>
                    <span className="v">{formatHoursKo(place.openingHours)}</span>
                  </div>
                )}

                <div className="ctas">
                  {place.phone && <PhoneButton phone={place.phone} businessName={place.name} />}
                  <Link className="btn ghost" href="#hours">
                    영업시간·위치
                  </Link>
                </div>

                <div className="foot">
                  {lastUpdated ? `last reviewed ${lastUpdated}` : 'last reviewed: —'}
                  <br />
                  source: Google Places + 업체 직접 제공
                </div>
              </aside>
            </div>
          </div>
        </header>

        <PlaceTabs tabs={tabs} />

        {/* ====================== SERVICES ====================== */}
        {totalServices > 0 && (
          <section id="services" className="pd-section">
            <div className="wrap">
              <div className="pd-h">
                <div>
                  <h2>
                    <span className="it">Services</span> · {sourcesConfig.priceLabel} {totalServices}종
                  </h2>
                  <p className="sub">
                    업체가 직접 제공한 단가표. LLM이 가격 답변 시 그대로 인용 가능하도록 구조화돼 있습니다.
                  </p>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ services</div>
              </div>

              <div className="svc-shell">
                <table className="svc-table">
                  <thead>
                    <tr>
                      <th>서비스</th>
                      <th>비고</th>
                      <th>{sourcesConfig.priceLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {place.services.map(svc => (
                      <tr key={svc.name}>
                        <td className="pro">
                          {svc.name}
                          {svc.description && <span className="desc">{svc.description}</span>}
                        </td>
                        <td style={{ color: 'var(--ink-2)', fontSize: 13 }}>
                          {svc.description ? '' : '상담 후 안내'}
                        </td>
                        <td className="price">{svc.priceRange ?? <small>문의</small>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="svc-foot">
                  출처 — 업체 직접 제공 · 실제 가격은 상담 후 확정
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ====================== REVIEWS ====================== */}
        {((place.reviewSummaries?.length ?? 0) > 0 || (googleData?.reviews?.length ?? 0) > 0) && (
          <section id="reviews" className="pd-section">
            <div className="wrap">
              <div className="pd-h">
                <div>
                  <h2>
                    <span className="it">Reviews</span> · 리뷰 분석
                  </h2>
                  <p className="sub">
                    Google·카카오 공식 리뷰를 키워드 단위로 요약했습니다. 네이버 플레이스 리뷰는 정책상 미노출.
                  </p>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ reviews</div>
              </div>

              <div className="rev-grid">
                <div>
                  {googleData?.reviews?.slice(0, 4).map((r, idx) => {
                    // Places ToS — 작성자 표시명·프로필 URI 가 오면 그대로 노출,
                    // 누락된 경우(드물게 익명 리뷰)에 한해 "익명" 폴백.
                    const displayName = r.authorName?.trim() || '익명'
                    const initial = displayName.slice(0, 1)
                    return (
                      <div className="rev-card" key={idx}>
                        <div className="top">
                          {r.authorPhotoUri ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              className="ava"
                              src={r.authorPhotoUri}
                              alt={displayName}
                              width={32}
                              height={32}
                              style={{ borderRadius: '50%', objectFit: 'cover' }}
                            />
                          ) : (
                            <span className="ava">{initial}</span>
                          )}
                          <div className="meta">
                            {r.authorUri ? (
                              <a
                                href={r.authorUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ fontWeight: 700 }}
                              >
                                {displayName}
                              </a>
                            ) : (
                              <b>{displayName}</b>
                            )}
                            <span>{r.relativeTime}</span>
                          </div>
                          <span className="stars">{stars(r.rating)}</span>
                        </div>
                        <p>{r.text}</p>
                        <div className="src">Google 지도</div>
                      </div>
                    )
                  })}
                </div>

                {keywordRows.length > 0 && (
                  <aside className="kw-card">
                    <h4>
                      AI Review Summary
                      <span className="lg">키워드 빈도 분석</span>
                    </h4>
                    <div className="kw-list">
                      {keywordRows.slice(0, 8).map((k, idx) => (
                        <div className={`kw${k.negative ? ' neg' : ''}`} key={idx}>
                          <span className="w">{k.word}</span>
                          <span className="n">
                            {k.count}회{k.negative ? ' (단점)' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="kw-foot">
                      n={place.reviewSummaries?.length ?? 0} · 14일 갱신
                      <br />
                      method: 리뷰 요약 테마 빈도
                    </div>
                  </aside>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ====================== HOURS / LOCATION ====================== */}
        <section id="hours" className="pd-section" style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="pd-h">
              <div>
                <h2>
                  <span className="it">Hours</span> · 영업시간 · 위치
                </h2>
                <p className="sub">{normalizeAddress(place.address)}</p>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ hours</div>
            </div>

            <div className="loc-grid">
              <div className="loc-card">
                <h3>위치</h3>
                <p className="addr">{place.name}</p>
                <p className="road">{normalizeAddress(place.address)}</p>
                <PlaceExternalLinks place={place} />
                <div className="ext-links" style={{ display: 'none' }} aria-hidden />
              </div>

              <div className="hours">
                {hoursRows.map(row => (
                  <div key={row.day} className={`hour-row${row.isToday ? ' today' : ''}`}>
                    <span className="d">
                      {KO_DAY_LABEL[row.day]} {row.isToday ? '· 오늘' : ''}
                    </span>
                    <span style={{ color: row.label === '휴무' ? 'var(--aip-muted)' : 'var(--ink)' }}>
                      {row.label}
                    </span>
                  </div>
                ))}
                <div className="hour-foot">출처: 업체 등록 정보 · 공휴일 별도 공지</div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================== FAQ ====================== */}
        {place.faqs.length > 0 && (
          <section id="faq" className="pd-section">
            <div className="wrap" style={{ maxWidth: 820 }}>
              <div className="pd-h">
                <div>
                  <h2>
                    <span className="it">FAQ</span> · 자주 묻는 {place.faqs.length}가지
                  </h2>
                  <p className="sub">FAQPage 스키마로 마크업되어 LLM이 단답으로 추출 가능합니다.</p>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ faq</div>
              </div>

              <div className="faq-list">
                {place.faqs.map((faq, idx) => (
                  <details key={idx} open={idx === 0}>
                    <summary>{faq.question}</summary>
                    <div className="ans">{faq.answer}</div>
                  </details>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====================== SIMILAR ====================== */}
        {similarPlaces.length > 0 && (
          <section id="similar" className="pd-section" style={{ background: 'var(--bg-2)' }}>
            <div className="wrap">
              <div className="pd-h">
                <div>
                  <h2>
                    <span className="it">Similar</span> · 비슷한 {cityObj.name} {catObj.name}
                  </h2>
                  <p className="sub">같은 카테고리의 평점 상위 업체입니다.</p>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ similar</div>
              </div>

              <div className="sim-grid">
                {similarPlaces.map((p, idx) => {
                  const dist = extractDistrict(p.address)
                  return (
                    <Link className="sim" key={p.slug} href={`/${p.city}/${p.category}/${p.slug}`}>
                      <span className="rank">평점 상위 {idx + 1}순위</span>
                      <h4>{p.name}</h4>
                      <div className="meta">
                        {dist && `${dist} · `}★ <b>{p.rating?.toFixed(1) ?? '—'}</b> ({p.reviewCount ?? 0})
                      </div>
                      {p.tags && p.tags.length > 0 && (
                        <div className="tags">
                          {p.tags.slice(0, 3).map(t => (
                            <span className="chip" key={t}>
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  )
                })}
              </div>

              <p style={{ marginTop: 16, fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--aip-muted)' }}>
                → {cityObj.name} {catObj.name} 전체 {sameCategoryPlaces.length}곳은{' '}
                <Link href={`/${city}/${category}`} style={{ color: 'var(--aip-accent)' }}>
                  카테고리 페이지
                </Link>
                에서 확인.
              </p>
            </div>
          </section>
        )}

        {/* ====================== RELATED BLOG POSTS ====================== */}
        {relatedBlogPosts.length > 0 && (
          <section className="pd-section">
            <div className="wrap">
              <div className="pd-h">
                <div>
                  <h2>
                    <span className="it">Related</span> · 이 업체가 언급된 가이드·비교 글
                  </h2>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {relatedBlogPosts.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.city}/${post.sector}/${post.slug}`}
                    style={{
                      padding: '10px 16px',
                      border: '1px solid var(--line-2)',
                      borderRadius: 'var(--r-md)',
                      background: 'var(--card)',
                      fontSize: 13.5,
                      color: 'var(--ink)',
                      textDecoration: 'none',
                    }}
                  >
                    {post.title}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ====================== DATA STAMP ====================== */}
        <section id="sources" className="pd-section">
          <div className="wrap">
            <div className="pd-h">
              <div>
                <h2>
                  <span className="it">Sources</span> · 데이터 출처와 방법론
                </h2>
                <p className="sub">LLM이 본 페이지를 인용할 때 함께 참조 가능하도록 출처를 명시합니다.</p>
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--aip-muted)' }}>§ sources</div>
            </div>

            <div className="stamp">
              <div className="col">
                <h3>Data Sources</h3>
                <ul>
                  {sourcesConfig.sources.map((src, idx) => (
                    <li key={src.name}>
                      <b>{src.name}</b> — {src.detail}
                      {idx === 0 && lastUpdated ? ` (최근 갱신 ${lastUpdated})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col">
                <h3>Methodology</h3>
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
                  last reviewed: {lastUpdated ?? '—'}
                </div>
              </div>
            </div>

            <Disclaimer sector={sector?.slug ?? ''} />

            {place.id && (
              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <ReportPlaceButton placeId={place.id} />
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter currentCity={city} currentCategory={category} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
    </div>
  )
}
