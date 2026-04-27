// /about/methodology — paper/orange aip 리믹스 (T-242).
// 디자인 핸드오프: claude.ai/design gBcRzIvxnADVg-387SVEqA, audit.html
// audit.html 의 시각 언어를 조사 방법론 콘텐츠에 적용.

import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { safeJsonLd } from '@/lib/utils'
import { generatePerson, generateArticle, generateFAQPage } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import {
  getMethodologyFaqs,
  getMethodologySources,
  getMethodologyUpdateCadence,
  getEeatCriteria,
} from '@/lib/methodology'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/methodology-remix.css'
import '@/styles/pricing-remix.css'

const BASE_URL = 'https://aiplace.kr'
const PAGE_URL = `${BASE_URL}/about/methodology`
const TITLE = composePageTitle('조사 방법론 — 데이터 출처·갱신 주기·E-E-A-T')
const DESCRIPTION =
  'AI Place가 업체 정보를 수집·검증·갱신하는 방법을 공개합니다. 공식 기관·지도 API·공개 리뷰·AI 인용 테스트 4대 소스, 주 1회부터 분기 1회까지의 갱신 주기.'
const LAST_UPDATED = new Date().toISOString().slice(0, 10)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/about/methodology' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/about/methodology' },
}

interface ScoringRow {
  code: string
  label: string
  detail: string
  max: number
}

const SCORING_RUBRIC: ScoringRow[] = [
  { code: '01', label: 'JSON-LD LocalBusiness', detail: 'AI 인용 전제조건 · GEO §5.3', max: 18 },
  { code: '02', label: 'robots.txt AI 크롤러 허용', detail: '차단 시 인용 풀 제외 · §5.1', max: 15 },
  { code: '03', label: 'FAQPage schema', detail: '인용률 2.7~3.2배 · §4.3', max: 12 },
  { code: '04', label: 'Direct Answer Block', detail: 'AEO 단일 최대 기여 · §4.4', max: 9 },
  { code: '05', label: 'sitemap.xml', detail: '크롤러 발견 필수', max: 7 },
  { code: '06', label: 'AggregateRating', detail: 'AI 수치 신호 · §3.1', max: 5 },
  { code: '07', label: 'sameAs 엔티티 링크', detail: 'Knowledge Graph 연결 · §5.3', max: 5 },
  { code: '08', label: 'Last Updated Freshness', detail: 'ChatGPT 2.3배 가중 · §4.2', max: 5 },
  { code: '09', label: 'BreadcrumbList', detail: '페이지 계층 인식', max: 4 },
  { code: '10', label: 'Author/Person (E-E-A-T)', detail: '인용률 +40% · §4.1', max: 4 },
  { code: '11', label: '기초 SEO 패키지', detail: 'title · description · HTTPS · time · llms · viewport', max: 16 },
]

