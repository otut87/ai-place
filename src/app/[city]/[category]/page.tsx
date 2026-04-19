import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PlaceCard } from "@/components/place-card"
import { StatisticsBox } from "@/components/statistics-box"
import { SourceList } from "@/components/source-list"
import { safeJsonLd } from "@/lib/utils"
import type { StatisticItem, Source } from "@/lib/types"
import { InquiryButton } from "@/components/inquiry-modal"
import { getPlaces, getCities, getCategories, getMetaDescriptorForCategory, getSectorForCategory, getSchemaTypeForCategory } from "@/lib/data.supabase"
import { getBlogPostsBySector } from "@/lib/blog/data.supabase"
import { generateItemList } from "@/lib/jsonld"
import { generateBreadcrumbList, generateCategoryDAB } from "@/lib/seo"
import { buildCategoryMetadata } from "@/lib/seo/page-meta"
import { latestUpdatedAt, toIsoDate } from "@/lib/format/time"
import { formatEvidenceTitle, extractReviewTotal } from "@/lib/seo/title-formula"

interface Props {
  params: Promise<{ city: string; category: string }>
}

export async function generateStaticParams() {
  const cities = await getCities()
  const categories = await getCategories()
  return cities.flatMap(city =>
    categories.map(cat => ({ city: city.slug, category: cat.slug })),
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

export default async function ListingPage({ params }: Props) {
  const { city, category } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category)) notFound()

  const places = await getPlaces(city, category)
  const cities = await getCities()
  const categories = await getCategories()

  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)

  if (!cityObj || !catObj) notFound()

  const descriptor = await getMetaDescriptorForCategory(category)
  const sector = await getSectorForCategory(category)
  const schemaType = await getSchemaTypeForCategory(category)

  const itemListJsonLd = generateItemList(
    places,
    `${cityObj.name} ${catObj.name} 추천 목록`,
  )

  // BreadcrumbList JSON-LD — 3단계: 홈 → 도시+대분류 → 도시+소분류
  const baseUrl = 'https://aiplace.kr'
  const breadcrumbItems = [
    { name: '홈', url: baseUrl },
    ...(sector ? [{ name: `${cityObj.name} ${sector.name}`, url: `${baseUrl}/${city}` }] : []),
    { name: `${cityObj.name} ${catObj.name}`, url: `${baseUrl}/${city}/${category}` },
  ]
  const breadcrumbJsonLd = generateBreadcrumbList(breadcrumbItems)

  // GEO: 통계 + 출처 (Princeton §2.2)
  const avgRating = places.length > 0
    ? places.reduce((sum, p) => sum + (p.rating ?? 0), 0) / places.length
    : 0
  const categoryStats: StatisticItem[] = [
    { label: '등록 업체 수', value: `${places.length}곳`, note: `${new Date().getFullYear()}년 기준` },
    { label: '평균 평점', value: `${avgRating.toFixed(1)}점`, note: 'Google/네이버 기준' },
  ]
  const categorySources: Source[] = [
    { name: 'AI플레이스 자체 조사', year: 2026 },
    { name: '네이버 플레이스', year: 2026 },
    { name: 'Google Places', year: 2026 },
  ]

  // 관련 콘텐츠 (블로그 글, T-010g) — 같은 sector 의 최신 글 최대 5개
  const sectorSlug = sector?.slug
  const relatedBlogPosts = sectorSlug
    ? (await getBlogPostsBySector(city, sectorSlug)).filter(p => p.category === category).slice(0, 5)
    : []

  // T-122: 빌드 시각 대신 실제 업체 lastUpdated 중 가장 최신을 단일 소스로.
  const lastUpdated =
    latestUpdatedAt(places.map(p => p.lastUpdated ?? null)) ??
    toIsoDate(new Date().toISOString()) ??
    ''

  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            {/* Breadcrumb */}
            <nav className="mb-8 text-sm text-[#6a6a6a]">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              {sector && (
                <>
                  <span className="mx-2">›</span>
                  <span>{cityObj.name} {sector.name}</span>
                </>
              )}
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">{cityObj.name} {catObj.name}</span>
            </nav>

            {/* Title */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              {formatEvidenceTitle({
                cityName: cityObj.name,
                categoryName: catObj.name,
                placeCount: places.length,
                reviewTotal: extractReviewTotal(places),
              })}
            </h1>
            <p className="mt-3 text-base text-[#6a6a6a]">
              {generateCategoryDAB(places, cityObj.name, catObj.name, descriptor)}
            </p>
            <time dateTime={lastUpdated} className="mt-1 block text-xs text-[#6a6a6a]">최종 업데이트: {lastUpdated}</time>

            {/* GEO: Statistics + Sources */}
            <div className="mt-6">
              <StatisticsBox statistics={categoryStats} sources={categorySources} lastUpdated={lastUpdated} />
            </div>

            {/* Listing Grid */}
            {places.length > 0 ? (
              <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {places.map(place => (
                  <PlaceCard key={place.slug} place={place} />
                ))}
              </div>
            ) : (
              <div className="mt-10 text-center py-20">
                <svg className="mx-auto mb-4" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#c1c1c1" strokeWidth="1.5">
                  <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16m14 0H5m14 0h2m-16 0H3" />
                </svg>
                <p className="text-lg text-[#6a6a6a]">아직 등록된 업체가 없어요</p>
                <InquiryButton className="mt-4 inline-flex h-10 px-5 items-center rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors">
                  첫 번째 업체 등록하기
                </InquiryButton>
              </div>
            )}

            {/* 관련 콘텐츠 — 블로그 글 (T-010g 마이그레이션) */}
            {relatedBlogPosts.length > 0 && (
              <section className="mt-16">
                <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                  관련 콘텐츠
                </h2>
                <div className="mt-4 flex flex-wrap gap-3">
                  {relatedBlogPosts.map(post => (
                    <Link
                      key={post.slug}
                      href={`/blog/${post.city}/${post.sector}/${post.slug}`}
                      className="px-5 py-2.5 text-sm font-medium text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                    >
                      {post.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* FAQ: 블로그 자동 발행 시스템에서 확장 예정 */}
          </div>
        </section>
      </main>

      <Footer currentCity={city} currentCategory={category} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {places.length === 0 && schemaType !== 'LocalBusiness' && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd({
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          '@id': `${baseUrl}/${city}/${category}`,
          name: `${cityObj.name} ${catObj.name} 추천`,
          about: {
            '@type': schemaType,
            name: catObj.name,
            areaServed: { '@type': 'City', name: cityObj.name },
          },
        })}} />
      )}
    </>
  )
}
