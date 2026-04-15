import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PlaceCard } from "@/components/place-card"
import { StatisticsBox } from "@/components/statistics-box"
import { getCities, getCategories, getPlaces, getAllPlaces, getAllComparisonTopics, getAllGuidePages, getAllKeywordPages } from "@/lib/data"
import { generateFAQPage, generateWebSite, generateItemList } from "@/lib/jsonld"
import { safeJsonLd } from "@/lib/utils"
import type { Metadata } from "next"
import type { FAQ, StatisticItem, Source } from "@/lib/types"

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: 'AI Place — AI가 추천하는 우리 동네 업체',
    description: 'ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요. 피부과, 치과, 미용실, 인테리어 등.',
    url: '/',
  },
}

export default async function HomePage() {
  const cities = await getCities()
  const categories = await getCategories()
  const recentPlaces = await getPlaces("cheonan", "dermatology")
  const allPlaces = await getAllPlaces()
  const comparisonTopics = await getAllComparisonTopics()
  const guidePages = await getAllGuidePages()
  const keywordPages = await getAllKeywordPages()

  // GEO: 통계 수치 (§2.2 Princeton — Statistics Addition)
  const avgRating = allPlaces.reduce((sum, p) => sum + (p.rating ?? 0), 0) / allPlaces.length
  const homeStats: StatisticItem[] = [
    { label: '등록 업체 수', value: `${allPlaces.length}곳`, note: '2026년 4월 기준' },
    { label: '등록 도시', value: `${cities.length}개 도시` },
    { label: '평균 평점', value: `${avgRating.toFixed(1)}점`, note: '네이버 플레이스 기준' },
    { label: '비교·가이드 콘텐츠', value: `${comparisonTopics.length + guidePages.length}편` },
  ]
  const homeSources: Source[] = [
    { name: 'AI플레이스 자체 조사', year: 2026 },
    { name: '네이버 플레이스', year: 2026 },
  ]

  // GEO: FAQ (§4.3 — 2.7-3.2x 인용률)
  const homeFaqs: FAQ[] = [
    { question: 'AI Place는 무엇인가요?', answer: 'AI Place는 ChatGPT, Claude, Gemini 등 AI 검색 엔진에서 추천되는 로컬 업체를 찾을 수 있는 디렉토리입니다. 구조화된 데이터와 AI 최적화 프로필로 업체의 AI 검색 노출을 돕습니다.' },
    { question: 'AI Place에 어떤 업체가 등록되어 있나요?', answer: `현재 천안 지역 피부과 ${allPlaces.length}곳이 등록되어 있습니다. 각 업체의 진료 과목, 비용, 위치, FAQ를 구조화된 형태로 제공합니다.` },
    { question: 'AI 검색에서 우리 업체가 추천되려면 어떻게 해야 하나요?', answer: 'AI Place에 업체를 등록하면 Schema.org 구조화 데이터, FAQ, 비교 콘텐츠가 자동 생성됩니다. 이를 통해 ChatGPT, Claude 등에서 업체가 인용될 가능성이 높아집니다.' },
    { question: '업체 등록 비용은 얼마인가요?', answer: '현재 무료로 등록할 수 있습니다. 기본 정보(업체명, 주소, 전화번호, 서비스)만 입력하면 5분 내에 AI 최적화 프로필이 생성됩니다.' },
    { question: 'AI Place 데이터는 어디서 가져오나요?', answer: 'AI Place는 네이버 플레이스, 건강보험심사평가원 등 공개 데이터와 업체 직접 제공 정보를 기반으로 합니다. 모든 정보에 출처와 업데이트 날짜를 명시합니다.' },
  ]

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://aiplace.kr/#organization",
    name: "AI Place",
    url: "https://aiplace.kr",
    description: "AI가 추천하는 로컬 업체 디렉토리",
  }

  const webSiteJsonLd = generateWebSite("https://aiplace.kr")
  const faqJsonLd = generateFAQPage(homeFaqs)
  const itemListJsonLd = generateItemList(recentPlaces, '천안 피부과 추천 업체')

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="pt-24 pb-20 px-6">
          <div className="mx-auto max-w-[1200px] text-center">
            <h1 className="text-[28px] sm:text-[36px] font-bold text-[#222222] leading-tight tracking-tight">
              AI가 추천하는 우리 동네 업체
            </h1>
            {/* Direct Answer Block (§4.4 — 40-60자 자기완결 답변) */}
            <p className="mt-4 text-base text-[#222222] font-medium max-w-lg mx-auto">
              ChatGPT, Claude, Gemini에서 검색되는 병원, 미용실, 인테리어를 찾아보세요.
              천안 지역 {allPlaces.length}곳의 업체 정보를 AI 최적화 형태로 제공합니다.
            </p>
          </div>
        </section>

        {/* Statistics (§2.2 Princeton GEO lever) */}
        <section className="py-12 px-6">
          <div className="mx-auto max-w-[1200px]">
            <StatisticsBox statistics={homeStats} sources={homeSources} lastUpdated="2026-04-14" />
          </div>
        </section>

        {/* Popular Cities */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">인기 도시</h2>
            <p className="mt-2 text-base text-[#222222]">현재 {cities.length}개 도시의 로컬 업체를 등록하고 있습니다.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {cities.map(city => (
                <Link
                  key={city.slug}
                  href={`/${city.slug}/dermatology`}
                  className="px-5 py-2.5 text-sm font-medium text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {city.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Popular Categories */}
        <section className="py-20 px-6 bg-[#f2f2f2]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">인기 업종</h2>
            <p className="mt-2 text-base text-[#222222]">{categories.length}개 업종의 업체를 AI 검색에 최적화합니다.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {categories.map(cat => (
                <Link
                  key={cat.slug}
                  href={`/cheonan/${cat.slug}`}
                  className="px-5 py-2.5 text-sm font-medium text-[#222222] bg-white border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Recent Places */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">최근 등록 업체</h2>
            <p className="mt-2 text-base text-[#222222]">천안 피부과 {recentPlaces.length}곳의 AI 최적화 프로필을 확인하세요.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {recentPlaces.slice(0, 4).map(place => (
                <PlaceCard key={place.slug} place={place} />
              ))}
            </div>
          </div>
        </section>

        {/* Guides & Comparisons */}
        <section className="py-20 px-6 bg-[#f2f2f2]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">가이드 & 비교</h2>
            <p className="mt-2 text-base text-[#222222]">시술별 비교와 선택 가이드로 정보에 기반한 결정을 도와드립니다.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {guidePages.map(guide => (
                <Link
                  key={`${guide.city}-${guide.category}`}
                  href={`/guide/${guide.city}/${guide.category}`}
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#008060] rounded-lg hover:bg-[#006b4f] transition-colors"
                >
                  {guide.title}
                </Link>
              ))}
              {comparisonTopics.map(topic => (
                <Link
                  key={topic.slug}
                  href={`/compare/${topic.city}/${topic.category}/${topic.slug}`}
                  className="px-5 py-2.5 text-sm font-medium text-[#222222] bg-white border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                >
                  {topic.name}
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Keyword Landing Pages — 자주 찾는 질문 */}
        {keywordPages.length > 0 && (
          <section className="py-20 px-6">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">자주 찾는 질문</h2>
              <p className="mt-2 text-base text-[#222222]">AI에게 자주 묻는 질문별 추천 페이지입니다.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                {keywordPages.map(kw => (
                  <Link
                    key={kw.slug}
                    href={`/${kw.city}/${kw.category}/k/${kw.slug}`}
                    className="px-5 py-2.5 text-sm font-medium text-[#222222] border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                  >
                    {kw.targetQuery}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">AI Place가 뭔가요?</h2>
            <p className="mt-2 text-base text-[#222222]">AI 검색에서 업체가 추천되도록 돕는 디렉토리 서비스입니다.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-8">
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">1</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">업체 등록</h3>
                <p className="text-sm text-[#6a6a6a]">5분이면 끝. 기본 정보만 입력하세요.</p>
              </div>
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">2</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">AI 최적화 프로필 생성</h3>
                <p className="text-sm text-[#6a6a6a]">구조화 데이터, FAQ, 비교 콘텐츠를 자동으로 만들어드립니다.</p>
              </div>
              <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                <div className="text-2xl font-bold text-[#00a67c] mb-3">3</div>
                <h3 className="text-lg font-semibold text-[#222222] mb-2">AI에서 추천 시작</h3>
                <p className="text-sm text-[#6a6a6a]">ChatGPT, Claude, Gemini가 당신의 업체를 추천합니다.</p>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Link
                href="/admin/register"
                className="inline-flex h-12 px-6 items-center rounded-lg bg-[#008060] text-white font-medium hover:bg-[#006b4f] transition-colors"
              >
                무료 등록하기
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section (§4.3 — FAQPage schema for 2.7-3.2x 인용률) */}
        <section className="py-20 px-6 bg-[#f2f2f2]">
          <div className="mx-auto max-w-[1200px]">
            <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">자주 묻는 질문</h2>
            <p className="mt-2 text-base text-[#222222]">AI Place에 대해 자주 묻는 질문과 답변입니다.</p>
            <div className="mt-8 divide-y divide-[#c1c1c1]/50">
              {homeFaqs.map(faq => (
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
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(webSiteJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
    </>
  )
}
