// 홈 — 전달받은 디자인 시스템(aip.css + home.css) 기반.
// 통계는 실측(DB), testimonials·proof-card 는 "예시/샘플" 라벨.
// T-185 Phase 12 홈 리뉴얼 — (preview)/home-v2 에서 승격.

import type { Metadata } from 'next'
import Link from 'next/link'
import { getAllPlaces, getCities, getCategories } from '@/lib/data.supabase'
import { aggregateBotVisits } from '@/lib/admin/bot-visits'
import {
  generateWebSite,
  generateWebPage,
  generateItemList,
  generateFAQPage,
} from '@/lib/jsonld'
import { safeJsonLd } from '@/lib/utils'
import type { FAQ } from '@/lib/types'
import { HomeNav } from './_components/home/home-nav'
import { HeroChatCard } from './_components/home/hero-chat-card'
import { SchemaDemoTabs } from './_components/home/schema-demo-tabs'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/home.css'

// ISR — 1시간 캐시 + place CRUD 액션의 revalidatePath('/') 로 on-demand 갱신.
export const revalidate = 3600

const BASE_URL = 'https://aiplace.kr'

// NOTE: openGraph.images / twitter.images 를 명시하면 file-based opengraph-image.tsx
// 자동 주입이 꺼짐. images 를 생략해 자동 주입 유지.
// T-192: title 앞쪽에 한글 브랜드명 — "ai플레이스" 쿼리와 더 강하게 매칭.
//        description 에도 "AI 플레이스" 자연스럽게 포함.
export const metadata: Metadata = {
  title: 'AI 플레이스 (AI Place) — AI 검색에서 추천받는 로컬 업체',
  description:
    'AI 플레이스(에이아이플레이스)는 ChatGPT · Claude · Gemini 가 내 업체를 답변으로 인용하도록 돕습니다. 구조화 데이터 · FAQ · 비교 콘텐츠를 자동으로 만들어, AI 검색에 최적화된 프로필을 완성합니다.',
  keywords: ['AI 플레이스', 'AI Place', '에이아이플레이스', 'aiplace', 'AI 검색 최적화', 'AEO', 'GEO', '천안 피부과', '로컬 AI SEO'],
  alternates: {
    canonical: '/',
    languages: { 'ko-KR': BASE_URL + '/', 'x-default': BASE_URL + '/' },
  },
  openGraph: {
    type: 'website',
    url: BASE_URL + '/',
    siteName: 'AI 플레이스 (AI Place)',
    locale: 'ko_KR',
    title: 'AI 플레이스 (AI Place) — AI 검색에서 추천받는 로컬 업체',
    description:
      'AI 플레이스는 ChatGPT · Claude · Gemini 가 내 업체를 답변으로 인용하도록. 구조화 데이터 · FAQ 자동 생성.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 플레이스 (AI Place) — AI 검색에서 추천받는 로컬 업체',
    description: 'AI 플레이스(에이아이플레이스) — ChatGPT · Claude · Gemini 에서 추천받는 로컬 업체 디렉토리.',
  },
}

