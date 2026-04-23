// T-141/T-214 — Owner 포털 업체 대시보드.
// T-214: scanSite(HTML 품질) → scorePlaceAeo(DB 완성도) 로 통일.
//   오너 페르소나 기준 — 사장님이 직접 고칠 수 있는 "데이터 완성도" 를 헤드라인으로.
//   /owner/citations AEO 카드와 완전히 동일한 점수·룰 사용 → 화면 간 점수 불일치 제거.
//   scanSite 는 개발팀 QA 전용(/admin)으로 강등.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { hasActiveSubscription } from '@/lib/diagnostic/citation-test'
import { checkCitationTestRateLimit } from '@/lib/diagnostic/citation-test'
import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'
import { CitationTestButton } from './citation-test-button'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ id: string }>
}

function gradeColor(grade: 'A' | 'B' | 'C' | 'D'): string {
  if (grade === 'A') return 'text-emerald-600'
  if (grade === 'B') return 'text-sky-600'
  if (grade === 'C') return 'text-amber-600'
  return 'text-red-600'
}

function gradeLabel(grade: 'A' | 'B' | 'C' | 'D'): string {
  if (grade === 'A') return '완성도 높음'
  if (grade === 'B') return '완성도 양호'
  if (grade === 'C') return '보완 필요'
  return '시작 단계'
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

  const path = `/${place.city}/${place.category}/${place.slug}`
  const now = new Date()
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // T-214: scorePlaceAeo 기반 snapshot 로드 (/owner/citations 와 동일 산식).
  const [aeoSnapshots, subActive, rateLimit, recentTest, botVisits] = await Promise.all([
    loadAeoSnapshotsForPlaces([place.id]),
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
      .gte('visited_at', since30d),
  ])

  const snap = aeoSnapshots[0]
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
          <Link href="/owner/places" className="hover:underline">내 업체</Link> › 대시보드
        </p>
        <h1 className="mt-1 text-xl font-semibold">{place.name}</h1>
        <p className="mt-0.5 font-mono text-xs text-[#6a6a6a]">{path}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {/* AEO 정보 완성도 카드 — scorePlaceAeo 기반 (citations AEO 와 동일) */}
        <section className="rounded-xl border border-[#e5e7eb] bg-white p-5">
          <p className="text-xs text-[#6a6a6a]">정보 완성도</p>
          {snap ? (
            <>
              <p className={`mt-1 text-4xl font-bold leading-none ${gradeColor(snap.grade)}`}>
                {snap.score}<span className="text-sm text-[#9a9a9a]">/100</span>
              </p>
              <p className="mt-1 text-xs text-[#6a6a6a]">
                {gradeLabel(snap.grade)} · {snap.passedCount}/{snap.totalCount} 룰 통과
              </p>
              <p className="mt-2 text-[11px] text-[#9a9a9a] leading-relaxed">
                사장님이 입력한 업체 정보(이름·연락처·FAQ·사진·서비스 등) 완성도 점수입니다.
              </p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-[#008060]">세부 항목 보기</summary>
                <ul className="mt-2 space-y-1 text-[11px]">
                  {snap.topPassedRules.map((r, idx) => (
                    <li key={`p-${idx}`} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="mr-1">✅</span>
                        {r.label}
                      </span>
                    </li>
                  ))}
                  {snap.topIssues.map((r, idx) => (
                    <li key={`f-${idx}`} className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 text-[#6a6a6a]">
                        <span className="mr-1">⚠</span>
                        {r.label}{r.detail ? ` — ${r.detail}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-[#9a9a9a]">
                  전체 {snap.totalCount}개 룰 중 상위 3개씩 표시. 전체 보기는 /owner/citations 에서 확인하세요.
                </p>
              </details>
            </>
          ) : (
            <p className="mt-2 text-sm text-[#6a6a6a]">점수 계산 데이터 불러오는 중…</p>
          )}
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

      {/* 개선 제안 — AEO 룰 실패 목록 기반 */}
      {snap && snap.topIssues.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-sm font-semibold text-amber-900">개선 제안</h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-900">
            {snap.topIssues.map((r, idx) => (
              <li key={idx}>
                <strong>{r.label}</strong>
                {r.detail ? ` — ${r.detail}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            업체 편집 페이지에서 해당 항목을 채우면 점수가 바로 반영됩니다.
          </p>
        </section>
      )}

      <p className="mt-8 text-[11px] text-[#9a9a9a]">
        정보 완성도는 입력된 업체 데이터(FAQ·사진·영업시간·서비스 등) 기반으로 계산됩니다.
        AI 인용 테스트는 주 1회 제한·활성 구독 필요.
      </p>
    </div>
  )
}
