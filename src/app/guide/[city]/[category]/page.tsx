import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { GuideSection } from "@/components/guide-section"
import { StatisticsBox } from "@/components/statistics-box"
import { SourceList } from "@/components/source-list"
import { safeJsonLd } from "@/lib/utils"
import { getGuidePage, getAllGuidePages, getCities, getCategories, getComparisonTopics } from "@/lib/data"
import { generateArticle, generateFAQPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"

interface Props {
  params: Promise<{ city: string; category: string }>
}

export async function generateStaticParams() {
  const guides = await getAllGuidePages()
  return guides.map(g => ({ city: g.city, category: g.category }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, category } = await params
  const guide = await getGuidePage(city, category)
  if (!guide) return {}

  return {
    title: guide.title,
    description: guide.summary,
    alternates: { canonical: `/guide/${city}/${category}` },
    openGraph: { title: guide.title, description: guide.summary, url: `/guide/${city}/${category}` },
  }
}

const SLUG_PATTERN = /^[a-z0-9-]+$/

export default async function GuidePageRoute({ params }: Props) {
  const { city, category } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(category)) notFound()

  const guide = await getGuidePage(city, category)
  if (!guide) notFound()

  const cities = await getCities()
  const categories = await getCategories()
  const cityObj = cities.find(c => c.slug === city)
  const catObj = categories.find(c => c.slug === category)
  if (!cityObj || !catObj) notFound()

  const comparisonTopics = await getComparisonTopics(city, category)

  const baseUrl = 'https://aiplace.kr'
  const pageUrl = `${baseUrl}/guide/${city}/${category}`

  const articleJsonLd = generateArticle({
    title: guide.title,
    description: guide.summary,
    lastUpdated: guide.lastUpdated,
    url: pageUrl,
  })

  const faqJsonLd = guide.faqs.length > 0 ? generateFAQPage(guide.faqs) : null

  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: baseUrl },
    { name: `${cityObj.name} ${catObj.name}`, url: `${baseUrl}/${city}/${category}` },
    { name: '선택 가이드', url: pageUrl },
  ])

  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[800px]">
            {/* Breadcrumb */}
            <nav className="mb-8 text-sm text-[#6a6a6a]">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              <span className="mx-2">›</span>
              <Link href={`/${city}/${category}`} className="hover:text-[#008f6b]">{cityObj.name} {catObj.name}</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">선택 가이드</span>
            </nav>

            {/* H1 */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              {guide.title}
            </h1>

            {/* Direct Answer Block (§4.4) */}
            <p className="mt-3 text-base text-[#222222] font-medium leading-relaxed">
              {guide.summary}
            </p>

            <p className="mt-1 text-xs text-[#6a6a6a]">최종 업데이트: {guide.lastUpdated}</p>

            {/* Table of Contents */}
            <nav className="mt-8 bg-[#f2f2f2] rounded-[14px] p-5">
              <p className="text-sm font-semibold text-[#222222] mb-2">목차</p>
              <ol className="list-decimal list-inside text-sm text-[#6a6a6a] space-y-1">
                {guide.sections.map(section => (
                  <li key={section.heading}>
                    <a href={`#${encodeURIComponent(section.heading)}`} className="hover:text-[#008f6b]">
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            {/* Statistics */}
            <div className="mt-10">
              <StatisticsBox statistics={guide.statistics} sources={guide.sources} lastUpdated={guide.lastUpdated} />
            </div>

            {/* Guide Sections */}
            <div className="mt-10">
              {guide.sections.map(section => (
                <div key={section.heading} id={encodeURIComponent(section.heading)}>
                  <GuideSection section={section} />
                </div>
              ))}
            </div>

            {/* Comparison Links */}
            {comparisonTopics.length > 0 && (
              <div className="mt-10 bg-[#f2f2f2] rounded-[14px] p-6">
                <h2 className="text-lg font-semibold text-[#222222] mb-3">시술별 비교</h2>
                <div className="flex flex-wrap gap-3">
                  {comparisonTopics.map(topic => (
                    <Link
                      key={topic.slug}
                      href={`/compare/${city}/${category}/${topic.slug}`}
                      className="px-4 py-2 text-sm text-[#222222] bg-white border border-[#c1c1c1] rounded-lg hover:bg-white/80 transition-colors"
                    >
                      {topic.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Section */}
            {guide.faqs.length > 0 && (
              <section className="mt-16">
                <h2 className="text-xl font-bold text-[#222222] mb-4">자주 묻는 질문</h2>
                <div className="divide-y divide-[#c1c1c1]/50">
                  {guide.faqs.map(faq => (
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

            {/* Sources */}
            <SourceList sources={guide.sources} />

            {/* Related Links */}
            <div className="mt-10 pt-6 border-t border-[#c1c1c1]">
              <h2 className="text-sm font-semibold text-[#222222] mb-3">관련 페이지</h2>
              <Link
                href={`/${city}/${category}`}
                className="px-4 py-2 text-sm text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
              >
                {cityObj.name} {catObj.name} 전체 목록
              </Link>
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
