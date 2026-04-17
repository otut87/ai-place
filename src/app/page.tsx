import Link from "next/link"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { PlaceCard } from "@/components/place-card"
import { StatisticsBox } from "@/components/statistics-box"
import { InquiryButton } from "@/components/inquiry-modal"
import { getCities, getCategories, getPlaces, getAllPlaces } from "@/lib/data.supabase"
import { getRecentBlogPosts } from "@/lib/blog/data.supabase"
import { getSiteStats } from "@/lib/site-stats"
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
  const [cities, categories, allPlaces, blogPosts, stats] = await Promise.all([
    getCities(),
    getCategories(),
    getAllPlaces(),
    getRecentBlogPosts(8),
    getSiteStats(),
  ])

  // 업체가 있는 카테고리/도시만 필터링
  const activeCategorySlugs = new Set(allPlaces.map(p => p.category))
  const activeCitySlugs = new Set(allPlaces.map(p => p.city))
  const activeCategories = categories.filter(c => activeCategorySlugs.has(c.slug))
  const activeCities = cities.filter(c => activeCitySlugs.has(c.slug))

  // GEO: 통계 수치 (§2.2 Princeton — Statistics Addition)
  const avgRating = allPlaces.length > 0
    ? allPlaces.reduce((sum, p) => sum + (p.rating ?? 0), 0) / allPlaces.length
    : 0
  const homeStats: StatisticItem[] = [
    { label: '등록 업체 수', value: `${stats.totalPlaces}곳`, note: `${stats.currentYear}년 기준` },
    { label: '등록 도시', value: `${stats.cities.length}개 도시` },
    { label: '평균 평점', value: `${avgRating.toFixed(1)}점`, note: 'Google Places 기준' },
    { label: '블로그 글', value: `${blogPosts.length}편`, note: '가이드·비교·키워드' },
  ]
  const homeSources: Source[] = [
    { name: 'AI플레이스 자체 조사', year: 2026 },
    { name: '네이버 플레이스', year: 2026 },
  ]

  // GEO: FAQ (§4.3 — 2.7-3.2x 인용률)
  const homeFaqs: FAQ[] = [
    { question: 'AI Place는 무엇인가요?', answer: 'AI Place는 ChatGPT, Claude, Gemini 등 AI 검색 엔진에서 추천되는 로컬 업체를 찾을 수 있는 디렉토리입니다. 구조화된 데이터와 AI 최적화 프로필로 업체의 AI 검색 노출을 돕습니다.' },
    { question: 'AI Place에 어떤 업체가 등록되어 있나요?', answer: `현재 천안 지역 ${allPlaces.length}곳의 업체가 등록되어 있습니다. 각 업체의 전문 분야, 비용, 위치, FAQ를 구조화된 형태로 제공합니다.` },
    { question: 'AI 검색에서 우리 업체가 추천되려면 어떻게 해야 하나요?', answer: 'AI Place에 업체를 등록하면 Schema.org 구조화 데이터, FAQ, 비교 콘텐츠가 자동 생성됩니다. 이를 통해 ChatGPT, Claude 등에서 업체가 인용될 가능성이 높아집니다.' },
    { question: '업체 등록은 어떻게 하나요?', answer: '업체 등록 문의를 통해 기본 정보(업체명, 주소, 전화번호, 서비스)를 전달해 주시면, AI 최적화 프로필을 생성해 드립니다.' },
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
  const itemListJsonLd = generateItemList(allPlaces, 'AI Place 등록 업체')

  return (
    <>
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="pt-24 pb-20 px-6">
          <div className="mx-auto max-w-[1200px] text-center">
            <h1 className="text-[28px] sm:text-[36px] font-bold text-[#222222] leading-tight tracking-tight">
              당신의 업체, AI가 추천하게 만드세요
            </h1>
            {/* Direct Answer Block (§4.4 — 40-60자 자기완결 답변) */}
            <p className="mt-4 text-base text-[#222222] font-medium max-w-lg mx-auto">
              AI Place에 등록된 업체는 ChatGPT, Claude, Gemini에서 검색될 수 있도록 구조화된 프로필을 갖게 됩니다.
              현재 천안 지역 {categories.length}개 업종이 등록되어 있습니다.
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
            <p className="mt-2 text-base text-[#222222]">현재 {activeCities.length}개 도시의 로컬 업체를 등록하고 있습니다.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {activeCities.map(city => (
                <Link
                  key={city.slug}
                  href={`/${city.slug}/${activeCategories[0]?.slug ?? 'dermatology'}`}
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
            <p className="mt-2 text-base text-[#222222]">{activeCategories.length}개 업종의 업체를 AI 검색에 최적화합니다.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              {activeCategories.map(cat => (
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
            <p className="mt-2 text-base text-[#222222]">천안 지역 {allPlaces.length}곳의 AI 최적화 프로필을 확인하세요.</p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {allPlaces.slice(0, 8).map(place => (
                <PlaceCard key={place.slug} place={place} />
              ))}
            </div>
          </div>
        </section>

        {/* 블로그 — 가이드/비교/키워드 통합 */}
        {blogPosts.length > 0 && (
          <section className="py-20 px-6 bg-[#f2f2f2]">
            <div className="mx-auto max-w-[1200px]">
              <div className="flex items-end justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-[28px] font-bold text-[#222222] leading-[1.43]">블로그 — 가이드·비교·추천</h2>
                  <p className="mt-2 text-base text-[#222222]">시술별 비교와 선택 가이드로 정보에 기반한 결정을 도와드립니다.</p>
                </div>
                <Link
                  href="/blog"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-[#008060] rounded-lg hover:bg-[#006b4f] transition-colors"
                >
                  블로그 전체 보기 →
                </Link>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                {blogPosts.map(post => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.city}/${post.sector}/${post.slug}`}
                    className="px-5 py-2.5 text-sm font-medium text-[#222222] bg-white border border-[#c1c1c1] rounded-lg hover:bg-[#f2f2f2] transition-colors"
                  >
                    {post.title}
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
              <InquiryButton className="inline-flex h-12 px-6 items-center rounded-lg bg-[#008060] text-white font-medium hover:bg-[#006b4f] transition-colors">
                업체 등록 문의
              </InquiryButton>
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