export default function MethodologyPage() {
  const sources = getMethodologySources()
  const cadence = getMethodologyUpdateCadence()
  const eeat = getEeatCriteria()
  const faqs = getMethodologyFaqs()

  const articleJsonLd = generateArticle({
    title: '조사 방법론',
    description: DESCRIPTION,
    lastUpdated: LAST_UPDATED,
    url: PAGE_URL,
  })
  const personJsonLd = generatePerson()
  const faqJsonLd = generateFAQPage(faqs)
  const breadcrumbJsonLd = generateBreadcrumbList([
    { name: '홈', url: BASE_URL },
    { name: 'AI Place 소개', url: `${BASE_URL}/about` },
    { name: '조사 방법론', url: PAGE_URL },
  ])

  return (
    <div className="aip-root">
      <HomeNav />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(personJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

      <main>
        {/* HEAD */}
        <header className="au-head">
          <div className="wrap-sm">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <Link href="/about">AI Place 소개</Link>
              <span className="sep">/</span>
              <span className="cur">조사 방법론</span>
            </nav>

            <div className="au-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">Methodology · v1.2</span>
              <span>doc-id <b>aip-methodology</b></span>
              <span>·</span>
              <span>updated <b>{LAST_UPDATED}</b></span>
              <span>·</span>
              <span>sources <b>{sources.length}</b></span>
              <span>·</span>
              <span>checks <b>{SCORING_RUBRIC.length}</b></span>
            </div>

            <h1 className="au-title">조사 <span className="it">방법론</span></h1>
            <p className="au-lede">
              AI Place는 공식 기관·지도 API·공개 리뷰·AI 인용 테스트 <mark>4대 소스</mark>로 업체 정보를 수집하고,{' '}
              주 1회부터 분기 1회까지의 검증·갱신 주기를 따릅니다. 모든 수치에는 출처와 날짜를 명시합니다.
            </p>
          </div>
        </header>

        {/* CTA strip → /check */}
        <section className="au-form-wrap">
          <div className="wrap-sm">
            {/* CTA strip — 헤더성 강조라 h2 (h1 다음 첫 섹션) 로 처리해 점프 회피. */}
            <div className="au-cta-strip">
              <div>
                <h2>내 페이지가 AI에게 잘 읽히는지 <span className="it">바로 진단</span></h2>
                <p>
                  같은 방법론을 적용한 무료 진단 도구. URL 1개만 넣으면 30초 내에 16개 항목 점수와 PDF 리포트를 받을 수 있습니다.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link className="btn ghost" href="/about">소개</Link>
                <Link className="btn primary" href="/check">AI 진단 시작 →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* 1. 데이터 출처 */}
        <section className="au-section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div className="wrap-sm">
            <div className="doc-h">
              <div>
                <h2><span className="num">1.</span> 데이터 <span className="it">출처</span></h2>
                <p className="sub">{sources.length}개의 1차 소스에서만 수집. 모두 공식 API 또는 공개 리뷰이며, 스크래핑은 사용하지 않습니다.</p>
              </div>
              <div className="anchor">sources</div>
            </div>

            <div className="au-steps" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {sources.map((s, i) => (
                <div className="au-step" key={s.label}>
                  <span className="n">{i + 1}</span>
                  <h3>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                        {s.label}
                      </a>
                    ) : (
                      s.label
                    )}
                  </h3>
                  <p>{s.purpose}</p>
                  {s.url && (
                    <span className="tail">
                      {new URL(s.url).host}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. 갱신 주기 */}
        <section className="au-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div>
                <h2><span className="num">2.</span> 갱신 <span className="it">주기</span></h2>
                <p className="sub">주기마다 다른 항목을 점검합니다. 각 페이지 하단의 &ldquo;마지막 업데이트&rdquo; 날짜가 실제 갱신 시점.</p>
              </div>
              <div className="anchor">cadence</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="au-table">
                <thead>
                  <tr>
                    <th>주기</th>
                    <th>수행 항목</th>
                    <th style={{ textAlign: 'right' }}>비중</th>
                  </tr>
                </thead>
                <tbody>
                  {cadence.map((c, i) => (
                    <tr key={c.period}>
                      <td>{String(i + 1).padStart(2, '0')}</td>
                      <td>
                        <b>{c.period}</b>
                        <div style={{ marginTop: 4, color: 'var(--ink-2)', fontSize: 13 }}>{c.scope}</div>
                      </td>
                      <td>{i === 0 ? 'High' : i === 1 ? 'Med' : 'Low'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3. E-E-A-T */}
        <section className="au-section" style={{ background: 'var(--bg-2)', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <div className="wrap-sm">
            <div className="doc-h">
              <div>
                <h2><span className="num">3.</span> E-E-A-T <span className="it">기준</span></h2>
                <p className="sub">Google이 제시한 4대 축을 운영 원칙으로 번역해 적용합니다.</p>
              </div>
              <div className="anchor">eeat</div>
            </div>

            <div className="au-steps" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {eeat.map((x, i) => (
                <div className="au-step" key={x.axis}>
                  <span className="n">{String.fromCharCode(0x2160 + i)}</span>
                  <h3>{x.axis} <span style={{ color: 'var(--aip-muted)', fontWeight: 400, fontSize: 13 }}>· {x.korean}</span></h3>
                  <p>{x.practice}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. 점수 산정 (8 checks 확장) */}
        <section className="au-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div>
                <h2><span className="num">4.</span> 점수 <span className="it">산정 방식</span></h2>
                <p className="sub">
                  /check 진단의 가중치는 <code style={{ fontFamily: 'var(--mono)', fontSize: 12, background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 3 }}>docs/GEO-SEO-AEO-딥리서치.md</code>{' '}
                  (Princeton GEO 논문 + BrightEdge·SeoClarity·Otterly 외 25+ 출처) 에 근거합니다. 총 100점.
                </p>
              </div>
              <div className="anchor">checks</div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="au-table">
                <thead>
                  <tr>
                    <th>코드</th>
                    <th>항목 · 무엇을 보나</th>
                    <th style={{ textAlign: 'right' }}>최대</th>
                  </tr>
                </thead>
                <tbody>
                  {SCORING_RUBRIC.map(row => (
                    <tr key={row.code}>
                      <td>{row.code}</td>
                      <td>
                        <b>{row.label}</b>
                        <div style={{ marginTop: 4, color: 'var(--aip-muted)', fontSize: 12, fontFamily: 'var(--mono)' }}>{row.detail}</div>
                      </td>
                      <td>{row.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p style={{ marginTop: 14, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--aip-muted)', letterSpacing: '.04em' }}>
              ※ 같은 URL 3회 연속 실행 시 편차 ≤ 1점 (재현성 보장) · 5xx 자동 재시도 · User-Agent: AIPlaceDiagnostic/3.1
            </p>
          </div>
        </section>

        {/* 5. FAQ */}
        <section className="faq-section">
          <div className="wrap-sm">
            <div className="doc-h">
              <div><h2>자주 묻는 <span className="it">질문</span></h2></div>
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

        {/* footer note */}
        <section className="au-section" style={{ paddingTop: 24, paddingBottom: 60 }}>
          <div className="wrap-sm">
            <div style={{
              padding: '20px 24px',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg-2)',
              border: '1px solid var(--line-2)',
              fontFamily: 'var(--mono)',
              fontSize: 11.5,
              lineHeight: 1.7,
              color: 'var(--aip-muted)',
              letterSpacing: '.02em',
            }}>
              <b style={{ color: 'var(--ink)' }}>면책</b> · 본 페이지의 수치·순위는 공개 데이터에 기반한 자체 조사 결과이며,
              의료·법률·세무 판단의 근거가 될 수 없습니다. 최종 결정 전 관련 전문가의 상담을 받으시기 바랍니다.
              <br />
              <br />
              마지막 업데이트 <b style={{ color: 'var(--ink)' }}>{LAST_UPDATED}</b> · 작성{' '}
              <Link href="/about" style={{ color: 'var(--aip-accent)' }}>이지수 큐레이터</Link> · 문의{' '}
              <a href={`mailto:${SITE_BRAND.email}`} style={{ color: 'var(--aip-accent)' }}>{SITE_BRAND.email}</a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
