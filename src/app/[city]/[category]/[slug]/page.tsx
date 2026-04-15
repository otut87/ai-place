import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PhoneButton } from "@/components/phone-button"
import { getPlaceBySlug, getPlaces, getCities, getCategories, getGuidesForPlace, getComparisonsForPlace, getSchemaTypeForCategory } from "@/lib/data.supabase"
import { generateLocalBusiness, generateFAQPage, generateWebPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"
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

  const title = `${place.name} - ${cityObj?.name ?? city} ${catObj?.name ?? category}`
  const description = `${cityObj?.name} ${catObj?.name} ${place.name} — ${place.services.map(s => s.name).join(', ')}. 주소: ${place.address}. ${place.rating ? `평점 ${place.rating}점.` : ''}`

  return {
    title,
    description,
    alternates: {
      canonical: `/${city}/${category}/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `/${city}/${category}/${slug}`,
    },
  }
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

  // Google Places API — 리뷰 가져오기 (빌드 시 호출)
  const googleData = place.googlePlaceId
    ? await getPlaceDetails(place.googlePlaceId)
    : null

  // Google 데이터로 오버라이드 (리뷰 수가 시드 데이터 이상일 때만 — 이상값 방어)
  const googleRatingValid = googleData && googleData.reviewCount >= (place.reviewCount ?? 0)
  const placeWithGoogleData = googleData
    ? {
        ...place,
        ...(googleRatingValid && { rating: googleData.rating, reviewCount: googleData.reviewCount }),
        googleBusinessUrl: googleData.googleMapsUri ?? place.googleBusinessUrl,
      }
    : place

  // GEO: 역방향 링크 (이 업체를 참조하는 가이드/비교 페이지)
  const relatedGuides = await getGuidesForPlace(place.slug)
  const relatedComparisons = await getComparisonsForPlace(place.slug)

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

  // CRITICAL 3: BreadcrumbList JSON-LD
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: baseUrl },
    { name: `${cityObj?.name ?? city} ${catObj?.name ?? category}`, url: `${baseUrl}/${city}/${category}` },
    { name: place.name, url: pageUrl },
  ])

  return (
    <>
      <Header />

      <main className="flex-1">
        <article className="py-20 px-6">
          <div className="mx-auto max-w-[800px]">
            {/* Breadcrumb */}
            <nav className="mb-8 text-sm text-[#6a6a6a]">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              <span className="mx-2">›</span>
              <Link href={`/${city}/${category}`} className="hover:text-[#008f6b]">{cityObj?.name} {catObj?.name}</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">{place.name}</span>
            </nav>

            {/* Hero Image */}
            <div className="aspect-[16/9] rounded-[20px] overflow-hidden bg-[#f2f2f2] mb-8 relative">
              {place.imageUrl ? (
                <Image src={place.imageUrl} alt={place.name} fill className="object-cover" sizes="800px" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#c1c1c1" strokeWidth="1.5">
                    <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0H5m14 0h2m-16 0H3" />
                    <path d="M9 7h1m-1 4h1m4-4h1m-1 4h1" />
                  </svg>
                </div>
              )}
            </div>

            {/* H1 + Rating (Google Places 데이터 우선, 없으면 수동 데이터) */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">{place.name}</h1>
            {(googleData?.rating ?? place.rating) != null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-base font-medium text-[#222222]">★ {googleData?.rating ?? place.rating}</span>
                {(googleData?.reviewCount ?? place.reviewCount) != null && (
                  <span className="text-base text-[#6a6a6a]">· 후기 {googleData?.reviewCount ?? place.reviewCount}건</span>
                )}
                {googleData && <span className="text-xs text-[#6a6a6a]">(Google)</span>}
              </div>
            )}

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
                  <dd className="text-sm text-[#222222]">{place.address}</dd>
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
                    <dd className="text-sm text-[#222222]">{place.openingHours.map(h => {
                      // 영문 약어 → 한글 변환 (Mo-Fr 09:00-18:00 → 월~금 09:00-18:00)
                      return h.replace(/Mo/g, '월').replace(/Tu/g, '화').replace(/We/g, '수')
                        .replace(/Th/g, '목').replace(/Fr/g, '금').replace(/Sa/g, '토').replace(/Su/g, '일')
                        .replace(/-(?=[\uC6D4\uD654\uC218\uBAA9\uAE08\uD1A0\uC77C])/g, '~')
                    }).join(', ')}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Services */}
            {place.services.length > 0 && (
              <section id="services" className="mt-10">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">제공 서비스</h2>
                {/* HIGH 8: Direct Answer Block */}
                <p className="text-sm text-[#222222] mb-4">{place.name}에서는 {place.services.map(s => s.name).join(', ')} 등 {place.services.length}개 서비스를 제공합니다.</p>
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

            {/* Google Reviews */}
            {googleData && googleData.reviews.length > 0 && (
              <section id="reviews" className="mt-12">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">이용 후기</h2>
                <p className="text-sm text-[#222222] mb-4">
                  Google 리뷰 기반 평점 {googleData.rating}점 (후기 {googleData.reviewCount}건)
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
                <p className="mt-3 text-xs text-[#6a6a6a]">출처: Google 리뷰 (요약)</p>
              </section>
            )}

            {/* FAQ */}
            {place.faqs.length > 0 && (
              <section id="faq" className="mt-12">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-1">자주 묻는 질문</h2>
                <p className="text-sm text-[#222222] mb-4">{place.name}에 대해 자주 묻는 질문 {place.faqs.length}개입니다.</p>
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

            {/* GEO: 관련 콘텐츠 역방향 링크 */}
            {(relatedGuides.length > 0 || relatedComparisons.length > 0) && (
              <section className="mt-12 pt-6 border-t border-[#c1c1c1]">
                <h2 className="text-[16px] font-semibold text-[#222222] mb-3">관련 콘텐츠</h2>
                <div className="flex flex-wrap gap-2">
                  {relatedGuides.map(guide => (
                    <Link
                      key={`${guide.city}-${guide.category}`}
                      href={`/guide/${guide.city}/${guide.category}`}
                      className="px-4 py-2 text-sm text-[#222222] bg-[#f2f2f2] border border-[#c1c1c1] rounded-lg hover:bg-[#e8e8e8] transition-colors"
                    >
                      {guide.title}
                    </Link>
                  ))}
                  {relatedComparisons.map(comp => (
                    <Link
                      key={comp.topic.slug}
                      href={`/compare/${comp.topic.city}/${comp.topic.category}/${comp.topic.slug}`}
                      className="px-4 py-2 text-sm text-[#222222] bg-[#f2f2f2] border border-[#c1c1c1] rounded-lg hover:bg-[#e8e8e8] transition-colors"
                    >
                      {comp.topic.name} 비교
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 의료광고법 면책 */}
            <p className="mt-8 text-xs text-[#6a6a6a]">
              ※ 본 페이지는 정보 제공 목적이며, 실제 비용은 상담 후 확정됩니다. 의료 결정은 전문의와 상담하세요.
            </p>
          </div>
        </article>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {googleData && googleData.reviews.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'AggregateRating',
          itemReviewed: { '@type': 'MedicalClinic', name: place.name },
          ratingValue: googleData.rating,
          reviewCount: googleData.reviewCount,
          bestRating: 5,
        }) }} />
      )}
    </>
  )
}
