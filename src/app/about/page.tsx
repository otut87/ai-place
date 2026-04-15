import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { InquiryButton } from "@/components/inquiry-modal"
import { safeJsonLd } from "@/lib/utils"
import { generatePerson, generateProfilePage, generateFAQPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"
import type { FAQ } from "@/lib/types"

const BASE_URL = 'https://aiplace.kr'

export const metadata: Metadata = {
  title: 'AI Place 소개 — 이지수 큐레이터',
  description: 'AI Place는 ChatGPT, Claude, Gemini에서 추천되는 로컬 업체 디렉토리입니다. 큐레이터 이지수가 천안 지역 업체의 AI 검색 노출을 돕고 있습니다.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'AI Place 소개 — 이지수 큐레이터',
    description: 'AI Place는 ChatGPT, Claude, Gemini에서 추천되는 로컬 업체 디렉토리입니다. 큐레이터 이지수가 천안 지역 업체의 AI 검색 노출을 돕고 있습니다.',
    url: '/about',
  },
}

const aboutFaqs: FAQ[] = [
  {
    question: 'AI Place는 무료인가요?',
    answer: '기본 업체 등록은 무료입니다. AI 검색 최적화 프리미엄 서비스는 별도 문의가 필요합니다.',
  },
  {
    question: '어떤 AI에서 업체가 추천되나요?',
    answer: 'ChatGPT, Claude, Gemini 등 주요 AI 검색 엔진을 대상으로 합니다. AI가 업체 정보를 정확히 읽을 수 있도록 국제 표준 데이터 포맷으로 프로필을 구축합니다.',
  },
  {
    question: '천안 외 다른 지역도 등록할 수 있나요?',
    answer: '현재 천안 지역을 중심으로 서비스하고 있으며, 아산·세종·대전 등으로 점차 확대할 예정입니다.',
  },
  {
    question: '업체 등록은 어떻게 하나요?',
    answer: '업체 등록 페이지에서 기본 정보(업체명, 주소, 전화번호, 서비스)를 입력하시면, AI가 읽을 수 있는 최적화 프로필을 자동으로 생성해 드립니다.',
  },
]

