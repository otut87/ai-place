// /owner/citations — AI 인용 현황 (Remix 디자인 ai-citations.html 구현).
// T-209: 월 프리셋 · 사용자 지정 날짜 범위 + AEO/이슈 패널 통합 (기존 /owner/reports 흡수).
// 허수 금지: 실데이터만 표시. 0 이면 "아직 없음" 으로 설명.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import {
  getOwnerBotSummary, getOwnerDailyTrend, getOwnerByPathSummary, listOwnerBotVisits,
} from '@/lib/owner/bot-stats'
import { resolveOwnerPagePeriod } from '@/lib/owner/period-parser'
import { composePageTitle } from '@/lib/seo/compose-title'
import { DashCharts } from '../_components/dash-charts'
import { EmptyState } from '../_components/empty-state'
import { CitationsHero } from './_components/citations-hero'
import { CitationsKpiRow } from './_components/citations-kpi-row'
import { TopPathsTable } from './_components/top-paths-table'
import { CitationsFeed } from './_components/citations-feed'
import { CitationsAeoPanel } from './_components/citations-aeo-panel'
import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('AI 인용 현황'),
  description: '내 업체가 AI 답변·학습 봇에게 어떤 경로로 얼마나 많이 참조됐는지 확인하세요.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{ days?: string; place?: string; from?: string; to?: string }>
}

export default async function OwnerCitationsPage({ searchParams }: Params) {
  const user = await requireOwnerUser()
  const sp = await searchParams

  const ownerPlaces = await listOwnerPlaces()
  const selectedPlaceId = sp.place && ownerPlaces.some((p) => p.id === sp.place) ? sp.place : null
  const placeIds = selectedPlaceId ? [selectedPlaceId] : ownerPlaces.map((p) => p.id)
  const placeNameById = new Map(ownerPlaces.map((p) => [p.id, p.name]))

  if (ownerPlaces.length === 0) {
    return (
      <div className="cit-page">
        <div className="crumb"><Link href="/owner">← 대시보드</Link><span>/</span><span>AI 인용</span></div>
        <EmptyState
          eyebrow="· · · 아직 등록된 업체가 없어요 · · ·"
          title={<>첫 업체를 <em>등록</em>하고 AI 노출을 시작하세요</>}
          description="업체를 등록하면 24시간 내에 AI 검색 봇이 방문하기 시작합니다."
          action={{ href: '/owner/places/new', label: '+ 업체 등록', variant: 'accent' }}
        />
      </div>
    )
  }

  const now = new Date()
  const period = resolveOwnerPagePeriod(sp, now)
  // 통계 입력: 'days' 모드는 number 로, month/custom 은 {from,to} 로 넘긴다.
  const statsInput = period.mode === 'days'
    ? period.days
    : { from: period.from, to: period.to }

  const [summary, dailyTrend, byPath, recent, aeoSnapshots] = await Promise.all([
    getOwnerBotSummary(placeIds, statsInput, now),
    getOwnerDailyTrend(placeIds, statsInput, now),
    getOwnerByPathSummary(placeIds, statsInput, now),
    listOwnerBotVisits(placeIds, 30, statsInput, now),
    loadAeoSnapshotsForPlaces(placeIds),
  ])

  const lastVisit = recent[0] ?? null
  const lastVisitSub = lastVisit
    ? `${lastVisit.botLabel} · ${lastVisit.placeIds[0] ? placeNameById.get(lastVisit.placeIds[0]) ?? '업체' : '업체'}`
    : null
  const lastVisitIso = lastVisit?.visitedAt
    ?? summary.aiSearch.lastVisitAt
    ?? summary.aiTraining.lastVisitAt
    ?? null

  void user

  const periodDays = summary.periodDays

  return (
    <div className="cit-page">
      <div className="crumb">
        <Link href="/owner">← 대시보드</Link>
        <span>/</span>
        <span>AI 인용</span>
      </div>

      <CitationsHero
        periodMode={period.mode}
        periodLabel={period.label}
        periodDays={periodDays}
        days={period.mode === 'days' ? period.days : null}
        monthKey={period.mode === 'month' ? period.monthKey : null}
        from={period.from}
        to={period.to}
        selectedPlaceId={selectedPlaceId}
        places={ownerPlaces.map((p) => ({ id: p.id, name: p.name }))}
        botSummary={summary}
        dailyTrend={dailyTrend}
        lastVisitIso={lastVisitIso}
        lastVisitSub={lastVisitSub}
      />

      <section className="dash-sec">
        <div>
          <div className="k">Summary · {period.label}</div>
          <h2>접촉 <span className="it">유형별</span> 분해</h2>
        </div>
      </section>

      <CitationsKpiRow
        botSummary={summary}
        byPath={byPath}
        placeCount={ownerPlaces.length}
        lastVisitIso={lastVisitIso}
      />

      <DashCharts
        rows={dailyTrend}
        searchTotal={summary.aiSearch.total}
        trainingTotal={summary.aiTraining.total}
        rangeDays={periodDays}
      />

      <section className="dash-sec">
        <div>
          <div className="k">AEO · {period.label}</div>
          <h2>AI가 읽기 쉬운 <span className="it">정보 완성도</span></h2>
        </div>
      </section>

      <CitationsAeoPanel
        snapshots={aeoSnapshots}
        placeNameById={placeNameById}
      />

      <section className="dash-sec">
        <div>
          <div className="k">Top Pages · {period.label}</div>
          <h2>AI가 가장 많이 <span className="it">방문한</span> 페이지</h2>
        </div>
      </section>

      <TopPathsTable rows={byPath} placeNameById={placeNameById} />

      <section className="dash-sec">
        <div>
          <div className="k">Activity · Feed</div>
          <h2>최근 AI 봇 <span className="it">방문</span> <small>{recent.length}건</small></h2>
        </div>
      </section>

      <CitationsFeed visits={recent} placeNameById={placeNameById} totalDays={periodDays} />

      <div className="footnote">
        <div className="ic">!</div>
        <div>
          크롤링은 <b>UA(User-Agent)</b> 기반 추정입니다. 실제 AI 답변에서 내 업체가 인용되었는지는
          {' '}<b>ChatGPT·Claude·Perplexity</b>에 직접 질문해 확인해 주세요.
          {' '}<b>Gemini</b>는 실시간 답변용 UA 가 따로 없어 크롤링(<code>Google-Extended</code>)만 추적됩니다.
        </div>
      </div>

      <div className="foot-meta">
        <span>계정 ID #{user.id.slice(0, 8)} · 기간 {period.label}</span>
        <span>실시간 집계 · 최근 동기화 방금</span>
      </div>
    </div>
  )
}