// FAQ — 단일 소스 (본문 렌더 + FAQPage JSON-LD 에 동시 사용).
// T-192: 첫 번째 질문은 "AI 플레이스가 무엇인가요" — 브랜드 정의 문장을
//        FAQPage 구조화 데이터에 포함시켜 Google 이 한글 브랜드 엔터티로 학습하게 함.
const FAQS: FAQ[] = [
  {
    question: 'AI 플레이스(AI Place)가 뭔가요?',
    answer:
      'AI 플레이스(에이아이플레이스, 영문 AI Place)는 ChatGPT·Claude·Gemini 같은 생성형 AI 검색에서 내 업체가 답변으로 추천되도록 돕는 AEO(AI Engine Optimization) 디렉토리 서비스입니다. 업체 정보를 AI 가 읽기 좋은 구조화된 형식으로 자동 변환하고, 업종별 FAQ·비교 콘텐츠를 생성해 AI 인용 가능성을 높입니다.',
  },
  {
    question: '정말 AI가 제 가게를 추천하게 되나요?',
    answer:
      '100% 보장은 어렵지만, 구조화 데이터·FAQ·출처 명시 이 세 가지는 AI가 인용 여부를 결정할 때 가장 큰 변수입니다. 등록 후 월간 AI 인용 리포트로 실제 결과를 확인해 드립니다.',
  },
  {
    question: '네이버 플레이스가 이미 있는데 또 필요할까요?',
    answer:
      '역할이 다릅니다. 네이버 플레이스는 지도 기반 검색, AI Place는 생성형 AI 답변을 위한 구조입니다. 네이버 데이터를 기초로 활용하지만, AI가 읽는 문법은 따로 생성해야 합니다.',
  },
  {
    question: '비용은 어떻게 되나요?',
    answer:
      '초기 세팅 + 월 관리 형태로 운영하며, 업종과 지역 경쟁도에 따라 다릅니다. /pricing 에서 플랜별 가격을 확인하세요.',
  },
  {
    question: '해지하면 페이지는 어떻게 되나요?',
    answer:
      '해지 시 프로필은 비공개 처리되며, AI 모델이 가진 캐시는 수주 이내 자연 만료됩니다. 재등록 시 기존 리포트 데이터는 복원됩니다.',
  },
  {
    question: '천안 외 지역도 되나요?',
    answer: '현재는 천안 중심 파일럿 운영 중이며, 충청권부터 순차 확장 예정입니다.',
  },
  {
    question: '데이터는 어디서 가져오나요?',
    answer:
      '네이버 플레이스, 공개 데이터(심평원 등)와 업체가 직접 제공한 정보를 조합합니다. 모든 수치에 출처와 업데이트 날짜를 표기합니다.',
  },
]

// 실측 집계 — 허수 금지 (환각 방지 원칙).
async function loadStats() {
  const [places, cities, categories, botAgg] = await Promise.all([
    getAllPlaces(),
    getCities(),
    getCategories(),
    aggregateBotVisits(30),
  ])
  const activePlaces = places.filter(p => p.rating != null)
  const avgRating =
    activePlaces.length > 0
      ? activePlaces.reduce((s, p) => s + (p.rating ?? 0), 0) / activePlaces.length
      : 0
  const totalAiVisits = botAgg.reduce((s, r) => s + r.visits, 0)
  const featured = [...places]
    .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
    .slice(0, 3)
  return {
    totalPlaces: places.length,
    totalCities: cities.length,
    totalCategories: categories.length,
    avgRating,
    totalAiVisits,
    featured,
    updatedAt: new Date().toISOString().slice(0, 10),
  }
}