export default function AboutPage() {
  const personJsonLd = generatePerson()
  const profilePageJsonLd = generateProfilePage()
  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${BASE_URL}/#organization`,
    name: "AI Place",
    url: BASE_URL,
    description: "AI가 추천하는 로컬 업체 디렉토리",
  }
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    { name: 'AI Place 소개', url: `${BASE_URL}/about` },
  ])
  const faqJsonLd = generateFAQPage(aboutFaqs)

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
              <span className="text-[#222222] font-medium">AI Place 소개</span>
            </nav>

            {/* H1 + DAB */}
            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              AI Place 소개
            </h1>
            <p className="mt-3 text-base text-[#222222] font-medium">
              AI Place는 AI 검색 엔진에서 추천되는 로컬 업체를 만드는 디렉토리 서비스입니다.
            </p>

            {/* 저자 프로필 */}
            <div className="mt-12 p-6 bg-[#f2f2f2] rounded-[20px] flex items-start gap-5">
              <div className="w-20 h-20 rounded-full bg-[#008f6b] flex items-center justify-center text-white text-2xl font-bold shrink-0">
                이
              </div>
              <div>
                <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                  이지수
                </h2>
                <p className="text-sm text-[#6a6a6a] mt-1">AI Place 큐레이터 · <a href="https://dedo.kr" target="_blank" rel="noopener noreferrer" className="hover:text-[#008f6b]">디두(dedo)</a> 대표</p>
                <p className="text-sm text-[#222222] mt-3 leading-relaxed">
                  천안 웹디자인 에이전시 <a href="https://dedo.kr" target="_blank" rel="noopener noreferrer" className="text-[#008060] hover:text-[#006b4f]">디두(dedo)</a>의 대표로,
                  AI 시대의 로컬 비즈니스 마케팅을 연구하고 있습니다.
                  ChatGPT, Claude, Gemini 같은 AI에게 &ldquo;천안 피부과 추천해줘&rdquo;라고 물으면
                  당신의 업체가 답변에 나올 수 있도록, 업체 정보를 정리하고 최적화합니다.
                </p>
              </div>
            </div>

            {/* AI Place란? */}
            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                AI Place란?
              </h2>
              <div className="mt-4 space-y-4 text-sm text-[#222222] leading-relaxed">
                <p>
                  요즘 사람들은 검색 엔진 대신 AI에게 직접 물어봅니다.
                  &ldquo;천안에서 피부과 어디가 좋아?&rdquo;, &ldquo;인테리어 업체 추천해줘&rdquo; — 이런 질문에
                  AI가 당신의 업체를 추천하려면, AI가 읽을 수 있는 형태로 업체 정보가 정리되어 있어야 합니다.
                </p>
                <p>
                  AI Place는 업체 정보를 <strong>국제 표준 데이터 포맷(Schema.org)</strong>으로 구조화합니다.
                  쉽게 말해, AI가 이해할 수 있는 언어로 업체의 이름, 위치, 전문 분야, 영업시간, 리뷰를 정리하는 것입니다.
                  마치 전화번호부의 AI 버전이라고 생각하시면 됩니다.
                </p>
                <p>
                  또한 각 업체에 대해 <strong>자주 묻는 질문(FAQ)</strong>, <strong>시술 비교 콘텐츠</strong>,
                  <strong>선택 가이드</strong>를 자동으로 생성합니다. AI는 이런 구조화된 콘텐츠를 특히 잘 읽고 인용합니다.
                </p>
                <p>
                  Google이 중시하는 <strong>전문성·신뢰도 기준(E-E-A-T)</strong>에 맞춰 프로필을 관리하여,
                  AI 검색에서 업체가 신뢰할 수 있는 정보로 인식되도록 합니다.
                </p>
              </div>
            </section>

            {/* 이런 분들을 위해 */}
            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                이런 분들을 위해 만들었습니다
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-[#222222]">
                <li className="flex items-start gap-2">
                  <span className="text-[#008f6b] font-bold mt-0.5">•</span>
                  AI에게 추천받고 싶은 로컬 업체 사장님
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#008f6b] font-bold mt-0.5">•</span>
                  온라인 마케팅에 시간을 쓰기 어려운 소상공인
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#008f6b] font-bold mt-0.5">•</span>
                  블로그, SNS 외의 새로운 노출 채널이 필요한 분
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#008f6b] font-bold mt-0.5">•</span>
                  AI 검색 시대에 미리 준비하고 싶은 분
                </li>
              </ul>
            </section>

            {/* 3단계 프로세스 */}
            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                어떻게 작동하나요?
              </h2>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="text-2xl font-bold text-[#00a67c] mb-3">1</div>
                  <h3 className="text-lg font-semibold text-[#222222] mb-2">업체 등록</h3>
                  <p className="text-sm text-[#6a6a6a]">기본 정보만 입력하세요. 5분이면 충분합니다.</p>
                </div>
                <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="text-2xl font-bold text-[#00a67c] mb-3">2</div>
                  <h3 className="text-lg font-semibold text-[#222222] mb-2">AI 최적화 프로필 생성</h3>
                  <p className="text-sm text-[#6a6a6a]">국제 표준 포맷의 구조화 데이터, FAQ, 비교 콘텐츠를 자동으로 만들어드립니다.</p>
                </div>
                <div className="bg-white rounded-[20px] p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
                  <div className="text-2xl font-bold text-[#00a67c] mb-3">3</div>
                  <h3 className="text-lg font-semibold text-[#222222] mb-2">AI에서 추천 시작</h3>
                  <p className="text-sm text-[#6a6a6a]">ChatGPT, Claude, Gemini가 당신의 업체를 추천합니다.</p>
                </div>
              </div>
            </section>

            {/* CTA */}
            <div className="mt-12 text-center">
              <InquiryButton className="inline-flex h-12 px-6 items-center rounded-lg bg-[#008060] text-white font-medium hover:bg-[#006b4f] transition-colors">
                업체 등록 문의
              </InquiryButton>
            </div>

            {/* FAQ */}
            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                자주 묻는 질문
              </h2>
              <div className="mt-6 divide-y divide-[#c1c1c1]/50">
                {aboutFaqs.map(faq => (
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
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(profilePageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
    </>
  )
}
