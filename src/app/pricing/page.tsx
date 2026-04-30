// /pricing — paper/orange aip 리믹스 (T-240).
// 디자인 핸드오프: claude.ai/design 994GrPOpoCIRJ-Ix-q47OQ, pricing.html

import type { Metadata } from 'next'
import Link from 'next/link'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { composePageTitle } from '@/lib/seo/compose-title'
import { generateBreadcrumbList } from '@/lib/seo'
import { generateFAQPage } from '@/lib/jsonld'
import { safeJsonLd } from '@/lib/utils'
import { MONTHLY_PRICE_KRW, MONTHLY_PRICE_LABEL } from '@/lib/pricing'
import type { FAQ } from '@/lib/types'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/pricing-remix.css'

const BASE_URL = 'https://aiplace.kr'
const TITLE = composePageTitle('요금 안내 — AI Place')
const DESC = `AI Place 파일럿 30일 무료, 이후 ${MONTHLY_PRICE_LABEL} 단일 플랜. 월 블로그 5편 + AI 인용 측정 + AEO 점검 포함. 프리미엄 GEO 컨설팅 별도.`

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/pricing' },
  openGraph: { title: TITLE, description: DESC, url: '/pricing' },
}

const faqs: FAQ[] = [
  {
    question: `${MONTHLY_PRICE_LABEL}에 포함되는 블로그는 몇 편인가요?`,
    answer:
      '월 5편이 자동 발행됩니다. 내 업체 중심으로 업체분석·비교·지역 가이드·키워드 롱테일 형태로 작성되며, 발행 일정은 대시보드에서 확인 가능합니다.',
  },
  {
    question: '파일럿 종료 후 자동 결제되나요?',
    answer: `30일 무료 체험이 끝나기 7일 전에 알림을 보내드립니다. 그 시점까지 해지하지 않으면 등록된 결제수단으로 ${MONTHLY_PRICE_LABEL}이 자동 청구됩니다. 언제든 대시보드에서 즉시 해지 가능합니다.`,
  },
  {
    question: 'AI 인용 측정은 어떻게 확인하나요?',
    answer:
      '오너 대시보드에서 실시간으로 확인합니다. AI 봇 방문 횟수(GPTBot·ClaudeBot·PerplexityBot 등), AEO 8종 점수 변화, 주 1회 실제 AI 인용 테스트(ChatGPT·Claude·Perplexity) 결과가 표시됩니다.',
  },
  {
    question: '해지하면 내 업체 페이지는 어떻게 되나요?',
    answer:
      '해지 후에도 업체 페이지는 읽기 전용으로 유지됩니다. 새 콘텐츠 발행과 인용 측정만 중단되며, 기존 페이지의 검색·AI 인용은 그대로 유효합니다. 재구독 시 즉시 활성화됩니다.',
  },
  {
    question: '프리미엄 컨설팅은 월 구독과 별도인가요?',
    answer:
      '네, 별도의 1회 결제 상품입니다. 자체 사이트를 보유한 병원·다지점·프랜차이즈 사장님이 직접 AEO 개선을 의뢰할 때 이용합니다. 입점 플랜 가입자도 추가 신청 가능합니다.',
  },
]

