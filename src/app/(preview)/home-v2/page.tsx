// Preview 홈 — 전달받은 디자인 시스템(aip.css + home-v2.css) 기반 재설계.
// 통계는 실측(DB), testimonials·proof-card 는 "예시/샘플" 라벨.
// noindex (preview layout 에서 지정). 품질 검수 후 / 로 승격 예정.

import Link from 'next/link'
import { getAllPlaces, getCities, getCategories } from '@/lib/data.supabase'
import { aggregateBotVisits } from '@/lib/admin/bot-visits'
import { PreviewNav } from './_components/preview-nav'
import { HeroChatCard } from './_components/hero-chat-card'
import './home-v2.css'

export const dynamic = 'force-dynamic'

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

export default async function HomeV2Page() {
  const s = await loadStats()
  const updatedMonth = s.updatedAt.slice(0, 7) // 2026-04

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'AI Place',
    url: 'https://aiplace.kr/',
    description: 'ChatGPT, Claude, Gemini 등 AI 검색에서 추천되는 로컬 업체 디렉토리.',
    areaServed: { '@type': 'City', name: '천안', alternateName: 'Cheonan' },
    knowsAbout: ['AI Engine Optimization', 'AEO', 'Schema.org', 'LocalBusiness SEO'],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />

      <PreviewNav />

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
              ChatGPT · Claude · Gemini가 내 업체를 답변으로 인용하도록. AI Place는{' '}
              <b>구조화 데이터 · FAQ · 비교 콘텐츠</b>를 자동으로 만들어, AI 검색에 최적화된 프로필을 완성합니다.
            </p>
            <div className="cta-row">
              <Link href="/owner/places/new" className="btn primary lg">
                5분 만에 업체 등록
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
                Schema.org 자동 생성
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                FAQ 자동 생성
              </span>
              <span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                월간 AI 인용 리포트
              </span>
            </div>
          </div>

          <HeroChatCard />
        </div>

        <div className="wrap engine-strip">
          <div className="label">OPTIMIZED FOR · AI 검색 엔진</div>
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
              <div className="head"><b>구조화 제공 항목 (업체 단위)</b></div>
              <ul className="bullet-list" style={{ margin: 0 }}>
                <li><span className="rank">01</span><span className="name">JSON-LD LocalBusiness (서브타입 분기)</span><span className="tag">자동</span></li>
                <li><span className="rank">02</span><span className="name">FAQPage + 업종별 질문 세트</span><span className="tag">자동</span></li>
                <li><span className="rank">03</span><span className="name">BreadcrumbList 5단계</span><span className="tag">자동</span></li>
                <li><span className="rank">04</span><span className="name">Review / AggregateRating</span><span className="tag">자동</span></li>
                <li><span className="rank">05</span><span className="name">sameAs · 네이버·카카오·구글 URL</span><span className="tag">자동</span></li>
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
              <h3>AI가 읽을 수 있는 구조로</h3>
              <p>Schema.org 마크업(LocalBusiness · Service · FAQ · Review)을 업체별로 자동 생성. Google·네이버·AI 모두 같은 텍스트를 읽습니다.</p>
              <div className="tag-row">
                <span className="chip">JSON-LD</span><span className="chip">LocalBusiness</span><span className="chip">FAQPage</span><span className="chip">Review</span>
              </div>
            </div>
            <div className="pillar">
              <div className="num">02</div>
              <h3>출처·날짜 투명하게</h3>
              <p>모든 수치에 출처와 업데이트 날짜를 명시. AI는 불확실한 문장을 회피하고 근거가 명확한 페이지를 우선 인용합니다.</p>
              <div className="tag-row">
                <span className="chip">Source · Date</span><span className="chip">네이버 플레이스</span><span className="chip">공개 데이터</span>
              </div>
            </div>
            <div className="pillar">
              <div className="num">03</div>
              <h3>비교·가이드 콘텐츠</h3>
              <p>업종별 비교표와 선택 가이드가 함께 생성돼, AI가 &ldquo;근거 있는 추천&rdquo;을 만들 수 있는 주변 문맥을 확보합니다.</p>
              <div className="tag-row">
                <span className="chip">비교표</span><span className="chip">선택 가이드</span><span className="chip">FAQ 세트</span>
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
            <p className="sec-lede">JSON-LD, FAQ, 비교 콘텐츠까지 — 업체 정보 하나만 주시면 저희가 전부 생성합니다.</p>
          </div>
          <div className="schema-demo">
            <div className="code-card" role="img" aria-label="Schema.org JSON-LD 예시">
              <div className="tabbar">
                <span className="tf active">profile.jsonld</span>
                <span className="tf">faq.jsonld</span>
                <span className="tf">compare.md</span>
              </div>
              <pre>
                <span className="c">{'// 자동 생성된 Schema.org 마크업'}</span>
                {'\n{\n  '}
                <span className="k">&quot;@context&quot;</span>: <span className="s">&quot;https://schema.org&quot;</span>,{'\n  '}
                <span className="k">&quot;@type&quot;</span>: <span className="s">&quot;MedicalClinic&quot;</span>,{'\n  '}
                <span className="k">&quot;name&quot;</span>: <span className="s">&quot;클린휴의원&quot;</span>,{'\n  '}
                <span className="k">&quot;address&quot;</span>: {'{\n    '}
                <span className="k">&quot;@type&quot;</span>: <span className="s">&quot;PostalAddress&quot;</span>,{'\n    '}
                <span className="k">&quot;streetAddress&quot;</span>: <span className="s">&quot;청수4로 16 5층&quot;</span>,{'\n    '}
                <span className="k">&quot;addressLocality&quot;</span>: <span className="s">&quot;천안시 동남구&quot;</span>,{'\n    '}
                <span className="k">&quot;addressRegion&quot;</span>: <span className="s">&quot;충남&quot;</span>{'\n  },\n  '}
                <span className="k">&quot;aggregateRating&quot;</span>: {'{\n    '}
                <span className="k">&quot;@type&quot;</span>: <span className="s">&quot;AggregateRating&quot;</span>,{'\n    '}
                <span className="k">&quot;ratingValue&quot;</span>: <span className="n">4.3</span>,{'\n    '}
                <span className="k">&quot;reviewCount&quot;</span>: <span className="n">29</span>{'\n  },\n  '}
                <span className="k">&quot;medicalSpecialty&quot;</span>: <span className="s">&quot;Dermatology&quot;</span>,{'\n  '}
                <span className="k">&quot;dataSource&quot;</span>: <span className="s">&quot;naver-place · {updatedMonth}&quot;</span>{'\n}'}
              </pre>
            </div>
            <div className="schema-copy">
              <div className="step"><div className="idx">01</div><div><h4>구조화 데이터 (JSON-LD)</h4><p>AI가 &ldquo;이 업체가 무슨 업체인지&rdquo;를 기계적으로 이해합니다. 애매한 마케팅 문구가 아닌 사실 기반 카드.</p></div></div>
              <div className="step"><div className="idx">02</div><div><h4>FAQ 자동 생성</h4><p>업종별 자주 묻는 질문을 사장님 승인 후 게시. AI가 인용할 &lsquo;답변 문장&rsquo;을 미리 준비해둡니다.</p></div></div>
              <div className="step"><div className="idx">03</div><div><h4>비교·가이드 콘텐츠</h4><p>시술/서비스별 비교표와 선택 가이드를 함께 발행해, AI가 &ldquo;근거 있는 추천&rdquo;을 구성할 수 있게 합니다.</p></div></div>
              <div className="step"><div className="idx">04</div><div><h4>월간 AI 인용 리포트</h4><p>어떤 질문에, 어떤 AI가, 어떤 문맥으로 내 업체를 인용했는지 매달 정리해 드립니다.</p></div></div>
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
            <div className="sec-kicker">등록 과정 · PROCESS</div>
            <h2 className="sec-title">
              사장님이 할 일은 <span className="it">단 5분</span>.<br />나머지는 저희가.
            </h2>
            <p className="sec-lede">평균 3영업일 안에 AI 최적화 프로필이 발행됩니다.</p>
          </div>
          <div className="timeline">
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 01</span><span className="dur">5분</span></div>
              <h3>정보 전달</h3>
              <p>네이버 플레이스 URL 1개 + 대표 서비스 3개만 주시면 됩니다.</p>
              <ul className="list"><li>상호·주소·전화번호</li><li>주력 서비스 3개</li><li>선택: 실내 사진 3장</li></ul>
            </div>
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 02</span><span className="dur">3영업일</span></div>
              <h3>AI 최적화 생성</h3>
              <p>구조화 데이터·FAQ·비교 콘텐츠가 자동 생성되며, 사장님 검수 후 발행됩니다.</p>
              <ul className="list"><li>Schema.org 자동 검증</li><li>FAQ 세트 · 가이드 1편</li><li>검수·수정 2회 포함</li></ul>
            </div>
            <div className="tstep">
              <div className="hdr"><span className="idx">STEP 03</span><span className="dur">매월</span></div>
              <h3>리포트 수신</h3>
              <p>어떤 AI가, 어떤 질문에, 내 업체를 어떻게 인용했는지 매월 리포트로 확인.</p>
              <ul className="list"><li>AI별 인용 횟수</li><li>추천된 질문 TOP 10</li><li>경쟁 업체 대비 위치</li></ul>
            </div>
          </div>
        </div>
      </section>

      {/* STATS — 실측 */}
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
              <div className="lbl">30일 AI 봇 방문</div>
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
            <div className="quote">
              <span className="mark">&ldquo;</span>
              <blockquote style={{ margin: 0 }}>
                <p>ChatGPT에서 &lsquo;천안 기미&rsquo; 검색하면 첫 줄에 저희 병원이 나옵니다. 문의 전화가 주 2건에서 <b>주 7건으로</b> 늘었습니다.</p>
                <cite style={{ fontStyle: 'normal' }}>
                  <div className="who">
                    <span className="ava">샘</span>
                    <div>
                      <b>피부과 원장 (샘플)</b>
                      <span>가상 인터뷰 · 실제 사례 기반 각색</span>
                    </div>
                  </div>
                </cite>
              </blockquote>
            </div>
            <div className="quote">
              <span className="mark">&ldquo;</span>
              <blockquote style={{ margin: 0 }}>
                <p>실내건축 면허 보유가 <b>구조화되어 있으니</b> AI가 &lsquo;믿을 만한 업체&rsquo;라고 요약하더군요.</p>
                <cite style={{ fontStyle: 'normal' }}>
                  <div className="who">
                    <span className="ava">샘</span>
                    <div>
                      <b>인테리어 대표 (샘플)</b>
                      <span>가상 인터뷰 · 실제 사례 기반 각색</span>
                    </div>
                  </div>
                </cite>
              </blockquote>
            </div>
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
            <details className="faq" open>
              <summary>정말 AI가 제 가게를 추천하게 되나요?</summary>
              <div className="ans">100% 보장은 어렵지만, 구조화 데이터·FAQ·출처 명시 이 세 가지는 AI가 인용 여부를 결정할 때 가장 큰 변수입니다. 등록 후 월간 AI 인용 리포트로 실제 결과를 확인해 드립니다.</div>
            </details>
            <details className="faq">
              <summary>네이버 플레이스가 이미 있는데 또 필요할까요?</summary>
              <div className="ans">역할이 다릅니다. 네이버 플레이스는 &lsquo;지도 기반 검색&rsquo;, AI Place는 &lsquo;생성형 AI 답변&rsquo;을 위한 구조입니다. 네이버 데이터를 기초로 활용하지만, AI가 읽는 문법은 따로 생성해야 합니다.</div>
            </details>
            <details className="faq">
              <summary>비용은 어떻게 되나요?</summary>
              <div className="ans">초기 세팅 + 월 관리 형태로 운영하며, 업종과 지역 경쟁도에 따라 다릅니다. <Link href="/pricing">가격 페이지</Link>에서 플랜별 가격을 확인하세요.</div>
            </details>
            <details className="faq">
              <summary>해지하면 페이지는 어떻게 되나요?</summary>
              <div className="ans">해지 시 프로필은 비공개 처리되며, AI 모델이 가진 캐시는 수주 이내 자연 만료됩니다. 재등록 시 기존 리포트 데이터는 복원됩니다.</div>
            </details>
            <details className="faq">
              <summary>천안 외 지역도 되나요?</summary>
              <div className="ans">현재는 천안 중심 파일럿 운영 중이며, 충청권부터 순차 확장 예정입니다.</div>
            </details>
            <details className="faq">
              <summary>데이터는 어디서 가져오나요?</summary>
              <div className="ans">네이버 플레이스, 공개 데이터(심평원 등)와 업체가 직접 제공한 정보를 조합합니다. 모든 수치에 출처와 업데이트 날짜를 표기합니다.</div>
            </details>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section id="diag">
        <div className="wrap">
          <div className="cta-card">
            <h2>지금 내 업체,<br />AI는 뭐라고<br />말할까요?</h2>
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

      {/* FOOTER */}
      <footer className="site">
        <div className="wrap">
          <div className="cols">
            <div className="brand-col">
              <Link className="logo" href="/home-v2">
                <span className="mark" /> AI Place
              </Link>
              <p>
                천안 파일럿 · AI 검색 최적화 디렉토리. 현재 {s.totalCategories}개 업종 · {s.totalPlaces}개 업체.
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
    </>
  )
}
