// /about — paper/orange aip 리믹스 (T-241).
// 디자인 핸드오프: claude.ai/design 5iiO6wqqEv1y_j9wmup70Q, about.html

import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { safeJsonLd } from '@/lib/utils'
import { generatePerson, generateProfilePage, generateFAQPage } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import type { FAQ } from '@/lib/types'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/about-remix.css'
import '@/styles/pricing-remix.css'

const BASE_URL = 'https://aiplace.kr'
const TITLE = composePageTitle('AI Place 소개 — AI 검색 시대의 로컬 디렉토리')
const DESCRIPTION =
  'AI Place는 AI 검색 시대에 추천되는 로컬 업체를 만드는 디렉토리 서비스입니다. ChatGPT·Claude·Gemini 등 AI가 인용하는 구조화된 페이지를 자동 발행합니다.'
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/about' },
}

const aboutFaqs: FAQ[] = [
  {
    question: 'AI Place는 무료인가요?',
    answer:
      '첫 30일은 무료로 사용 가능합니다. 그 이후에는 월 14,900원의 입점 플랜이 자동 청구됩니다. 자세한 내용은 요금 안내 페이지를 참고하세요.',
  },
  {
    question: '천안 외에 다른 지역도 가능한가요?',
    answer:
      '현재는 천안·아산을 중심으로 운영 중이며, 단계적으로 충청권 → 수도권 → 전국으로 확장할 계획입니다. 다른 지역의 사장님도 지금 등록 가능하지만 가이드 콘텐츠 발행은 도시별 일정에 따라 진행됩니다.',
  },
  {
    question: '현장에서 직접 시연을 볼 수 있나요?',
    answer:
      '천안 지역 한정으로 디두 사무실에서 1:1 시연이 가능합니다. 사전 예약 후 방문해주세요. support@aiplace.kr 로 문의하시면 일정을 안내해드립니다.',
  },
  {
    question: '업체 등록은 어떻게 해요?',
    answer:
      '상단의 "업체 등록" 버튼을 누르거나 /signup 페이지에서 신청 양식을 작성하시면 영업일 기준 1일 이내 회신드립니다.',
  },
]

