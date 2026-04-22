import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PhoneButton } from "@/components/phone-button"
import { Disclaimer } from "@/components/business/disclaimer"
import { PlaceExternalLinks } from "@/components/business/place-external-links"
import { PlaceReviewBadges } from "@/components/business/place-review-badges"
import { PlaceReviewSummary } from "@/components/business/place-review-summary"
import { ReportPlaceButton } from "@/components/business/report-place-button"
import { formatRatingLine } from "@/lib/format/rating"
import { formatHoursKo } from "@/lib/format/hours"
import { normalizeAddress } from "@/lib/format/address"
import { getPlaceBySlug, getPlaces, getCities, getCategories, getSchemaTypeForCategory, getSectorForCategory } from "@/lib/data.supabase"
import { getBlogPostsByPlace } from "@/lib/blog/data.supabase"
import { generateLocalBusiness, generateFAQPage, generateWebPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"
import { buildPlaceMetadata } from "@/lib/seo/page-meta"
import { safeJsonLd } from "@/lib/utils"
import { getPlaceDetails } from "@/lib/google-places"

interface Props {
  params: Promise<{ city: string; category: string; slug: string }>
}

export async function generateStaticParams() {
  const cities = await getCities()
  const categories = await getCategories()
  const params: Array<{ city: string; category: string; slug: string }> = []

  for (const city of cities) {
    for (const cat of categories) {
      const places = await getPlaces(city.slug, cat.slug)
      for (const place of places) {
        params.push({ city: city.slug, category: cat.slug, slug: place.slug })
      }
    }
  }
  return params
}

// HIGH 6-7: title에 도시+카테고리 포함, description 키워드 앞배치 (§9.1)
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

const SLUG_PATTERN = /^[a-z0-9-]+$/

export default async function ProfilePage({ params }: Props) {
  const { city, category, slug } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category) || !SLUG_PATTERN.test(slug)) notFound()

  const place = await getPlaceBySlug(city, category, slug)
  const cities = await getCities()
  const categories = await getCategories()

  if (!place) notFound()

  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)

  const baseUrl = 'https://aiplace.kr'
  const pageUrl = `${baseUrl}/${city}/${category}/${slug}`

  // Google Places API — 원문 리뷰 5건 표시용 (ToS §5.2 준수: 캐시 금지, 매 렌더 재-fetch).
  // Google API 는 ~300ms 로 빠르다. Haiku 요약 등 LLM 호출은 background 워커로 이관 (아래).
  const googleData = place.googlePlaceId
    ? await getPlaceDetails(place.googlePlaceId)
    : null

  // T-187: 방문 기반 lazy enqueue 제거 — 주 1회 일괄 refresh 크론(pipeline-enqueue-weekly)으로 대체.
  // AI 원가 예측성 확보 + SaaS "월간 리포트" 약속 충족.
  const reviewSummaries = place.reviewSummaries ?? []
  const placeWithGoogleData = googleData
    ? {
        ...place,
        rating: googleData.rating,
        reviewCount: googleData.reviewCount,
        googleBusinessUrl: googleData.googleMapsUri ?? place.googleBusinessUrl,
      }
    : place

  // GEO: 역방향 링크 (이 업체를 참조하는 가이드/비교 페이지)
  // 양방향 링크: 이 업체를 related_place_slugs 에 포함한 블로그 글
  const relatedBlogPosts = await getBlogPostsByPlace(place.slug)

  // CRITICAL 5: @id + mainEntityOfPage
  const schemaType = await getSchemaTypeForCategory(category)
  const localBusinessJsonLd = generateLocalBusiness(placeWithGoogleData, pageUrl, schemaType)
  const faqJsonLd = place.faqs.length > 0 ? generateFAQPage(place.faqs) : null

  // E-E-A-T: WebPage 래퍼 (author + publisher)
  const webPageJsonLd = generateWebPage({
    url: pageUrl,
    name: `${place.name} - ${cityObj?.name} ${catObj?.name}`,
    description: place.description,
    lastUpdated: place.lastUpdated,
  })

  // BreadcrumbList JSON-LD — 4단계: 홈→대분류→소분류→업체
  const sector = await getSectorForCategory(category)
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: baseUrl },
    ...(sector ? [{ name: `${cityObj?.name ?? city} ${sector.name}`, url: `${baseUrl}/${city}` }] : []),
    { name: `${cityObj?.name ?? city} ${catObj?.name ?? category}`, url: `${baseUrl}/${city}/${category}` },
    { name: place.name, url: pageUrl },
  ])

  return (
    <>
      <Header />

      <main className="flex-1">
        <article className="py-20 px-6">
          <div className="mx-auto max-w-[800px]">
            {/* T-105: Breadcrumb 5단계 (홈 › 도시+섹터 › 도시+카테고리 › 업체) — 카테고리 페이지와 계층 일관성 */}
            <nav className="mb-8 text-sm text-[#6a6a6a]" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              {sector && (
                <>
                  <span className="mx-2">›</span>
                  <Link href={`/${city}`} className="hover:text-[#008f6b]">{cityObj?.name} {sector.name}</Link>
                </>
              )}
              <span className="mx-2">›</span>
              <Link href={`/${city}/${category}`} className="hover:text-[#008f6b]">{cityObj?.name} {catObj?.name}</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">{place.name}</span>
            </nav>

            {/* T-098: Hero Image 또는 축약 정보 배너 (사진 없을 때 600px 빈 박스 제거) */}
            {place.imageUrl ? (
              <div className="aspect-[16/9] rounded-[20px] overflow-hidden bg-[#f2f2f2] mb-8 relative">
                <Image src={place.imageUrl} alt={place.name} fill priority className="object-cover" sizes="(max-width: 820px) 100vw, 820px" />
              </div>
            ) : (
              <div
                aria-hidden="true"
                className="h-24 rounded-[16px] bg-[#ececec] flex items-center justify-center text-[#8a8a8a] text-sm mb-8"
              >
                사진 준비 중
              </div>
            )}

            {/* H1 + Rating (Google Places 데이터 우선, 없으면 수동 데이터) */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              {place.name} — {cityObj?.name ?? city} {catObj?.name ?? category}
            </h1>
            {(googleData?.rating ?? place.rating) != null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-base font-medium text-[#222222]">
                  {formatRatingLine(
                    googleData?.rating ?? place.rating ?? 0,
                    googleData?.reviewCount ?? place.reviewCount ?? 0,
                    googleData ? 'google' : 'mixed',
                  )}
                </span>
              </div>
            )}

            {/* Phase 11: 소스별 리뷰 배지 (Google/Naver/Kakao) — 있으면 노출 */}
            <PlaceReviewBadges
              className="mt-2"
              size="md"
              place={{
                googleRating: googleData?.rating ?? place.googleRating,
                googleReviewCount: googleData?.reviewCount ?? place.googleReviewCount,
                naverReviewCount: place.naverReviewCount,
                kakaoRating: place.kakaoRating,
                kakaoReviewCount: place.kakaoReviewCount,
              }}
            />

            {/* GEO: Direct Answer Block — 추천형 문장 우선, 없으면 기존 description */}
            <p className="mt-3 text-base text-[#222222] font-medium leading-relaxed">
              {place.recommendationNote ?? place.description}
            </p>

            {/* CRITICAL 4: Last Updated (§4.2 Freshness) */}
            {place.lastUpdated && (
              <time dateTime={place.lastUpdated} className="mt-1 block text-xs text-[#6a6a6a]">최종 업데이트: {place.lastUpdated}</time>
            )}

            {/* CTA Buttons */}
            <div className="mt-6 flex gap-3">
              {place.phone && (
                <PhoneButton phone={place.phone} businessName={place.name} />
              )}
              <Link
                href={`/${city}/${category}`}
                className="inline-flex h-12 px-6 items-center rounded-lg bg-[#222222] text-white font-medium hover:bg-[#333333] transition-colors"
              >
                목록으로
              </Link>
            </div>

            {/* GEO: 추천 대상 + 핵심 강점 (GPT 리뷰 반영) */}
            {(place.recommendedFor?.length || place.strengths?.length) && (
              <section className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {place.recommendedFor && place.recommendedFor.length > 0 && (
                  <div className="p-5 bg-[#f2f2f2] rounded-[14px]">
                    <h2 className="text-[16px] font-semibold text-[#222222] mb-3">추천 대상</h2>
                    <ul className="space-y-2">
                      {place.recommendedFor.map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm text-[#222222]">
                          <span className="text-[#008f6b] mt-0.5 shrink-0">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {place.strengths && place.strengths.length > 0 && (
                  <div className="p-5 bg-[#f2f2f2] rounded-[14px]">
                    <h2 className="text-[16px] font-semibold text-[#222222] mb-3">핵심 강점</h2>
                    <ul className="space-y-2">
                      {place.strengths.map(item => (
                        <li key={item} className="flex items-start gap-2 text-sm text-[#222222]">
                          <span className="text-[#008f6b] mt-0.5 shrink-0">★</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {/* 업체 유형 배지 */}
            {place.placeType && (
              <div className="mt-4">
                <span className="inline-flex px-3 py-1 text-xs font-medium text-[#008f6b] bg-[#e6f7f2] border border-[#008f6b]/20 rounded-full">
                  {place.placeType}
                </span>
              </div>
            )}

            {/* Info Section */}
            <section id="info" className="mt-12 p-6 bg-[#f2f2f2] rounded-[14px]">
              <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">기본 정보</h2>
              {/* HIGH 8: Direct Answer Block under H2 */}
              <p className="text-sm text-[#222222] mb-4">{place.description}</p>
              <dl className="space-y-3">
                <div className="flex gap-3">
                  <dt className="text-sm font-medium text-[#6a6a6a] w-20 shrink-0">주소</dt>
                  <dd className="text-sm text-[#222222]">{normalizeAddress(place.address)}</dd>
                </div>
                {place.phone && (
                  <div className="flex gap-3">
                    <dt className="text-sm font-medium text-[#6a6a6a] w-20 shrink-0">전화</dt>
                    <dd className="text-sm text-[#222222]">{place.phone}</dd>
                  </div>
                )}
                {place.openingHours && (
                  <div className="flex gap-3">
                    <dt className="text-sm font-medium text-[#6a6a6a] w-20 shrink-0">영업시간</dt>
                    <dd className="text-sm text-[#222222]">{formatHoursKo(place.openingHours)}</dd>
                  </div>
                )}
              </dl>

              {/* Phase 11: 외부 플랫폼 링크 6종 — 있는 것만 */}
              <PlaceExternalLinks place={place} className="mt-4" />
            </section>

            {/* Services */}
            {place.services.length > 0 && (
              <section id="services" className="mt-10">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">제공 서비스</h2>
                {/* HIGH 8: Direct Answer Block — 표시폭 40~120 보장 (AEO Direct Answer) */}
                <p className="text-sm text-[#222222] mb-4">{place.name}이(가) 제공하는 {place.services.length}개 서비스 목록입니다. 시술별 가격과 소요 시간은 상담 시 확인해 주세요.</p>
                <div className="space-y-3">
                  {place.services.map((svc) => (
                    <div key={svc.name} className="flex items-center justify-between py-3 border-b border-[#c1c1c1]/50 last:border-0">
                      <div>
                        <div className="text-sm font-medium text-[#222222]">{svc.name}</div>
                        {svc.description && (
                          <div className="text-sm text-[#6a6a6a] mt-1">{svc.description}</div>
                        )}
                      </div>
                      {svc.priceRange && (
                        <div className="text-sm font-medium text-[#222222] shrink-0 ml-4">{svc.priceRange}</div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tags */}
            {place.tags.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {place.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs font-medium text-[#222222] border border-[#c1c1c1] rounded-[14px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Phase 11: 플랫폼별 AI 리뷰 요약 — 긍정/부정 테마 + 패러프레이즈 인용 1건/소스 */}
            <PlaceReviewSummary
              summaries={reviewSummaries}
              businessName={place.name}
            />

            {/* Google 리뷰 원문 최대 5건 — Places API ToS §5 준수 (30일 캐시 금지, 빌드 시 매번 재-fetch) */}
            {googleData && googleData.reviews.length > 0 && (
              <section id="google-reviews" className="mt-12">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">
                  Google 리뷰 원문
                </h2>
                <p className="text-sm text-[#222222] mb-4">
                  Google 평점 {googleData.rating}점 · 총 후기 {googleData.reviewCount.toLocaleString('ko-KR')}건을 기반으로 최근 대표 리뷰 5건을 원문 그대로 인용했습니다.
                </p>
                <div className="space-y-4">
                  {googleData.reviews.slice(0, 5).map((review, i) => (
                    <div key={i} className="p-4 bg-[#f2f2f2] rounded-[14px]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-[#222222]">
                          {'★'.repeat(Math.round(review.rating))}{'☆'.repeat(5 - Math.round(review.rating))}
                        </span>
                        <span className="text-xs text-[#6a6a6a]">{review.relativeTime}</span>
                      </div>
                      <p className="text-sm text-[#222222] leading-relaxed line-clamp-3">{review.text}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-[#6a6a6a]">출처: Google Places · 원문은 Google 지도에서 확인 가능합니다.</p>
              </section>
            )}

            {/* FAQ */}
            {place.faqs.length > 0 && (
              <section id="faq" className="mt-12">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">자주 묻는 질문</h2>
                <p className="text-sm text-[#222222] mb-4">{place.name}에 대해 자주 묻는 질문 {place.faqs.length}개를 정리했습니다. 예약·영업시간·서비스 관련 답변입니다.</p>
                <div className="divide-y divide-[#c1c1c1]/50">
                  {place.faqs.map((faq) => (
                    <details key={faq.question} className="group py-4">
                      <summary className="flex items-center justify-between cursor-pointer list-none text-base font-medium text-[#222222]">
                        {faq.question}
                        <svg
                          className="w-5 h-5 text-[#6a6a6a] shrink-0 ml-4 group-open:rotate-180 transition-transform"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </summary>
                      <p className="mt-2 text-sm text-[#6a6a6a] leading-relaxed">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* GEO: 양방향 링크 — 이 업체가 언급된 블로그 글 (T-010g) */}
            {relatedBlogPosts.length > 0 && (
              <section className="mt-12 pt-6 border-t border-[#c1c1c1]">
                <h2 className="text-[16px] font-semibold text-[#222222] mb-3">관련 콘텐츠</h2>
                <div className="flex flex-wrap gap-2">
                  {relatedBlogPosts.map(post => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.city}/${post.sector}/${post.slug}`}
                      className="px-4 py-2 text-sm text-[#222222] bg-[#f2f2f2] border border-[#c1c1c1] rounded-lg hover:bg-[#e8e8e8] transition-colors"
                    >
                      {post.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 업종별 면책 분기 (T-004) */}
            <Disclaimer sector={sector?.slug ?? ''} />

            {/* 신고 — 잘못된 정보, 폐업, 스팸 등 (DB UUID 없는 seed 폴백은 노출 안 함) */}
            {place.id && (
              <div className="mt-6 text-right">
                <ReportPlaceButton placeId={place.id} />
              </div>
            )}
          </div>
        </article>
      </main>

      <Footer currentCity={city} currentCategory={category} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {/* T-008: 단독 AggregateRating JSON-LD 제거.
           LocalBusiness 내부 aggregateRating(localBusinessJsonLd) 으로 충분하며,
           단독 출력은 비표준이고 Rich Results Test 경고 유발. */}
    </>
  )
}
