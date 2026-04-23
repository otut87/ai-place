// /owner 대시보드 — Remix 디자인 (docs/AIPLACE-Remix-handoff/aiplace-remix/project/dashboard.html).
// 모든 실측만 노출 (허수 금지). 업체 0곳 이면 empty hero.

import Link from 'next/link'
import type { Metadata } from 'next'
import { loadOwnerDashboard } from '@/lib/owner/dashboard-data'
import { composePageTitle } from '@/lib/seo/compose-title'
import { EmptyState } from './_components/empty-state'
import { DashHero } from './_components/dash-hero'
import { DashCharts } from './_components/dash-charts'
import { DashAeoSummary } from './_components/dash-aeo-summary'
import { DashBizSummary } from './_components/dash-biz-summary'
import { DashPlaceList } from './_components/dash-place-list'
import { DashAeoChecklist } from './_components/dash-aeo-checklist'
import { DashBotCard } from './_components/dash-bot-card'
import { DashTodoCard } from './_components/dash-todo-card'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('오너 대시보드'),
  description: '내 업체의 AI 인용·AEO 점수·할 일을 한눈에 확인하세요.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{ registered?: string; msg?: string; days?: string }>
}

function parseDays(raw: string | undefined): 7 | 30 | 90 {
  if (raw === '7') return 7
  if (raw === '90') return 90
  return 30
}

function formatKstDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default async function OwnerHomePage({ searchParams }: Params) {
  const { registered, msg, days: daysRaw } = await searchParams
  const rangeDays = parseDays(daysRaw)
  const data = await loadOwnerDashboard(new Date(), { trendDays: rangeDays })

  const email = data.user.email ?? ''
  const userName = email.split('@')[0] || '사장님'
  const placesLinked = data.places.filter((p) => p.mentionCount > 0).length

  return (
    <div className="dash-page">
      {registered && msg && (
        <div className="dash-banner" role="status">
          <div className="ic">✓</div>
          <div>✅ {msg}</div>
        </div>
      )}

      <BillingBanner
        hasCard={data.billing.hasCard}
        pilotRemainingDays={data.billing.pilotRemainingDays}
      />

      {data.places.length === 0 ? (
        <EmptyState
          eyebrow="· · · 아직 아무것도 없어요 · · ·"
          title={<>첫 업체를 <em>등록</em>해 볼까요?</>}
          description="업체명을 검색하면 네이버·Google 에서 기본 정보가 자동으로 채워져요. 30초면 끝 · AI 최적화 프로필은 등록 직후 자동 생성됩니다."
          action={{ href: '/owner/places/new', label: '+ 업체 등록 시작 →' }}
        />
      ) : (
        <>
          <DashHero
            userName={userName}
            periodLabel={`${formatKstDate(new Date())} · 지난 ${rangeDays}일 요약`}
            botSummary={data.botSummary}
            averageAeoScore={data.averageAeoScore}
            placesCount={data.places.length}
            placesLinked={placesLinked}
            dailyTrend={data.dailyTrend}
            primaryCtaHref="/owner/places/new"
            secondaryCtaHref="/owner/citations"
          />

          <section className="dash-sec">
            <div>
              <div className="k">추이 · {rangeDays}일</div>
              <h2>인용과 크롤링 <span className="it">추이</span></h2>
            </div>
            <div className="actions">
              <Link href="/owner/citations">전체 보기 →</Link>
            </div>
          </section>

          <DashCharts
            rows={data.dailyTrend}
            searchTotal={data.botSummary.aiSearch.total}
            trainingTotal={data.botSummary.aiTraining.total}
            rangeDays={rangeDays}
          />

          <div className="kpi2">
            <DashAeoSummary places={data.places} averageScore={data.averageAeoScore} />
            <DashBizSummary places={data.places} />
          </div>

          <section className="dash-sec">
            <div>
              <div className="k">포트폴리오</div>
              <h2>등록된 <span className="it">업체</span> <small>{data.places.length}곳</small></h2>
            </div>
            <div className="actions">
              <Link href="/owner/places/new">+ 업체 추가</Link>
            </div>
          </section>

          <div className="biz-row">
            <DashPlaceList places={data.places} />
            <DashAeoChecklist places={data.places} />
          </div>

          <section className="dash-sec">
            <div>
              <div className="k">피드</div>
              <h2>AI 봇 방문 &amp; <span className="it">할 일</span></h2>
            </div>
          </section>

          <div className="biz-row">
            <DashBotCard visits={data.recentBotVisits} totalDays={rangeDays} />
            <DashTodoCard todos={data.todos} />
          </div>

          <div className="foot-meta">
            <span>{email} · 계정 ID #{data.user.id.slice(0, 8)}</span>
            <span>실시간 집계 · 최근 동기화 방금</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── 파일럿 배너 ──────────────────────────────────────────────
function BillingBanner({
  hasCard, pilotRemainingDays,
}: {
  hasCard: boolean
  pilotRemainingDays: number
}) {
  // 카드 등록 완료 & 파일럿 정상 진행 중.
  if (hasCard && pilotRemainingDays > 0) {
    return (
      <div className="dash-banner" role="status">
        <div className="ic">✓</div>
        <div>카드 등록 완료 · 체험판 잔여 <b>{pilotRemainingDays}일</b> · 종료 후 자동 결제 전환됩니다.</div>
        <div className="grow" />
        <Link href="/owner/billing">결제 관리 →</Link>
      </div>
    )
  }

  // 카드 없음 · 파일럿 진행 중 — 신뢰형 배너.
  if (!hasCard && pilotRemainingDays > 7) {
    return (
      <div className="dash-banner" role="status">
        <div className="ic">!</div>
        <div>체험판 잔여 <b>{pilotRemainingDays}일</b> · 카드 등록은 종료 <b>7일 전</b>까지 완료하세요.</div>
        <div className="grow" />
        <Link href="/owner/billing">요금제 관리 →</Link>
      </div>
    )
  }

  // 7일 이내 만료 경고.
  if (!hasCard && pilotRemainingDays > 0 && pilotRemainingDays <= 7) {
    return (
      <div className="dash-banner warn" role="alert">
        <div className="ic">!</div>
        <div>파일럿 종료 <b>{pilotRemainingDays}일</b> 남음 · 지금 카드 등록하면 AI 노출이 끊기지 않아요.</div>
        <div className="grow" />
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }

  // 만료됨.
  if (!hasCard && pilotRemainingDays < 0) {
    return (
      <div className="dash-banner danger" role="alert">
        <div className="ic">⚠</div>
        <div>파일럿이 종료됐어요. 카드 등록으로 구독을 재개할 수 있습니다.</div>
        <div className="grow" />
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }

  return null
}
