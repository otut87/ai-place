// /owner/citations — AI 인용 현황 (Remix 디자인 ai-citations.html 구현).
// 허수 금지: 실데이터만 표시. 0 이면 "아직 없음" 으로 설명.

import type { Metadata } from 'next'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import {
  getOwnerBotSummary, getOwnerDailyTrend, getOwnerByPathSummary, listOwnerBotVisits,
} from '@/lib/owner/bot-stats'
import { composePageTitle } from '@/lib/seo/compose-title'
import { DashCharts } from '../_components/dash-charts'
import { EmptyState } from '../_components/empty-state'
import { CitationsHero } from './_components/citations-hero'
import { CitationsKpiRow } from './_components/citations-kpi-row'
import { TopPathsTable } from './_components/top-paths-table'
import { CitationsFeed } from './_components/citations-feed'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('AI 인용 현황'),
  description: '내 업체가 AI 답변·학습 봇에게 어떤 경로로 얼마나 많이 참조됐는지 확인하세요.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{ days?: string; place?: string }>
}

function parseDays(raw: string | undefined): 7 | 30 | 90 {
  if (raw === '7') return 7
  if (raw === '90') return 90
  return 30
}

export default async function OwnerCitationsPage({ searchParams }: Params) {
  const user = await requireOwnerUser()
  const { days: daysRaw, place: placeRaw } = await searchParams
  const days = parseDays(daysRaw)

  const ownerPlaces = await listOwnerPlaces()
  const selectedPlaceId = placeRaw && ownerPlaces.some((p) => p.id === placeRaw) ? placeRaw : null
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
  const [summary, dailyTrend, byPath, recent] = await Promise.all([
    getOwnerBotSummary(placeIds, days, now),
    getOwnerDailyTrend(placeIds, days, now),
    getOwnerByPathSummary(placeIds, days, now),
    listOwnerBotVisits(placeIds, 30, days, now),
  ])

  // 최신 방문 1건 — hero 의 "마지막 발생" 및 KPI1 의 last time.
  const lastVisit = recent[0] ?? null
  const lastVisitSub = lastVisit
    ? `${lastVisit.botLabel} · ${lastVisit.placeIds[0] ? placeNameById.get(lastVisit.placeIds[0]) ?? '업체' : '업체'}`
    : null
  const lastVisitIso = lastVisit?.visitedAt
    ?? summary.aiSearch.lastVisitAt
    ?? summary.aiTraining.lastVisitAt
    ?? null

  // 운영/테스트 계정 표식 — user.email 로 구분할 뿐 UI 변경 없음.
  void user

  return (
    <div className="cit-page">
      <div className="crumb">
        <Link href="/owner">← 대시보드</Link>
        <span>/</span>
        <span>AI 인용</span>
      </div>

      <CitationsHero
        days={days}
        selectedPlaceId={selectedPlaceId}
        places={ownerPlaces.map((p) => ({ id: p.id, name: p.name }))}
        botSummary={summary}
        dailyTrend={dailyTrend}
        lastVisitIso={lastVisitIso}
        lastVisitSub={lastVisitSub}
      />

      <section className="dash-sec">
        <div>
          <div className="k">Summary · {days}일</div>
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
        rangeDays={days}
      />

      <section className="dash-sec">
        <div>
          <div className="k">Top Pages · {days}일</div>
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

      <CitationsFeed visits={recent} placeNameById={placeNameById} totalDays={days} />

      <div className="footnote">
        <div className="ic">!</div>
        <div>
          크롤링은 <b>UA(User-Agent)</b> 기반 추정입니다. 실제 AI 답변에서 내 업체가 인용되었는지는
          {' '}<b>ChatGPT·Claude·Perplexity</b>에 직접 질문해 확인해 주세요.
          {' '}<b>Gemini</b>는 실시간 답변용 UA 가 따로 없어 크롤링(<code>Google-Extended</code>)만 추적됩니다.
        </div>
      </div>

      <div className="foot-meta">
        <span>계정 ID #{user.id.slice(0, 8)} · 기간 최근 {days}일</span>
        <span>실시간 집계 · 최근 동기화 방금</span>
      </div>
    </div>
  )
}
