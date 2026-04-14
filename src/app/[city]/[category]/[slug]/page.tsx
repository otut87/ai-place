import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { getPlaceBySlug, getPlaces, getCities, getCategories } from "@/lib/data"
import { generateLocalBusiness, generateFAQPage } from "@/lib/jsonld"
import { safeJsonLd } from "@/lib/utils"

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

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category, slug } = await params
  const place = await getPlaceBySlug(city, category, slug)
  if (!place) return {}

  return {
    title: place.name,
    description: place.description,
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

  const localBusinessJsonLd = generateLocalBusiness(place)
  const faqJsonLd = place.faqs.length > 0 ? generateFAQPage(place.faqs) : null

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
              <Link href={`/${city}`} className="hover:text-[#008f6b]">{cityObj?.name}</Link>
              <span className="mx-2">›</span>
              <Link href={`/${city}/${category}`} className="hover:text-[#008f6b]">{catObj?.name}</Link>
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

            {/* Name + Rating */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">{place.name}</h1>
            {place.rating != null && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-base font-medium text-[#222222]">★ {place.rating}</span>
                {place.reviewCount != null && (
                  <span className="text-base text-[#6a6a6a]">· 후기 {place.reviewCount}건</span>
                )}
              </div>
            )}
            <p className="mt-3 text-base text-[#6a6a6a] leading-relaxed">{place.description}</p>

            {/* CTA Buttons */}
            <div className="mt-6 flex gap-3">
              {place.phone && (
                <a
                  href={`tel:${place.phone}`}
                  className="inline-flex h-12 px-6 items-center rounded-lg bg-[#00a67c] text-white font-medium hover:bg-[#008f6b] transition-colors"
                >
                  전화하기
                </a>
              )}
              <Link
                href={`/${city}/${category}`}
                className="inline-flex h-12 px-6 items-center rounded-lg bg-[#222222] text-white font-medium hover:bg-[#333333] transition-colors"
              >
                목록으로
              </Link>
            </div>

            {/* Info Section */}
            <section id="info" className="mt-12 p-6 bg-[#f2f2f2] rounded-[14px]">
              <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-4">기본 정보</h2>
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
                    <dd className="text-sm text-[#222222]">{place.openingHours.join(', ')}</dd>
                  </div>
                )}
              </dl>
            </section>

            {/* Services */}
            {place.services.length > 0 && (
              <section id="services" className="mt-10">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-4">제공 서비스</h2>
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

            {/* FAQ */}
            {place.faqs.length > 0 && (
              <section id="faq" className="mt-12">
                <h2 className="text-[20px] font-semibold text-[#222222] leading-[1.2] tracking-[-0.18px] mb-4">자주 묻는 질문</h2>
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
          </div>
        </article>
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(localBusinessJsonLd) }}
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