const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export default function PricingPage() {
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    { name: '요금 안내', url: `${BASE_URL}/pricing` },
  ])
  const faqJsonLd = generateFAQPage(faqs)
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'AI Place 입점 플랜',
    description:
      'AI 검색(ChatGPT·Claude·Gemini)에 내 업체가 노출되도록 구조화하는 입점 서비스. 업체 페이지 발행, AEO 최적화, AI 인용 측정, 단일 요금제.',
    brand: SITE_BRAND.name,
    offers: [
      {
        '@type': 'Offer',
        name: '입점 플랜',
        price: String(MONTHLY_PRICE_KRW),
        priceCurrency: 'KRW',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(MONTHLY_PRICE_KRW),
          priceCurrency: 'KRW',
          billingIncrement: 1,
          unitText: 'MONTH',
        },
        availability: 'https://schema.org/InStock',
      },
      {
        '@type': 'Offer',
        name: '프리미엄 컨설팅',
        price: '1000000',
        priceCurrency: 'KRW',
        availability: 'https://schema.org/InStock',
      },
    ],
  }

  const checkIcon = (
    <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )

  return (
    <div className="aip-root">
      <HomeNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />

      <main>
        {/* HEAD */}
        <header className="pr-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">요금 안내</span>
            </nav>

            <div className="pr-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">Pricing · Open Catalog</span>
              <span>doc-id <b>aip-pricing</b></span>
              <span>·</span>
              <span>updated <b>{LAST_UPDATED}</b></span>
              <span>·</span>
              <span>plans <b>2</b></span>
              <span>·</span>
              <span>VAT <b>포함</b></span>
            </div>

            <h1 className="pr-title">
              요금 <span className="it">안내</span>
            </h1>
            <p className="pr-lede">
              AI 검색(ChatGPT·Claude·Gemini)에 내 업체가 <mark>노출되도록 구조화</mark>합니다.
            </p>
          </div>
        </header>

        {/* PLANS */}
        <section className="plans-section">
          <div className="wrap">
            <div className="plans">

              {/* 입점 플랜 */}
              <div className="plan pop">
                <span className="num-tag">AI Place · <b>입점 플랜</b></span>

                <div className="price">
                  <span className="amt">{MONTHLY_PRICE_LABEL}</span>
                  <span className="meta">(첫 <b>30일 무료</b>)</span>
                </div>

                <p className="lede">
                  업체 1곳 · 월 블로그 5편 자동 발행 · AEO 점검 · AI 인용 측정.{' '}
                  <b>단일 요금제로 단순</b>합니다.
                </p>

                <ul className="feats">
                  <li>{checkIcon}<div>AI Place <b>업체 페이지</b> 자동 생성 <span className="mono-tail">(JSON-LD · AEO 최적화)</span></div></li>
                  <li>{checkIcon}<div>월 <b>5편 블로그 자동 발행</b> — 내 업체 중심 <span className="mono-tail">(업체분석 · 비교 · 가이드 · 키워드 롱테일)</span></div></li>
                  <li>{checkIcon}<div>오너 대시보드 — AI 봇 방문 실측 · 직접/언급 귀속 · <b>AEO 8종 점수</b></div></li>
                  <li>{checkIcon}<div>주 1회 실제 AI 인용 테스트 <span className="mono-tail">(GPT · Claude · Perplexity)</span></div></li>
                  <li>{checkIcon}<div>IndexNow 실시간 제출 · <span className="mono-tail">robots/sitemap/llms.txt 탑재</span></div></li>
                  <li>{checkIcon}<div>언제든 해지 · 해지돼도 업체 페이지는 <b>읽기 전용</b>으로 유지</div></li>
                </ul>

                <div className="plan-cta">
                  <Link className="btn primary" href="/signup">30일 무료로 시작하기 →</Link>
                  <span className="note">토스페이먼츠 자동 청구 · 30일 경과 후 결제 · 만료 7일 전 알림</span>
                </div>
              </div>

              {/* 프리미엄 컨설팅 */}
              <div className="plan">
                <span className="num-tag">전국 대응 · <b>컨설팅 (별도)</b></span>

                <div className="price">
                  <span className="amt">100만원~</span>
                  <span className="meta">1회 결제 · 자체 사이트 AEO 최적화</span>
                </div>

                <p className="lede">
                  병원·다지점·프랜차이즈 대상. 사장님이 자체 사이트를 갖고 있어 <b>직접 AEO 개선</b>을 의뢰하고 싶을 때.
                </p>

                <ul className="feats">
                  <li>{checkIcon}<div>초기 <span className="em">진단 리포트</span></div></li>
                  <li>{checkIcon}<div>우선순위 매트릭스 + <b>수정 코드 제공</b></div></li>
                  <li>{checkIcon}<div>직접 작업 또는 <b>작업 지시서 선택</b></div></li>
                  <li>{checkIcon}<div>작업 완료 후 <b>재진단 실행</b></div></li>
                  <li>{checkIcon}<div>점수 상승 증명서 <span className="mono-tail">(예: 58 → 91)</span></div></li>
                  <li>{checkIcon}<div>최소 <b>20점 상승 보장</b> · 미달 시 차액 환불</div></li>
                </ul>

                <div className="plan-cta">
                  <a className="btn ghost" href={`mailto:${SITE_BRAND.email}?subject=프리미엄 컨설팅 문의`}>
                    문의하기 →
                  </a>
                  <span className="note">월 구독과 독립적 · 범위에 따라 100~300만원</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq-section">
          <div className="wrap">
            <div className="doc-h">
              <div>
                <h2>자주 묻는 <span className="it">질문</span></h2>
              </div>
              <div className="anchor">faq</div>
            </div>
            <div className="faq-list">
              {faqs.map((f, i) => (
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
