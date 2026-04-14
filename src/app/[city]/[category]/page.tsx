import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PlaceCard } from "@/components/place-card"
import { safeJsonLd } from "@/lib/utils"
import { getPlaces, getCities, getCategories } from "@/lib/data"
import { generateItemList, generateFAQPage } from "@/lib/jsonld"

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

  return {
    title: `${cityObj.name} ${catObj.name} 추천 — 2026년 업데이트`,
    description: `${cityObj.name}시에 위치한 ${catObj.name} 목록. 진료 과목, 위치, 리뷰 기반 정리.`,
  }
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

  const itemListJsonLd = generateItemList(
    places,
    `${cityObj.name} ${catObj.name} 추천 목록`,
  )

  // 전체 FAQ 모아서 FAQPage 스키마 생성
  const allFaqs = places.flatMap(p => p.faqs)
  const faqJsonLd = allFaqs.length > 0 ? generateFAQPage(allFaqs) : null

  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            {/* Breadcrumb */}
            <nav className="mb-8 text-sm text-[#6a6a6a]">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              <span className="mx-2">›</span>
              <Link href={`/${city}`} className="hover:text-[#008f6b]">{cityObj.name}</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">{catObj.name}</span>
            </nav>

            {/* Title */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              {cityObj.name} {catObj.name} 추천 — 2026년 업데이트
            </h1>
            <p className="mt-3 text-base text-[#6a6a6a]">
              {cityObj.name}시에 위치한 {catObj.name} {places.length}곳을 진료 과목, 위치, 이용 후기 기준으로 정리했습니다.
            </p>

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
                <Link
                  href="/admin/register"
                  className="mt-4 inline-flex h-10 px-5 items-center rounded-lg bg-[#00a67c] text-white text-sm font-medium hover:bg-[#008f6b] transition-colors"
                >
                  첫 번째 업체 등록하기
                </Link>
              </div>
            )}

            {/* FAQ Section */}
            {allFaqs.length > 0 && (
              <section className="mt-20">
                <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                  자주 묻는 질문
                </h2>
                <div className="mt-6 divide-y divide-[#c1c1c1]/50">
                  {allFaqs.map((faq) => (
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
          </div>
        </section>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }}
        />
      )}
    </>
  )
}
