// T-136 — 공개 진단 페이지 /check.
// 누구나 URL 입력 → 기술 진단 받기 (API 비용 0, fetch+regex 만).

import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { composePageTitle } from '@/lib/seo/compose-title'
import { runPublicDiagnosticAction } from '@/lib/actions/diagnose'
import { getBenchmark, scoreBucket, deltaVsRegistered } from '@/lib/diagnostic/benchmark'
import { CheckForm } from './check-form'
import { LeadForm } from './lead-form'

const TITLE = composePageTitle('AI 가독성 진단 — 내 사이트가 AI 검색에 노출되는가')
const DESC = '업체 홈페이지 URL을 입력하면 AI 검색(ChatGPT·Perplexity·Claude)에서 인용될 가능성을 30초 안에 진단합니다. GEO·AEO·SEO 13개 항목을 점검.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/check' },
  openGraph: { title: TITLE, description: DESC, url: '/check' },
}

interface Props {
  searchParams: Promise<{ url?: string }>
}

export default async function CheckPage({ searchParams }: Props) {
  const { url } = await searchParams
  const bench = getBenchmark()

  const result = url ? await runPublicDiagnosticAction(url) : null
  const bucket = result && !result.error ? scoreBucket(result.score) : null

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="py-16 px-6">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-[28px] font-bold text-[#222222] leading-tight">
              AI 가독성 진단
            </h1>
            <p className="mt-3 text-base text-[#222222]">
              홈페이지 URL 을 입력하면 AI 검색(ChatGPT, Claude, Gemini)이 당신의 업체를 읽을 수 있는지 30초 안에 확인합니다.
            </p>

            <div className="mt-6">
              <CheckForm initialUrl={url ?? ''} />
            </div>

            {result && (
              <div className="mt-10">
                {result.error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                    <p className="font-semibold">진단 실패</p>
                    <p className="mt-1">{result.error}</p>
                    <p className="mt-2 text-xs">URL 이 올바른지, 사이트가 접근 가능한지 확인해 주세요.</p>
                  </div>
                ) : (
                  <>
                    {/* 이전 진단 대비 변화 (M11.4) */}
                    {result.compare?.prev && (
                      <div className={`mb-4 rounded-xl border p-4 text-sm ${
                        result.compare.delta.tone === 'up' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' :
                        result.compare.delta.tone === 'down' ? 'border-red-300 bg-red-50 text-red-900' :
                        'border-slate-300 bg-slate-50 text-slate-800'
                      }`}>
                        <p className="font-semibold">
                          {result.compare.delta.tone === 'up' ? '↑' : result.compare.delta.tone === 'down' ? '↓' : '='} {result.compare.delta.label}
                        </p>
                        <p className="mt-1 text-xs">
                          이전 진단: {new Date(result.compare.prev.createdAt).toLocaleDateString('ko-KR')} · 점수 {result.compare.prev.score}
                          → 현재 {result.score}
                        </p>
                        {result.compare.checkDiffs && result.compare.checkDiffs.some(d => d.pointDelta !== 0) && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs underline">체크별 변화 상세</summary>
                            <ul className="mt-2 space-y-1 text-xs">
                              {result.compare.checkDiffs.filter(d => d.pointDelta !== 0).map(d => (
                                <li key={d.id}>
                                  <strong>{d.label}</strong>: {d.prevStatus ?? '-'} → {d.currStatus}
                                  {' '}(<span className={d.pointDelta > 0 ? 'text-emerald-700' : 'text-red-700'}>
                                    {d.pointDelta > 0 ? `+${d.pointDelta}` : d.pointDelta}점
                                  </span>)
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    )}

                    {/* 사이트맵 없음 경고 */}
                    {!result.sitemapPresent && (
                      <div className="mb-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
                        <p className="font-semibold">⚠ 사이트맵(sitemap.xml)이 없습니다</p>
                        <p className="mt-1 text-xs">
                          AI 크롤러가 상세 페이지를 발견하지 못합니다. 현재 진단은 <strong>홈페이지 한 페이지만</strong> 스캔한 결과입니다.
                          실제 사이트에는 FAQ·리뷰가 있어도 크롤러가 찾을 수 없으면 없는 것과 같습니다.
                        </p>
                      </div>
                    )}

                    {/* 점수 헤더 */}
                    <div className="rounded-2xl border border-[#e7e7e7] bg-white p-6">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-xs text-[#6a6a6a]">진단 대상</p>
                          <p className="mt-0.5 break-all font-mono text-sm text-[#191919]">{result.url}</p>
                          <p className="mt-1 text-xs text-[#6a6a6a]">
                            {result.pagesScanned}개 고유 경로 스캔 (route pattern 단위)
                            {result.sampledPages && result.sampledPages.length > 1 && (
                              <span className="ml-1 font-mono">({result.sampledPages.slice(0, 5).join(', ')}{result.sampledPages.length > 5 ? '...' : ''})</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-[#6a6a6a]">AI 가독성 점수</p>
                          <p className={`text-5xl font-bold leading-none ${
                            bucket?.tone === 'great' ? 'text-emerald-600' :
                            bucket?.tone === 'ok' ? 'text-sky-600' :
                            bucket?.tone === 'warn' ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {result.score}
                            <span className="text-xl text-[#9a9a9a]">/100</span>
                          </p>
                          {bucket && <p className="mt-1 text-xs text-[#6a6a6a]">{bucket.label}</p>}
                        </div>
                      </div>

                      {/* 벤치마크 */}
                      <div className="mt-4 border-t border-[#f0f0f0] pt-4">
                        <p className="mb-2 text-xs font-medium text-[#6b6b6b]">업종 평균 비교</p>
                        <BenchmarkBar label="내 사이트" value={result.score} tone={bucket?.tone ?? 'warn'} />
                        <BenchmarkBar label="일반 업체 평균" value={bench.unregistered} tone="warn" />
                        <BenchmarkBar label="AI Place 등록 업체 평균" value={bench.registered} tone="great" />
                        <p className="mt-2 text-xs text-[#6a6a6a]">{deltaVsRegistered(result.score, bench)}</p>
                      </div>
                    </div>

                    {/* 체크 항목 — 카테고리별 그룹 */}
                    {(['geo', 'aeo', 'seo'] as const).map(cat => {
                      const items = result.checks.filter(c => c.category === cat)
                      if (items.length === 0) return null
                      const sum = items.reduce((s, c) => s + c.points, 0)
                      const max = items.reduce((s, c) => s + c.maxPoints, 0)
                      const meta =
                        cat === 'geo' ? { title: 'GEO — AI 검색 인용 (가중치 55)', desc: 'ChatGPT·Perplexity·Claude가 업체를 답변에 인용할 때 핵심 신호' } :
                        cat === 'aeo' ? { title: 'AEO — 답변 구조 (가중치 20)', desc: '직접 답변 단락·엔티티 링크·신선도' } :
                        { title: 'SEO — 기초 (가중치 25)', desc: 'HTTPS·제목·설명·사이트맵 등 전통적 SEO 기본' }
                      return (
                        <div key={cat} className="mt-6 rounded-2xl border border-[#e7e7e7] bg-white p-6">
                          <div className="mb-3 flex items-baseline justify-between">
                            <div>
                              <h2 className="text-base font-semibold text-[#191919]">{meta.title}</h2>
                              <p className="mt-0.5 text-xs text-[#6a6a6a]">{meta.desc}</p>
                            </div>
                            <span className="font-mono text-sm text-[#191919]">{sum}/{max}</span>
                          </div>
                          <ul className="space-y-3">
                            {items.map(c => {
                              const icon = c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠' : '❌'
                              const bg = c.status === 'pass' ? 'bg-emerald-50' : c.status === 'warn' ? 'bg-amber-50' : 'bg-red-50'
                              return (
                                <li key={c.id} className={`rounded-lg border border-[#f0f0f0] p-3 ${bg}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2">
                                      <span className="text-base leading-none">{icon}</span>
                                      <div>
                                        <p className="text-sm font-medium text-[#191919]">
                                          {c.label}
                                          {c.reference && <span className="ml-1.5 text-[10px] text-[#9a9a9a]">{c.reference}</span>}
                                          {c.foundOn && <span className="ml-1.5 font-mono text-[10px] text-emerald-700">발견: {c.foundOn}</span>}
                                        </p>
                                        {c.detail && <p className="mt-0.5 text-xs text-[#6a6a6a]">{c.detail}</p>}
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-xs text-[#6a6a6a]">
                                      {c.points}/{c.maxPoints}
                                    </span>
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}

                    {/* CTA + 리드 수집 */}
                    <div className="mt-6 rounded-2xl bg-[#008060] p-6 text-white">
                      <h2 className="text-lg font-semibold">
                        {result.score < 70
                          ? `AI Place 에 등록하면 ${bench.registered}점까지 올라갑니다.`
                          : '이미 좋은 점수지만, 더 높일 수 있습니다.'}
                      </h2>
                      <p className="mt-1.5 text-sm text-emerald-50">
                        JSON-LD, robots.txt, sitemap, llms.txt, 업종 최적화 메타까지 — 등록 즉시 자동 적용.
                        구독 중인 업체는 <strong>주 1회 실제 AI 인용 테스트</strong> (ChatGPT/Claude/Gemini) 도 받아볼 수 있습니다.
                      </p>

                      <div className="mt-4 rounded-xl bg-white/10 p-4">
                        <LeadForm targetUrl={result.url} score={result.score} />
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Link
                          href="/about"
                          className="inline-flex h-10 items-center rounded-lg border border-white/30 px-4 text-sm hover:bg-white/10"
                        >
                          서비스 소개
                        </Link>
                        <Link
                          href="/about/methodology"
                          className="inline-flex h-10 items-center rounded-lg border border-white/30 px-4 text-sm hover:bg-white/10"
                        >
                          조사 방법론
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* FAQ — 신규 방문자 설명 */}
            {!result && (
              <div className="mt-12 rounded-2xl border border-[#e7e7e7] bg-[#fafafa] p-6">
                <h2 className="text-base font-semibold text-[#191919]">무엇을 점검하나요? (13개 항목 · Princeton GEO 논문 기반)</h2>
                <div className="mt-3 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-emerald-700">GEO — AI 인용 (55점)</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-[#484848]">
                      <li>✓ JSON-LD LocalBusiness (subtype)</li>
                      <li>✓ robots.txt AI 크롤러 허용</li>
                      <li>✓ FAQPage schema</li>
                      <li>✓ AggregateRating (집계 평점)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-sky-700">AEO — 답변 구조 (20점)</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-[#484848]">
                      <li>✓ Direct Answer Block</li>
                      <li>✓ sameAs 엔티티 링크</li>
                      <li>✓ 최종 업데이트 (Freshness)</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#6a6a6a]">SEO 기초 (25점)</p>
                    <ul className="mt-1.5 space-y-1 text-sm text-[#484848]">
                      <li>✓ 제목·설명·사이트맵</li>
                      <li>✓ HTTPS·Viewport·llms.txt</li>
                    </ul>
                  </div>
                </div>
                <p className="mt-4 text-xs text-[#6a6a6a]">
                  API 비용 없이 즉시 실행. 브라우저·로그인 불필요. 30초 내 결과. 근거: <code>docs/GEO-SEO-AEO-딥리서치.md</code>
                </p>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

function BenchmarkBar({ label, value, tone }: { label: string; value: number; tone: 'bad' | 'warn' | 'ok' | 'great' }) {
  const color =
    tone === 'great' ? 'bg-emerald-500' :
    tone === 'ok' ? 'bg-sky-500' :
    tone === 'warn' ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="mb-2 flex items-center gap-3 text-xs">
      <span className="w-40 shrink-0 text-[#484848]">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-[#191919]">{value}</span>
    </div>
  )
}
