// /check — AI 가독성 진단 (T-245 paper/orange aip 리믹스).
// 디자인 핸드오프: claude.ai/design sHNR2MeJ1i73zyOLouu1rQ, audit.html
// 라이브 fetch + regex 진단 (API 비용 0). methodology-remix 의 .au-* 베이스 + check-remix 추가 컴포넌트.

import type { Metadata } from 'next'
import Link from 'next/link'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter } from '@/components/site/site-footer'
import { composePageTitle } from '@/lib/seo/compose-title'
import { runPublicDiagnosticAction } from '@/lib/actions/diagnose'
import { getBenchmark, scoreBucket, deltaVsRegistered } from '@/lib/diagnostic/benchmark'
import { CheckForm } from './check-form'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/methodology-remix.css'
import '@/styles/check-remix.css'

const TITLE = composePageTitle('AI 가독성 진단 — 내 사이트가 AI 검색에 노출되는가')
const DESC =
  '업체 홈페이지 URL을 입력하면 AI 검색(ChatGPT·Perplexity·Claude)에서 인용될 가능성을 30초 안에 진단합니다. GEO·AEO·SEO 13개 항목을 점검.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/check' },
  openGraph: { title: TITLE, description: DESC, url: '/check' },
}

interface Props {
  searchParams: Promise<{ url?: string }>
}

const CategoryMeta: Record<'geo' | 'aeo' | 'seo', { title: string; desc: string; weight: number }> = {
  geo: { title: 'AI 검색 인용', desc: 'ChatGPT·Perplexity·Claude 가 답변에 인용할 때 핵심 신호', weight: 55 },
  aeo: { title: '답변 구조', desc: '직접 답변 단락·엔티티 링크·신선도', weight: 20 },
  seo: { title: '기초 SEO', desc: 'HTTPS·제목·설명·사이트맵 등 전통적 SEO 기본', weight: 25 },
}

const CheckIcon = (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
)
const WarnIcon = (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <path d="M12 8v4M12 16h.01M3 19h18L12 4 3 19z" />
  </svg>
)
const FailIcon = (
  <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </svg>
)

// Phase 2 / P1-5: /check 는 진단 도구 페이지라 "updated" 표시가 콘텐츠 freshness
//   신호와 무관 (매 빌드마다 변경되어 가짜 신호). 표시 자체 제거.