export default async function HomePage() {
  const s = await loadStats()
  const updatedMonth = s.updatedAt.slice(0, 7)

  // --- JSON-LD (4종) ---
  // T-192: alternateName 으로 한글 브랜드 변형 명시 — Google 이 "ai 플레이스",
  //        "에이아이 플레이스" 등 한국어 검색을 이 엔터티와 동일하게 인식.
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${BASE_URL}/#organization`,
    name: 'AI Place',
    alternateName: ['AI 플레이스', '에이아이 플레이스', '에이아이플레이스', 'AIPlace', 'aiplace'],
    url: BASE_URL + '/',
    description: 'AI 플레이스(AI Place) — ChatGPT, Claude, Gemini 등 AI 검색에서 추천되는 로컬 업체 디렉토리.',
    areaServed: { '@type': 'City', name: '천안', alternateName: 'Cheonan' },
    knowsAbout: ['AI Engine Optimization', 'AEO', 'GEO', 'Schema.org', 'LocalBusiness SEO'],
  }

  const websiteJsonLd = generateWebSite(BASE_URL)

  const webPageJsonLd = generateWebPage({
    url: BASE_URL + '/',
    name: 'AI Place — AI 검색에서 추천받는 로컬 업체',
    description:
      'ChatGPT · Claude · Gemini가 내 업체를 답변으로 인용하도록. 구조화 데이터·FAQ·비교 콘텐츠를 자동 생성.',
    lastUpdated: s.updatedAt,
  })

  const itemListJsonLd =
    s.featured.length > 0
      ? generateItemList(s.featured, 'AI Place 추천 업체', { baseUrl: BASE_URL })
      : null

  const faqPageJsonLd = generateFAQPage(FAQS)

  return (
    <div className="aip-root">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(webPageJsonLd) }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(faqPageJsonLd) }}
      />

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />

      <HomeNav />

      <main>
      {/* HERO */}
      <header className="hero">
        <div className="wrap grid">
          <div>
            <span className="eyebrow">
              <span className="pulse" />
              {s.totalCities}개 도시 · {s.totalCategories}개 업종 · {s.totalPlaces}개 업체 등록
              {' '}
              <span className="muted" style={{ marginLeft: 6 }}>
                · 기준 <time dateTime={s.updatedAt}>{s.updatedAt}</time>
              </span>
            </span>
            <h1 className="hero-title">
              손님은 이제<br />
              지도가 아니라<br />
              <span className="it">AI</span>에게 <span className="u">묻습니다.</span>
            </h1>
            <p className="lede">
              ChatGPT · Claude · Gemini가 내 업체를 답변으로 인용하도록. <b>AI 플레이스</b>(AI Place)는{' '}
              <b>구조화 데이터 · FAQ · 비교 콘텐츠</b>를 자동으로 만들어, AI 검색에 최적화된 프로필을 완성합니다.
            </p>
            <div className="cta-row">
              <Link href="/owner/places/new" className="btn primary lg">
                무료로 업체 등록
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="/check" className="btn ghost lg">내 업체 AI 점수 진단</Link>
            </div>
            <div className="kv">
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                업체명만 검색하면 자동 등록
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                소개글·자주 묻는 질문 자동 작성
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                매월 AI 추천 결과 리포트
              </span>
            </div>
          </div>

          <HeroChatCard />
        </div>

        <div className="wrap engine-strip">
          <div className="label">지원 AI — 주요 5개 모두 대응</div>
          <div className="engine-row">
            <div className="lg-pill"><span className="d" style={{ background: '#10a37f' }} /> ChatGPT</div>
            <div className="lg-pill"><span className="d" style={{ background: '#cc785c' }} /> Claude</div>
            <div className="lg-pill">
              <span className="d" style={{ background: 'conic-gradient(from 180deg,#4285f4,#9b72f2,#d96570,#f2a83b,#4285f4)' }} />
              Gemini
            </div>
            <div className="lg-pill"><span className="d" style={{ background: '#20808d' }} /> Perplexity</div>
            <div className="lg-pill"><span className="d" style={{ background: '#0078d4' }} /> Copilot</div>
          </div>
        </div>
      </header>

      {/* EVIDENCE */}
      <section id="proof">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-kicker">증거 · EVIDENCE (예시)</div>
            <h2 className="sec-title">
              최근 30일, <span className="it">AI 검색</span>에서<br />이렇게 인용됩니다.
            </h2>
            <p className="sec-lede">
              아래 카드는 <b>예시 응답</b>입니다. 실제 업체별 인용 결과는 등록 후 월간 리포트로 제공됩니다.
            </p>
          </div>

          <div className="proof-grid">
            <div className="proof-card c-gpt col-4">
              <div className="head">
                <span className="ai-logo gpt">C</span>
                <b>ChatGPT</b>
                <span className="proof-q" style={{ marginLeft: 'auto' }}>
                  <time dateTime="2026-04-09">2026-04-09</time>
                </span>
              </div>
              <div className="proof-q">“천안 인테리어 추천해줘” (예시 질문)</div>
              <div className="proof-a">
                <span className="cite-chip">맘에든인테리어</span> 를 1순위로 제안하며, <b>실내건축면허 보유</b>와 리모델링·시공 이력을 근거로 들었습니다.
              </div>
              <div className="proof-foot">
                <span>위치: 답변 1문단</span>
                <span className="muted">예시</span>
              </div>
            </div>

            <div className="proof-card c-claude col-4">
              <div className="head">
                <span className="ai-logo claude">C</span>
                <b>Claude</b>
                <span className="proof-q" style={{ marginLeft: 'auto' }}>
                  <time dateTime="2026-04-11">2026-04-11</time>
                </span>
              </div>
              <div className="proof-q">“천안 피부과 중 야간진료 가능한 곳?” (예시 질문)</div>
              <div className="proof-a">
                <span className="cite-chip">닥터에버스의원 천안점</span> 이 야간진료 가능 업체로 인용됨. <b>리뷰 평점 5.0</b>이 근거로 제시.
              </div>
              <div className="proof-foot">
                <span>위치: 리스트 2/3</span>
                <span className="muted">예시</span>
              </div>
            </div>

            <div className="proof-card c-gemini col-4">
              <div className="head">
                <span className="ai-logo gemini">G</span>
                <b>Gemini</b>
                <span className="proof-q" style={{ marginLeft: 'auto' }}>
                  <time dateTime="2026-04-12">2026-04-12</time>
                </span>
              </div>
              <div className="proof-q">“천안 동남구 자동차정비 잘하는 곳” (예시 질문)</div>
              <div className="proof-a">
                <span className="cite-chip">브이아이피모터스</span> 가 리뷰 평점과 <b>정비 항목 상세 구조화</b>를 근거로 1순위 제시.
              </div>
              <div className="proof-foot">
                <span>위치: 답변 1문단</span>
                <span className="muted">예시</span>
              </div>
            </div>

            <div className="proof-card c-metric col-6">
              <div className="flex between" style={{ alignItems: 'flex-start' }}>
                <div>
                  <div className="proof-q">최근 30일 AI 봇 방문 (실측)</div>
                  <div className="metric-big">
                    {s.totalAiVisits.toLocaleString()}
                    <sup>건</sup>
                  </div>
                  <div className="metric-sub">
                    기준 <time dateTime={s.updatedAt}>{s.updatedAt}</time> · 전체 등록 업체 합산
                  </div>
                </div>
                <span className="chip">실측 데이터</span>
              </div>
              {s.totalAiVisits === 0 ? (
                <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>
                  수집 시작 단계입니다. 누적되는 대로 주간 추이를 표시합니다.
                </p>
              ) : (
                <svg className="spark" viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0" stopColor="#ff5c2b" stopOpacity=".35" />
                      <stop offset="1" stopColor="#ff5c2b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,50 L30,48 L60,44 L90,42 L120,38 L150,40 L180,30 L210,28 L240,22 L270,20 L300,14 L330,12 L360,8 L400,5 L400,60 L0,60 Z"
                    fill="url(#sg)"
                  />
                  <path
                    d="M0,50 L30,48 L60,44 L90,42 L120,38 L150,40 L180,30 L210,28 L240,22 L270,20 L300,14 L330,12 L360,8 L400,5"
                    fill="none"
                    stroke="#ff5c2b"
                    strokeWidth={2}
                  />
                </svg>
              )}
            </div>

            <div className="proof-card col-6">
              <div className="head"><b>등록하면 이런 게 자동으로 만들어집니다</b></div>
              <ul className="bullet-list" style={{ margin: 0 }}>
                <li><span className="rank">01</span><span className="name">업체 정보 카드 (AI 가 읽는 전용 포맷)</span><span className="tag">자동</span></li>
                <li><span className="rank">02</span><span className="name">업종별 자주 묻는 질문 20~30개</span><span className="tag">자동</span></li>
                <li><span className="rank">03</span><span className="name">위치 경로 (도시·업종·업체)</span><span className="tag">자동</span></li>
                <li><span className="rank">04</span><span className="name">평점·리뷰 수 요약</span><span className="tag">자동</span></li>
                <li><span className="rank">05</span><span className="name">네이버·카카오·구글 링크 연결</span><span className="tag">자동</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" style={{ background: 'var(--bg-2)' }}>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-kicker">원리 · HOW</div>
            <h2 className="sec-title">
              AI가 <span className="it">좋아하는 문법</span>으로<br />내 업체를 다시 씁니다.
            </h2>
            <p className="sec-lede">
              AI 검색은 지도나 이미지가 아니라 <b>구조화된 텍스트</b>를 근거로 답변합니다.<br />
              AI Place는 그 문법을 업체별로 자동 생성합니다.
            </p>
          </div>
          <div className="pillars">
            <div className="pillar">
              <div className="num">01</div>
              <h3>AI가 알아보는 형식으로</h3>
              <p>업체 정보를 AI 가 이해하기 쉬운 전용 형식으로 자동 변환합니다. Google · 네이버 · ChatGPT · Claude · Gemini 가 모두 같은 페이지를 근거로 사용할 수 있게 됩니다.</p>
              <div className="tag-row">
                <span className="chip">업체 정보 카드</span><span className="chip">업종 분류</span><span className="chip">자주 묻는 질문</span><span className="chip">후기 요약</span>
              </div>
            </div>
            <div className="pillar">
              <div className="num">02</div>
              <h3>출처와 날짜가 선명하게</h3>
              <p>평점·리뷰 수·서비스 목록 등 모든 숫자에 <b>어디서 가져왔는지 · 언제 기준인지</b>를 표시합니다. AI 는 근거가 명확한 페이지를 우선 인용합니다.</p>
              <div className="tag-row">
                <span className="chip">출처 표기</span><span className="chip">업데이트 날짜</span><span className="chip">네이버·구글 연동</span>
              </div>
            </div>
            <div className="pillar">
              <div className="num">03</div>
              <h3>비교표와 가이드도 함께</h3>
              <p>업종별 비교표 · 선택 가이드 · 자주 묻는 질문까지 함께 만들어져, AI 가 &ldquo;근거 있는 추천&rdquo;을 구성할 수 있는 재료가 풍부해집니다.</p>
              <div className="tag-row">
                <span className="chip">비교표</span><span className="chip">선택 가이드</span><span className="chip">Q&amp;A 20~30개</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SCHEMA DEMO */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-kicker">산출물 · DELIVERABLE</div>
            <h2 className="sec-title">
              등록 후 이런 페이지가 <span className="it"><br />자동으로</span> 생깁니다.
            </h2>
            <p className="sec-lede">
              업체 정보 한 번만 주시면 — 소개글·질문·답변·비교표까지 AI 가 읽기 좋은 형식으로 전부 정리해 드립니다.
            </p>
          </div>
          <div className="schema-demo">
            <SchemaDemoTabs updatedMonth={updatedMonth} />
            <div className="schema-copy">
              <div className="step">
                <div className="idx">01</div>
                <div>
                  <h4>업체 정보 카드 (기본)</h4>
                  <p>이름·주소·평점·서비스 등 핵심 정보를 AI 가 바로 인용할 수 있는 형태로 정리합니다. 광고 문구가 아닌 &ldquo;사실&rdquo;만.</p>
                </div>
              </div>
              <div className="step">
                <div className="idx">02</div>
                <div>
                  <h4>자주 묻는 질문 20~30개</h4>
                  <p>업종별 자주 묻는 질문을 AI 가 초안 작성 → 사장님 승인 후 게시. AI 가 인용할 &lsquo;답변 문장&rsquo;을 미리 준비해 둡니다.</p>
                </div>
              </div>
              <div className="step">
                <div className="idx">03</div>
                <div>
                  <h4>비교표 · 선택 가이드</h4>
                  <p>시술·서비스별 비교표와 업종 선택 가이드도 함께 발행되어 &ldquo;근거 있는 추천&rdquo;의 재료가 됩니다.</p>
                </div>
              </div>
              <div className="step">
                <div className="idx">04</div>
                <div>
                  <h4>매월 AI 추천 리포트</h4>
                  <p>어떤 질문에 · 어떤 AI 가 · 어떤 문맥으로 내 업체를 인용했는지 매달 이메일로 정리해 드립니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BUSINESS PREVIEW */}
      {s.featured.length > 0 && (
        <section style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head flex between center" style={{ maxWidth: '100%', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div className="sec-kicker">등록 업체 미리보기 · SAMPLES</div>
                <h2 className="sec-title">지금 이런 업체가 등록되어 있습니다.</h2>
              </div>
              <Link href="/directory" className="btn ghost">전체 디렉토리 보기 →</Link>
            </div>
            <div className="biz-grid">
              {s.featured.map(p => (
                <Link
                  key={p.slug}
                  className="biz-card"
                  href={`/${p.city}/${p.category}/${p.slug}`}
                >
                  <div className="cover">
                    <span className="cat">{p.category}</span>
                  </div>
                  <div className="body">
                    <h4>{p.name}</h4>
                    <div className="addr">{p.address}</div>
                    {p.rating != null && (
                      <div className="rate">
                        <span className="stars">
                          {'★'.repeat(Math.round(p.rating))}
                          <span className="dim">{'★'.repeat(5 - Math.round(p.rating))}</span>
                        </span>
                        {' '}{p.rating.toFixed(1)}{' '}
                        <span className="muted">· 리뷰 {p.reviewCount ?? 0}</span>
                      </div>
                    )}
                    <div className="tags">
                      {(p.tags ?? []).slice(0, 4).map(t => (
                        <span key={t} className="chip">{t}</span>
                      ))}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PROCESS */}
      <section id="process">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-kicker">실제 플로우 · PROCESS</div>
            <h2 className="sec-title">
              가입부터 <span className="it">월간 리포트</span>까지,<br />AI 최적화 전 과정.
            </h2>
            <p className="sec-lede">
              사장님 작업은 회원가입 · 업체명 검색 · AI 초안 검수 3가지. 나머지는 전부 자동화되어 있습니다.
            </p>
          </div>
          <div className="timeline">
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 01</span><span className="dur">약 5분</span></div>
              <h3>업체 검색 → 선택</h3>
              <p>이메일로 가입한 뒤 검색창에 업체명을 입력하세요. 네이버·카카오·구글에서 자동으로 찾아 드립니다.</p>
              <ul className="list">
                <li>이메일 인증 (1분)</li>
                <li>업체명 검색 → 내 업체 클릭 → 기본 정보 자동 입력</li>
                <li>대표 사진 · 전화 · 영업시간은 자동으로 불러옴</li>
              </ul>
            </div>
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 02</span><span className="dur">당일 ~ 익일</span></div>
              <h3>AI 가 소개글·질문·답변 작성</h3>
              <p>AI 가 업종에 맞는 소개글과 자주 묻는 질문 20~30개를 초안으로 만들어 드립니다. 사장님은 &ldquo;수정 전·후&rdquo; 화면에서 확인만 하면 돼요.</p>
              <ul className="list">
                <li>업체 정보 카드 · Q&amp;A · 비교표 자동 생성</li>
                <li>의료·법률 과장 표현 자동 점검 (허위·과장 문구 차단)</li>
                <li>승인 즉시 공개 + 검색엔진에 자동 알림</li>
              </ul>
            </div>
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 03</span><span className="dur">매주 · 매월</span></div>
              <h3>대시보드 · 매월 리포트</h3>
              <p>주 1회 ChatGPT·Claude·Gemini 에서 내 업체가 추천되는지 자동 확인하고, 매월 결과를 이메일로 정리해 드립니다.</p>
              <ul className="list">
                <li>주 1회 — 주요 AI 3사 추천 여부 자동 체크</li>
                <li>점수 추이 그래프 + 30일간 AI 방문 통계</li>
                <li>매월 성과 리포트 이메일 자동 발송</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-kicker">플랫폼 현황 · SNAPSHOT</div>
            <h2 className="sec-title">
              <span className="it">숫자로</span> 보는 현재.
            </h2>
            <p className="sec-lede">
              기준 <time dateTime={s.updatedAt}>{s.updatedAt}</time> · 출처: AI Place DB 실측
            </p>
          </div>
          <div className="stats">
            <div className="stat">
              <div className="num">{s.totalPlaces}<span className="unit">곳</span></div>
              <div className="lbl">등록 업체</div>
            </div>
            <div className="stat">
              <div className="num">{s.totalAiVisits}<span className="unit">건</span></div>
              <div className="lbl">30일 AI 방문</div>
            </div>
            <div className="stat">
              <div className="num">
                {s.avgRating > 0 ? s.avgRating.toFixed(1) : '—'}
                <span className="unit">★</span>
              </div>
              <div className="lbl">등록 업체 평균 평점</div>
            </div>
            <div className="stat">
              <div className="num">{s.totalCategories}<span className="unit">업종</span></div>
              <div className="lbl">의료·뷰티·생활·자동차·외식 외</div>
            </div>
          </div>

          <div style={{ height: 40 }} />

          <div className="quotes">
            <blockquote className="quote">
              <span className="mark" aria-hidden="true">&ldquo;</span>
              <p>ChatGPT에서 &lsquo;천안 기미&rsquo; 검색하면 첫 줄에 저희 병원이 나옵니다. 문의 전화가 주 2건에서 <b>주 7건으로</b> 늘었습니다.</p>
              <cite className="who" style={{ fontStyle: 'normal' }}>
                <span className="ava" aria-hidden="true">샘</span>
                <div>
                  <b>피부과 원장 (샘플)</b>
                  <span>가상 인터뷰 · 실제 사례 기반 각색</span>
                </div>
              </cite>
            </blockquote>
            <blockquote className="quote">
              <span className="mark" aria-hidden="true">&ldquo;</span>
              <p>실내건축 면허 보유가 <b>구조화되어 있으니</b> AI가 &lsquo;믿을 만한 업체&rsquo;라고 요약하더군요.</p>
              <cite className="who" style={{ fontStyle: 'normal' }}>
                <span className="ava" aria-hidden="true">샘</span>
                <div>
                  <b>인테리어 대표 (샘플)</b>
                  <span>가상 인터뷰 · 실제 사례 기반 각색</span>
                </div>
              </cite>
            </blockquote>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ background: 'var(--bg-2)' }}>
        <div className="wrap-sm">
          <div className="sec-head">
            <div className="sec-kicker">자주 묻는 질문 · FAQ</div>
            <h2 className="sec-title">
              사장님들이 <span className="it">가장 먼저</span> 물어보시는 것.
            </h2>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <details key={faq.question} className="faq" open={i === 0}>
                <summary>{faq.question}</summary>
                <div className="ans">{faq.answer}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="diag">
        <div className="wrap">
          <div className="cta-card">
            <h2>지금 내 업체, AI는 뭐라고 말할까요?</h2>
            <p>
              업체 이름·주소만 알려주시면 60초 내 <b>무료 AI 진단 리포트</b>를 보내드립니다.<br />
              등록 결정은 진단 보고 천천히 하셔도 됩니다.
            </p>
            <div className="cta-row">
              <Link href="/check" className="btn accent lg">
                무료 AI 진단 신청
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link href="#how" className="btn ghost lg" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.22)' }}>
                어떻게 작동하나요?
              </Link>
            </div>
            <div className="fine">
              <span><b>대응 시간</b> · 평일 10:00 – 18:00</span>
              <span><b>이메일</b> · support@dedo.kr</span>
              <span><b>주소</b> · 충남 천안시 서북구 쌍용11길 33</span>
            </div>
          </div>
        </div>
      </section>

      </main>

      {/* FOOTER */}
      <footer className="site">
        <div className="wrap">
          <div className="cols">
            <div className="brand-col">
              <Link className="logo" href="/">
                <span className="mark" /> AI Place
              </Link>
              <p>
                <b>AI 플레이스</b>(에이아이플레이스) · AI 검색 최적화 디렉토리. 천안 파일럿 운영 중 · {s.totalCategories}개 업종 · {s.totalPlaces}개 업체.
              </p>
            </div>
            <div>
              <h5>서비스</h5>
              <ul>
                <li><Link href="/owner/places/new">업체 등록</Link></li>
                <li><Link href="/pricing">가격·플랜</Link></li>
                <li><Link href="/owner">대시보드</Link></li>
                <li><Link href="/admin/login">로그인</Link></li>
              </ul>
            </div>
            <div>
              <h5>디렉토리</h5>
              <ul>
                <li><Link href="/directory">전체 디렉토리</Link></li>
                <li><Link href="/cheonan/dermatology">천안 피부과</Link></li>
                <li><Link href="/cheonan/interior">천안 인테리어</Link></li>
                <li><Link href="/cheonan/webagency">천안 웹에이전시</Link></li>
              </ul>
            </div>
            <div>
              <h5>콘텐츠</h5>
              <ul>
                <li><Link href="/blog">가이드 전체</Link></li>
                <li><Link href="/about/methodology">조사 방법론</Link></li>
                <li><Link href="/check">AI 진단</Link></li>
              </ul>
            </div>
            <div>
              <h5>회사</h5>
              <ul>
                <li><Link href="/about/methodology">소개</Link></li>
                <li><a href="mailto:support@dedo.kr">support@dedo.kr</a></li>
              </ul>
            </div>
          </div>
          <div className="meta">
            <span>© 2026 AI Place · 기획·제작 디두(dedo)</span>
            <span>사업자등록번호 742-21-00642 · 충남 천안시 서북구 쌍용11길 33</span>
            <span className="ai-mini">
              Optimized for
              <span className="d" style={{ background: '#10a37f' }} />
              <span className="d" style={{ background: '#cc785c' }} />
              <span
                className="d"
                style={{ background: 'conic-gradient(from 180deg,#4285f4,#9b72f2,#d96570,#f2a83b,#4285f4)' }}
              />
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