export default function AboutPage() {
  const personJsonLd = generatePerson()
  const profilePageJsonLd = generateProfilePage()
  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'AI Place',
    url: BASE_URL,
    description: 'AI가 추천하는 로컬 업체 디렉토리',
  }
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    { name: 'AI Place 소개', url: `${BASE_URL}/about` },
  ])
  const faqJsonLd = generateFAQPage(aboutFaqs)

  return (
    <div className="aip-root">
      <HomeNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(profilePageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      <main>
        {/* HEAD */}
        <header className="ab-head">
          <div className="wrap-sm">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">AI Place 소개</span>
            </nav>

            <div className="ab-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">About</span>
              <span>doc-id <b>aip-about</b></span>
              <span>·</span>
              <span>updated <b>{LAST_UPDATED}</b></span>
              <span>·</span>
              <span>founded <b>2026</b></span>
            </div>

            <h1 className="ab-title">AI Place <span className="it">소개</span></h1>
            <p className="ab-lede">
              AI 검색 시대에 <mark>추천되는 로컬 업체</mark>를 만드는 디렉토리 서비스입니다.
            </p>

            {/* author intro — name 은 byline 이라 heading 이 아닌 styled <p> 로 (heading 점프 회피). */}
            <div className="ab-author-card">
              <div className="ava">이</div>
              <div>
                <p className="author-name">이지수</p>
                <div className="role">
                  AI Place(에이아이 플레이스) 큐레이터 ·{' '}
                  <a href="https://dedo.kr" target="_blank" rel="noopener noreferrer">
                    디두(dedo)
                  </a>{' '}
                  대표
                </div>
                <p>
                  전남 광주에서 태어나 <b>IT업계</b>에 적을 두고, AI 시대의 로컬 사업자가 겪는 어려움을 풀고자 합니다.
                  <b> ChatGPT · Claude · Gemini</b>가 보편이 된 지금, 작고 좋은 가게가 거대 플랫폼에 밀려나지 않고{' '}
                  AI에게 정확하게 인용되는 사회를 만들기 위해 디두(dedo)를 시작했습니다.
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* AI Place란? */}
        <section className="ab-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div><h2>AI Place란?</h2></div>
              <div className="anchor">about</div>
            </div>
            <div className="ab-prose">
              <p>
                많은 사람들이 검색 대신 매일 수십~수백 개의 질문을 AI에게 던지는 시대입니다.{' '}
                <b>&ldquo;천안에서 저녁 먹기 좋은 곳&rdquo;</b>, <b>&ldquo;천안에서 잘하는 피부과&rdquo;</b> — 이런 일상의 추천이
                이제는 사람의 입이 아니라 <mark>AI 답변</mark>을 통해 결정되고 있습니다.
              </p>
              <p>
                AI Place는 입점 업체와 <b>새로운 발견의 사이클</b>을 함께 만듭니다.
                지역에 정착한 가게가 <b>AI가 인용하기 좋은 형태</b>로 정리되고, 매월 새로운 콘텐츠로 갱신되며,
                실제로 ChatGPT · Claude · Gemini의 답변에 등장하는지 매주 측정합니다.
              </p>
              <p>
                오로지 인덱싱과 추천을 위한 <b>구조화된 데이터</b>(Schema.org · JSON-LD · llms.txt)로 페이지를 발행하며,
                AI가 읽을 수 있는{' '}
                <Link className="link" href="/about/methodology">
                  조사 방법론
                </Link>
                을 따릅니다.
              </p>
              <p>
                Google이 절대적이던 시대에 검색 점유율을 단기간에 추월하지는 못하더라도,{' '}
                <mark>AI 응답에 인용되는 신뢰</mark>는 작은 가게도 가질 수 있다고 믿습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 이런 분들을 위해 */}
        <section
          className="ab-section"
          style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}
        >
          <div className="wrap-sm">
            <div className="doc-h">
              <div><h2>이런 분들을 위해 <span className="it">만들었습니다</span></h2></div>
              <div className="anchor">audience</div>
            </div>
            <ul className="ab-target-list">
              <li><span className="num">01</span><span><b>지역에 정착한 작고 단단한 사장님</b></span></li>
              <li><span className="num">02</span><span>이미 검색 광고비가 다 빠져나가는 <b>작은 가게의 사장님</b></span></li>
              <li><span className="num">03</span><span>리뷰는 좋지만 <b>저녁 시간대 손님이 줄어드는 가게의 사장님</b></span></li>
              <li><span className="num">04</span><span>AI 시대 사업의 신호 변화에 <b>대비하고 싶은 분</b></span></li>
            </ul>
          </div>
        </section>

        {/* 어떻게 작동? */}
        <section className="ab-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div><h2>어떻게 <span className="it">작동하나요?</span></h2></div>
              <div className="anchor">how</div>
            </div>
            <div className="ab-steps">
              <div className="ab-step">
                <span className="n">1</span>
                <h3>입점 등록</h3>
                <p>주소·전화·운영시간 기본 정보만 입력해주세요. 나머지는 저희가 정리합니다.</p>
                <span className="tail">소요 5–10분 · 무료 진단 포함</span>
              </div>
              <div className="ab-step">
                <span className="n">2</span>
                <h3>AI 친화적 프로필 생성</h3>
                <p>JSON-LD · FAQ · 비교 콘텐츠가 자동으로 생성되어 <b>AI가 읽기 좋게 구조화</b>됩니다.</p>
                <span className="tail">AEO 8종 점수 보고서 발행</span>
              </div>
              <div className="ab-step">
                <span className="n">3</span>
                <h3>AI에 추천 시작</h3>
                <p>ChatGPT · Claude · Gemini가 추천하는 답변에 등장하기 시작합니다.</p>
                <span className="tail">월간 PDF 리포트로 인용 측정</span>
              </div>
            </div>

            <div className="ab-cta">
              <Link className="btn primary lg" href="/signup">업체 등록 요청 →</Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div><h2>자주 묻는 <span className="it">질문</span></h2></div>
              <div className="anchor">faq</div>
            </div>
            <div className="faq-list">
              {aboutFaqs.map((f, i) => (
                <details key={f.question} open={i === 0}>
                  <summary>
                    <span>
                      <span className="q-num">Q{String(i + 1).padStart(2, '0')}</span>
                      {f.question}
                    </span>
                  </summary>
                  <div className="ans">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
