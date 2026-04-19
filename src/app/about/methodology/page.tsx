import Link from "next/link"
import type { Metadata } from "next"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { safeJsonLd } from "@/lib/utils"
import { generatePerson, generateArticle, generateFAQPage } from "@/lib/jsonld"
import { generateBreadcrumbList } from "@/lib/seo"
import { composePageTitle } from "@/lib/seo/compose-title"
import {
  getMethodologyFaqs,
  getMethodologySources,
  getMethodologyUpdateCadence,
  getEeatCriteria,
} from "@/lib/methodology"

const BASE_URL = 'https://aiplace.kr'
const URL = `${BASE_URL}/about/methodology`
const TITLE = composePageTitle('조사 방법론 — 데이터 출처·갱신 주기·E-E-A-T')
const DESCRIPTION = 'AI Place가 업체 정보를 수집·검증·갱신하는 방법을 공개합니다. 공식 기관·지도 API·공개 리뷰·AI 인용 테스트 4대 소스.'
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about/methodology' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/about/methodology' },
}

export default function MethodologyPage() {
  const sources = getMethodologySources()
  const cadence = getMethodologyUpdateCadence()
  const eeat = getEeatCriteria()
  const faqs = getMethodologyFaqs()

  const articleJsonLd = generateArticle({
    title: '조사 방법론',
    description: DESCRIPTION,
    lastUpdated: LAST_UPDATED,
    url: URL,
  })
  const personJsonLd = generatePerson()
  const faqJsonLd = generateFAQPage(faqs)
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    { name: 'AI Place 소개', url: `${BASE_URL}/about` },
    { name: '조사 방법론', url: URL },
  ])

  return (
    <>
      <Header />

      <main className="flex-1">
        <section className="py-20 px-6">
          <div className="mx-auto max-w-[800px]">
            <nav className="mb-8 text-sm text-[#6a6a6a]">
              <Link href="/" className="hover:text-[#008f6b]">홈</Link>
              <span className="mx-2">›</span>
              <Link href="/about" className="hover:text-[#008f6b]">AI Place 소개</Link>
              <span className="mx-2">›</span>
              <span className="text-[#222222] font-medium">조사 방법론</span>
            </nav>

            <h1 className="text-[28px] font-bold text-[#222222] leading-[1.43]">
              조사 방법론
            </h1>
            <p className="mt-3 text-base text-[#222222] font-medium">
              공식 기관·지도 API·공개 리뷰·AI 인용 테스트 4대 소스로 업체 정보를 수집하고, 주 1회부터 분기 1회까지 갱신합니다.
            </p>

            {/* T-175: 진단 도구 섹션 */}
            <section className="mt-10 rounded-2xl border border-[#e7e7e7] bg-[#fafafa] p-6">
              <h2 className="text-lg font-bold text-[#222222]">AI 가독성 진단 도구 (/check)</h2>
              <p className="mt-2 text-sm text-[#484848]">
                <Link href="/check" className="text-[#008060] underline">/check</Link> 는 입력된 URL의 사이트맵을 기반으로 고유 경로를 병렬 스캔하여
                16개 항목(GEO 5 · AEO 5 · SEO 6)을 점수화합니다. 총 100점.
              </p>

              <h3 className="mt-5 text-sm font-semibold text-[#222222]">가중치 근거</h3>
              <div className="mt-2 overflow-hidden rounded-lg border border-[#e5e7eb] bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-[#f0f0f0] text-[#484848]">
                    <tr>
                      <th className="p-2 text-left">항목</th>
                      <th className="p-2 text-right">가중치</th>
                      <th className="p-2 text-left">근거</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0] text-[#484848]">
                    <tr><td className="p-2">JSON-LD LocalBusiness</td><td className="p-2 text-right">18</td><td className="p-2">AI 인용 전제조건 (GEO §5.3)</td></tr>
                    <tr><td className="p-2">robots.txt AI 크롤러 허용</td><td className="p-2 text-right">15</td><td className="p-2">차단 시 인용 풀 제외 (§5.1)</td></tr>
                    <tr><td className="p-2">FAQPage schema</td><td className="p-2 text-right">12</td><td className="p-2">인용률 2.7~3.2배 (§4.3)</td></tr>
                    <tr><td className="p-2">Direct Answer Block</td><td className="p-2 text-right">9</td><td className="p-2">AEO 단일 최대 기여 (§4.4)</td></tr>
                    <tr><td className="p-2">sitemap.xml</td><td className="p-2 text-right">7</td><td className="p-2">크롤러 발견 필수</td></tr>
                    <tr><td className="p-2">AggregateRating</td><td className="p-2 text-right">5</td><td className="p-2">AI 수치 신호 (§3.1)</td></tr>
                    <tr><td className="p-2">sameAs 엔티티 링크</td><td className="p-2 text-right">5</td><td className="p-2">Knowledge Graph 연결 (§5.3)</td></tr>
                    <tr><td className="p-2">Last Updated Freshness</td><td className="p-2 text-right">5</td><td className="p-2">ChatGPT 2.3배 가중 (§4.2)</td></tr>
                    <tr><td className="p-2">BreadcrumbList</td><td className="p-2 text-right">4</td><td className="p-2">페이지 계층 인식</td></tr>
                    <tr><td className="p-2">Author/Person (E-E-A-T)</td><td className="p-2 text-right">4</td><td className="p-2">인용률 +40% (§4.1)</td></tr>
                    <tr><td className="p-2">title · description · HTTPS · time · llms · viewport</td><td className="p-2 text-right">16</td><td className="p-2">기초 SEO 패키지</td></tr>
                  </tbody>
                </table>
              </div>

              <h3 className="mt-5 text-sm font-semibold text-[#222222]">재현성</h3>
              <ul className="mt-2 space-y-1 text-xs text-[#484848]">
                <li>• 같은 URL 3회 연속 실행 시 편차 ≤ 1점 (동일 HTML 입력 기준)</li>
                <li>• 5xx·네트워크 에러 1회 자동 재시도로 transient failure 배제</li>
                <li>• User-Agent 고정: AIPlaceDiagnostic/3.1</li>
                <li>• 동시성 8 배치 fetch — 서버 부담 완화</li>
              </ul>

              <h3 className="mt-5 text-sm font-semibold text-[#222222]">근거 문서</h3>
              <p className="mt-2 text-xs text-[#484848]">
                본 진단의 가중치·체크 로직은 내부 문서 <code className="rounded bg-[#eaeaea] px-1 py-0.5">docs/GEO-SEO-AEO-딥리서치.md</code>
                (Princeton GEO 논문 + BrightEdge·SeoClarity·Otterly 외 25+ 출처) 에 근거합니다.
              </p>
            </section>

            <p className="mt-4 text-sm text-[#6a6a6a]">
              마지막 업데이트: <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time> · 작성:{' '}
              <Link href="/about" className="text-[#008060] hover:text-[#006b4f]">이지수 큐레이터</Link>
            </p>

            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                1. 데이터 출처
              </h2>
              <div className="mt-6 space-y-4">
                {sources.map(s => (
                  <div key={s.label} className="p-5 bg-[#f2f2f2] rounded-[16px]">
                    <h3 className="text-base font-semibold text-[#222222]">
                      {s.url ? (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#008060]">
                          {s.label}
                        </a>
                      ) : s.label}
                    </h3>
                    <p className="mt-2 text-sm text-[#6a6a6a] leading-relaxed">{s.purpose}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                2. 갱신 주기
              </h2>
              <div className="mt-6 overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-[#c1c1c1]">
                      <th className="py-3 text-left font-semibold text-[#222222] w-[120px]">주기</th>
                      <th className="py-3 text-left font-semibold text-[#222222]">수행 항목</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadence.map(c => (
                      <tr key={c.period} className="border-b border-[#c1c1c1]/40">
                        <td className="py-3 pr-4 font-medium text-[#222222]">{c.period}</td>
                        <td className="py-3 text-[#6a6a6a]">{c.scope}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                3. E-E-A-T 기준
              </h2>
              <p className="mt-3 text-sm text-[#6a6a6a] leading-relaxed">
                Google이 제시한 4대 축을 운영 원칙으로 번역해 적용합니다.
              </p>
              <div className="mt-6 space-y-3">
                {eeat.map(x => (
                  <div key={x.axis} className="p-5 bg-white rounded-[16px]" style={{ boxShadow: 'var(--shadow-card)' }}>
                    <h3 className="text-base font-semibold text-[#222222]">
                      {x.axis} <span className="text-[#6a6a6a] font-normal">· {x.korean}</span>
                    </h3>
                    <p className="mt-2 text-sm text-[#222222] leading-relaxed">{x.practice}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-16">
              <h2 className="text-[22px] font-semibold text-[#222222] leading-tight tracking-[-0.44px]">
                자주 묻는 질문
              </h2>
              <div className="mt-6 divide-y divide-[#c1c1c1]/50">
                {faqs.map(faq => (
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

            <div className="mt-16 p-5 bg-[#f2f2f2] rounded-[16px] text-xs text-[#6a6a6a] leading-relaxed">
              <strong className="text-[#222222]">면책:</strong> 본 페이지의 수치·순위는 공개 데이터에 기반한 자체 조사 결과이며, 의료·법률·세무 판단의 근거가 될 수 없습니다. 최종 결정 전 관련 전문가의 상담을 받으시기 바랍니다.
            </div>
          </div>
        </section>
      </main>

      <Footer />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
    </>
  )
}