export default async function CheckPage({ searchParams }: Props) {
  const { url } = await searchParams
  const bench = getBenchmark()

  const result = url ? await runPublicDiagnosticAction(url) : null
  const bucket = result && !result.error ? scoreBucket(result.score) : null

  return (
    <div className="aip-root">
      <HomeNav />

      <main>
        {/* HEAD */}
        <header className="au-head">
          <div className="wrap-sm">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">AI 가독성 진단</span>
            </nav>

            <div className="au-meta-line" style={{ marginTop: 14 }}>
              <span className="pill">Diagnostic · Free</span>
              <span>doc-id <b>aip-check</b></span>
              <span>·</span>
              <span>checks <b>13</b></span>
              <span>·</span>
              <span>avg <b>30초</b></span>
            </div>

            <h1 className="au-title">AI 가독성 <span className="it">진단</span></h1>
            <p className="au-lede">
              내 업체 페이지가 ChatGPT · Claude · Gemini 에 <mark>얼마나 잘 노출되는지</mark> 30초 안에 진단합니다.
              URL 만 입력하면 GEO 5 + AEO 5 + SEO 6 = <b>13개 항목</b>을 점검한 결과를 받을 수 있습니다.
            </p>
          </div>
        </header>

        {/* FORM */}
        <section className="au-form-wrap">
          <div className="wrap-sm">
            <CheckForm initialUrl={url ?? ''} />

            {/* 빈 상태 — 무엇을 점검하나요 미리보기 */}
            {!result && (
              <div className="au-empty-preview">
                <h2>무엇을 점검하나요? <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>13개 항목</span></h2>
                <div className="sub">Princeton GEO 논문 + BrightEdge·SeoClarity·Otterly 외 25+ 출처 기반</div>

                <div className="aip-grid">
                  <div className="col geo">
                    <span className="badge">GEO · 55점</span>
                    <h3>AI 인용 신호</h3>
                    <ul>
                      <li>JSON-LD LocalBusiness</li>
                      <li>robots.txt AI 크롤러 허용</li>
                      <li>FAQPage schema</li>
                      <li>AggregateRating</li>
                      <li>BreadcrumbList</li>
                    </ul>
                  </div>
                  <div className="col aeo">
                    <span className="badge">AEO · 20점</span>
                    <h3>답변 구조</h3>
                    <ul>
                      <li>Direct Answer Block</li>
                      <li>sameAs 엔티티 링크</li>
                      <li>Last Updated Freshness</li>
                      <li>Author/Person</li>
                    </ul>
                  </div>
                  <div className="col seo">
                    <span className="badge">SEO · 25점</span>
                    <h3>기초</h3>
                    <ul>
                      <li>HTTPS · Title · Description</li>
                      <li>sitemap.xml</li>
                      <li>llms.txt</li>
                      <li>Viewport meta</li>
                    </ul>
                  </div>
                </div>

                <div className="foot">
                  근거 문서 <code>docs/GEO-SEO-AEO-딥리서치.md</code> · 산정 방식 자세히는 <Link href="/about/methodology" style={{ color: 'var(--aip-accent)' }}>조사 방법론</Link>
                </div>
              </div>
            )}

            {/* 결과 */}
            {result && (
              <div className="au-result" style={{ marginTop: 26 }}>
                {result.error ? (
                  <div className="au-callout warn-callout">
                    <strong>진단 실패</strong>
                    <span>{result.error}</span>
                    <span className="meta">URL 이 올바른지, 사이트가 접근 가능한지 확인해 주세요.</span>
                  </div>
                ) : (
                  <>
                    {/* 이전 진단 대비 변화 */}
                    {result.compare?.prev && (
                      <div className={`au-callout ${result.compare.delta.tone}`}>
                        <strong>
                          {result.compare.delta.tone === 'up' ? '↑' : result.compare.delta.tone === 'down' ? '↓' : '='}{' '}
                          {result.compare.delta.label}
                        </strong>
                        <span className="meta">
                          이전 {new Date(result.compare.prev.createdAt).toLocaleDateString('ko-KR')} · 점수{' '}
                          {result.compare.prev.score} → 현재 {result.score}
                        </span>
                        {result.compare.checkDiffs && result.compare.checkDiffs.some(d => d.pointDelta !== 0) && (
                          <details>
                            <summary>체크별 변화 상세 →</summary>
                            <ul>
                              {result.compare.checkDiffs
                                .filter(d => d.pointDelta !== 0)
                                .map(d => (
                                  <li key={d.id}>
                                    <strong>{d.label}</strong>: {d.prevStatus ?? '-'} → {d.currStatus}
                                    {' '}
                                    <span className={d.pointDelta > 0 ? 'delta-up' : 'delta-down'}>
                                      ({d.pointDelta > 0 ? `+${d.pointDelta}` : d.pointDelta}점)
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}

                    {/* 사이트맵 없음 경고 */}
                    {!result.sitemapPresent && (
                      <div className="au-callout warn-callout">
                        <strong>⚠ 사이트맵(sitemap.xml)이 없습니다</strong>
                        <span className="meta">
                          AI 크롤러가 상세 페이지를 발견하지 못합니다. 현재 진단은 <strong>홈페이지 한 페이지만</strong>{' '}
                          스캔한 결과입니다. 실제 사이트에 FAQ·리뷰가 있어도 크롤러가 찾을 수 없으면 없는 것과 같습니다.
                        </span>
                      </div>
                    )}

                    {/* 점수 헤더 */}
                    <div className="head-card">
                      <div className="head-row">
                        <div>
                          <div className="head-target">진단 대상</div>
                          <div className="head-url">{result.url}</div>
                          <div className="head-pages">
                            {result.pagesScanned}개 고유 경로 스캔 (route pattern 단위)
                            {result.sampledPages && result.sampledPages.length > 1 && (
                              <>
                                {' '}
                                ({result.sampledPages.slice(0, 5).join(', ')}
                                {result.sampledPages.length > 5 ? '…' : ''})
                              </>
                            )}
                          </div>
                        </div>
                        <div className="score-block">
                          <div className="score-lab">AI 가독성 점수</div>
                          <div className={`score-big tone-${bucket?.tone ?? 'warn'}`}>
                            {result.score}
                            <small>/100</small>
                          </div>
                          {bucket && <div className="bucket">{bucket.label}</div>}
                        </div>
                      </div>

                      {/* 벤치마크 */}
                      <div className="bench">
                        <h4>업종 평균 비교</h4>
                        <BenchmarkBar label="내 사이트" value={result.score} tone={bucket?.tone ?? 'warn'} />
                        <BenchmarkBar label="일반 업체 평균" value={bench.unregistered} tone="warn" />
                        <BenchmarkBar
                          label="AI Place 등록 업체 평균"
                          value={bench.registered}
                          tone="great"
                        />
                        <p className="bench-note">{deltaVsRegistered(result.score, bench)}</p>
                      </div>
                    </div>

                    {/* 카테고리별 체크 그룹 */}
                    {(['geo', 'aeo', 'seo'] as const).map(cat => {
                      const items = result.checks.filter(c => c.category === cat)
                      if (items.length === 0) return null
                      const sum = items.reduce((s, c) => s + c.points, 0)
                      const max = items.reduce((s, c) => s + c.maxPoints, 0)
                      const meta = CategoryMeta[cat]
                      return (
                        <div key={cat} className="au-cat-group">
                          <div className="cat-head">
                            <div>
                              <h3>
                                <span className="it">{cat.toUpperCase()}</span> · {meta.title}
                              </h3>
                              <span className="desc">{meta.desc} · 가중치 {meta.weight}</span>
                            </div>
                            <span className="sum">
                              {sum}/{max}
                            </span>
                          </div>
                          <div className="checks">
                            {items.map(c => {
                              const tone = c.status === 'pass' ? 'ok' : c.status === 'warn' ? 'warn' : 'fail'
                              const icon = c.status === 'pass' ? CheckIcon : c.status === 'warn' ? WarnIcon : FailIcon
                              return (
                                <div key={c.id} className={`ck ${tone}`}>
                                  {icon}
                                  <div>
                                    <span className="label-line">
                                      <b>{c.label}</b>
                                      {c.reference && <span className="ref">{c.reference}</span>}
                                      {c.foundOn && <span className="found">발견: {c.foundOn}</span>}
                                    </span>
                                    {c.detail && <span className="detail">{c.detail}</span>}
                                  </div>
                                  <span className="pts">
                                    <b>{c.points}</b>/{c.maxPoints}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}

                    {/* 리드 수집 + CTA */}
                    <div className="au-lead">
                      <h2>
                        {result.score < 70 ? (
                          <>
                            AI Place 에 등록하면 <span className="it">{bench.registered}점</span>까지 올라갑니다
                          </>
                        ) : (
                          <>
                            이미 좋은 점수지만, <span className="it">더 높일</span> 수 있습니다
                          </>
                        )}
                      </h2>
                      <p>
                        JSON-LD · robots.txt · sitemap · llms.txt · 업종 최적화 메타까지 — 등록 즉시 자동 적용.
                        구독 중인 업체는 <b>주 1회 실제 AI 인용 테스트</b> (ChatGPT/Claude/Gemini) 도 받아볼 수 있습니다.
                      </p>

                      {/* T-257 — lead-capture 폼 제거. PDF 자동 발송도, follow-up 메일도,
                          admin/leads 페이지도 없어 거짓 약속이었음. CTA 는 페이지 링크로 유지. */}
                      <div className="lead-actions">
                        <Link href="/owner/places/new">업체 등록</Link>
                        <Link href="/about/methodology">조사 방법론</Link>
                        <Link href="/pricing">요금</Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

function BenchmarkBar({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'bad' | 'warn' | 'ok' | 'great'
}) {
  return (
    <div className="bench-row">
      <span className="lbl">{label}</span>
      <div className="bar">
        <div className={`fill tone-${tone}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="val">{value}</span>
    </div>
  )
}
