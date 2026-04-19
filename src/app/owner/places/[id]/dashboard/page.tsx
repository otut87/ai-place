// T-141 — Owner 포털 업체 대시보드.
// 기술 진단 + 30일 봇 방문 + 최근 AI 인용 테스트 결과 + AI 테스트 실행 버튼.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { scanSite } from '@/lib/diagnostic/scan-site'
import { scoreBucket, getBenchmark } from '@/lib/diagnostic/benchmark'
import { checkCitationTestRateLimit, hasActiveSubscription } from '@/lib/diagnostic/citation-test'
import { CitationTestButton } from './citation-test-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ id: string }>
}

export default async function OwnerPlaceDashboardPage({ params }: Props) {
  const user = await requireOwnerUser()
  const { id } = await params
  const admin = getAdminClient()
  if (!admin) return <p className="p-6 text-red-600">DB 연결 실패</p>

  const { data: placeRow } = await admin
    .from('places')
    .select('id, slug, name, city, category, status, customer_id, naver_place_url, kakao_map_url')
    .eq('id', id)
    .maybeSingle()
  if (!placeRow) notFound()

  const place = placeRow as {
    id: string; slug: string; name: string; city: string; category: string
    status: string; customer_id: string | null
    naver_place_url: string | null; kakao_map_url: string | null
  }

  // 소유권 검증
  if (place.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('user_id')
      .eq('id', place.customer_id)
      .maybeSingle()
    if (!customer || (customer as { user_id: string }).user_id !== user.id) {
      return <div className="mx-auto max-w-2xl p-6 text-sm text-[#6a6a6a]">이 업체에 대한 권한이 없습니다.</div>
    }
  }

  // 병렬 로드
  const path = `/${place.city}/${place.category}/${place.slug}`
  const internalUrl = `https://aiplace.kr${path}`

  const [scan, subActive, rateLimit, recentTest, botVisits] = await Promise.all([
    scanSite(internalUrl),
    hasActiveSubscription(place.customer_id),
    checkCitationTestRateLimit(place.id),
    admin.from('citation_tests')
      .select('id, started_at, results_count, cited_count, citation_rate')
      .eq('place_id', place.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from('bot_visits')
      .select('bot_id, status')
      .eq('path', path)
      .gte('visited_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
  ])

  const bucket = scoreBucket(scan.score)
  const bench = getBenchmark()
  const test = recentTest.data as { id: string; started_at: string; results_count: number; cited_count: number; citation_rate: number } | null
  const botRows = (botVisits.data ?? []) as Array<{ bot_id: string; status: number | null }>
  const botStats = {
    total: botRows.length,
    s200: botRows.filter(r => r.status === 200).length,
    uniqueBots: new Set(botRows.map(r => r.bot_id)).size,
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6">
        <p className="text-xs text-[#6a6a6a]">
          <Link href="/owner" className="hover:underline">내 업체</Link> › 대시보드
        </p>
        <h1 className="mt-1 text-xl font-semibold">{place.name}</h1>
        <p className="mt-0.5 font-mono text-xs text-[#6a6a6a]">{path}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {/* 기술 진단 카드 */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
          <p className="text-xs text-[#6a6a6a]">AI 가독성 점수</p>
          <p className={`mt-1 text-4xl font-bold leading-none ${
            bucket.tone === 'great' ? 'text-emerald-600' :
            bucket.tone === 'ok' ? 'text-sky-600' :
            bucket.tone === 'warn' ? 'text-amber-600' : 'text-red-600'
          }`}>
            {scan.score}<span className="text-sm text-[#9a9a9a]">/100</span>
          </p>
          <p className="mt-1 text-xs text-[#6a6a6a]">{bucket.label} · 등록 평균 {bench.registered}점</p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[#008060]">세부 항목 보기</summary>
            <ul className="mt-2 space-y-1 text-[11px]">
              {scan.checks.map(c => (
                <li key={c.id} className="flex items-start justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    <span className="mr-1">{c.status === 'pass' ? '✅' : c.status === 'warn' ? '⚠' : '❌'}</span>
                    {c.label}
                  </span>
                  <span className="text-[#6a6a6a]">{c.points}/{c.maxPoints}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>

        {/* AI 봇 방문 카드 */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
          <p className="text-xs text-[#6a6a6a]">AI 봇 방문 (30일)</p>
          <p className="mt-1 text-4xl font-bold leading-none text-[#191919]">
            {botStats.total}<span className="text-sm text-[#9a9a9a]">회</span>
          </p>
          <p className="mt-1 text-xs text-[#6a6a6a]">
            성공 {botStats.s200} · 서로 다른 봇 {botStats.uniqueBots}종
          </p>
          {botStats.total === 0 && (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">
              아직 AI 봇이 방문하지 않았습니다. IndexNow 제출·시간 경과 후 재확인.
            </p>
          )}
        </section>

        {/* 최근 AI 인용 테스트 */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
          <p className="text-xs text-[#6a6a6a]">최근 AI 인용 테스트</p>
          {test ? (
            <>
              <p className="mt-1 text-4xl font-bold leading-none text-[#191919]">
                {Math.round((test.citation_rate ?? 0) * 100)}<span className="text-sm text-[#9a9a9a]">%</span>
              </p>
              <p className="mt-1 text-xs text-[#6a6a6a]">
                인용 {test.cited_count}/{test.results_count}회 · {new Date(test.started_at).toLocaleDateString('ko-KR')}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#6a6a6a]">아직 실행 이력 없음</p>
          )}
          <div className="mt-3">
            <CitationTestButton
              placeId={place.id}
              subActive={subActive}
              rateAllowed={rateLimit.allowed}
              remainingHours={rateLimit.remainingHours}
              lastRunAt={rateLimit.lastRunAt}
            />
          </div>
        </section>
      </div>

      {/* 개선 제안 */}
      {scan.score < 85 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">개선 제안</h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {scan.checks.filter(c => c.status !== 'pass').slice(0, 5).map(c => (
              <li key={c.id}>
                <strong>{c.label}</strong> — {c.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            AI Place 에 등록하면 위 항목들이 자동 처리됩니다.
          </p>
        </section>
      )}

      <p className="mt-8 text-[11px] text-[#9a9a9a]">
        진단은 페이지 방문 시점마다 실시간 수행됩니다. AI 인용 테스트는 주 1회 제한·활성 구독 필요.
      </p>
    </div>
  )
}
