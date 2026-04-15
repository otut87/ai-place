import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { ComparisonTable } from "@/components/comparison-table"
import { StatisticsBox } from "@/components/statistics-box"
import { SourceList } from "@/components/source-list"
import { safeJsonLd } from "@/lib/utils"
import { getComparisonPage, getAllComparisonTopics, getCities, getCategories } from "@/lib/data"
import { generateArticle, generateFAQPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"

interface Props {
  params: Promise<{ city: string; category: string; topic: string }>
}

export async function generateStaticParams() {
  const topics = await getAllComparisonTopics()
  return topics.map(t => ({ city: t.city, category: t.category, topic: t.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category, topic } = await params
  const page = await getComparisonPage(city, category, topic)
  if (!page) return {}

  const cities = await getCities()
  const categories = await getCategories()
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)

  const title = `${cityObj?.name ?? city} ${catObj?.name ?? category} ${page.topic.name}`
  return {
    title,
    description: page.summary,
    alternates: { canonical: `/compare/${city}/${category}/${topic}` },
    openGraph: { title, description: page.summary, url: `/compare/${city}/${category}/${topic}` },
  }
}

const SLUG_PATTERN = /^[a-z0-9-]+$/

export default async function ComparisonPageRoute({ params }: Props) {
  const { city, category, topic } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category) || !SLUG_PATTERN.test(topic)) notFound()

  const page = await getComparisonPage(city, category, topic)
  if (!page) notFound()

  const cities = await getCities()
  const categories = await getCategories()
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  if (!cityObj || !catObj) notFound()

  const baseUrl = 'https://aiplace.kr'
  const pageUrl = `${baseUrl}/compare/${city}/${category}/${topic}`

  const articleJsonLd = generateArticle({
    title: `${cityObj.name} ${page.topic.name}`,
    description: page.summary,
    lastUpdated: page.lastUpdated,
    url: pageUrl,
  })

  const faqJsonLd = page.faqs.length > 0 ? generateFAQPage(page.faqs) : null

  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: baseUrl },
    { name: `${cityObj.name} ${catObj.name}`, url: `${baseUrl}/${city}/${category}` },
    { name: page.topic.name, url: pageUrl },
  ])

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
              <Link href={`/${city}/${category}`} className="hover:text-[#008f6b]">{cityObj.name} {catObj.name}</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">{page.topic.name}</span>
            </nav>

            {/* H1 */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              {cityObj.name} {catObj.name} {page.topic.name}
            </h1>

            {/* Direct Answer Block (§4.4 — 40-60자) */}
            <p className="mt-3 text-base text-[#222222] font-medium leading-relaxed">
              {page.summary}
            </p>

            <p className="mt-1 text-xs text-[#6a6a6a]">최종 업데이트: {page.lastUpdated}</p>

            {/* Statistics (§2.2 Princeton GEO lever) */}
            <div className="mt-10">
              <StatisticsBox statistics={page.statistics} sources={page.sources} lastUpdated={page.lastUpdated} />
            </div>

            {/* Comparison Table */}
            <div className="mt-10">
              <h2 className="text-xl font-bold text-[#222222] mb-6">업체별 비교</h2>
              <ComparisonTable entries={page.entries} city={city} category={category} />
            </div>

            {/* FAQ Section (§4.3 — 2.7-3.2x 인용률) */}
            {page.faqs.length > 0 && (
              <section className="mt-16">
                <h2 className="text-xl font-bold text-[#222222] mb-4">자주 묻는 질문</h2>
                <div className="divide-y divide-[#c1c1c1]/50">
                  {page.faqs.map(faq => (
                    <details key={faq.question} className="group py-4">
                      <summary className="flex items-center justify-between cursor-pointer list-none text-base font-medium text-[#222222]">
                        {faq.question}
                        <svg className="w-5 h-5 text-[#6a6a6a] shrink-0 ml-4 group-open:rotate-180 transition-transform" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </summary>
                      <p className="mt-2 text-sm text-[#6a6a6a] leading-relaxed">{faq.answer}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Source Citations (§2.2 Cite Sources) */}
            <SourceList sources={page.sources} />

            {/* Related Links */}
            <div className="mt-10 pt-6 border-t border-[#c1c1c1]">
              <h2 className="text-sm font-semibold text-[#222222] mb-3">관련 콘텐츠</h2>
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/guide/${city}/${category}`}
                  className="px-4 py-2 text-sm text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {cityObj.name} {catObj.name} 선택 가이드
                </Link>
                <Link
                  href={`/${city}/${category}`}
                  className="px-4 py-2 text-sm text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {cityObj.name} {catObj.name} 전체 목록
                </Link>
              </div>
            </div>

            {/* 의료광고법 면책 */}
            <p className="mt-8 text-xs text-[#6a6a6a]">
              ※ 본 페이지는 정보 제공 목적이며, 실제 비용은 상담 후 확정됩니다. 의료 결정은 전문의와 상담하세요.
            </p>
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
    </>
  )
}
