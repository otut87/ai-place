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
import { PilotEndingBanner } from './_components/pilot-ending-banner'

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
  // T-226: 파일럿 D-3 예고 배너용 활성 업체 수 (14,900원 × N 계산).
  const activePlaceCount = data.places.length

  return (
    <div className="dash-page">
      {registered && msg && (
        <div className="dash-banner" role="status">
          <div className="ic">✓</div>
          <div>✅ {msg}</div>
        </div>
      )}

      {/* T-226: 파일럿 종료 D-3 이하 + 카드 있으면 첫 청구 예고. 그 외엔 기존 BillingBanner 가 담당.
          T-266: 관리자 계정은 결제 게이트 자체가 의미 없음 (loadBillingState 가 hasCard=true,
          pilotRemainingDays=9999 강제) — banner 도 노출하지 않음. */}
      {data.isAdmin ? null : data.billing.hasCard && data.billing.pilotRemainingDays <= 3 && data.billing.pilotRemainingDays >= 0 ? (
        <PilotEndingBanner
          pilotRemainingDays={data.billing.pilotRemainingDays}
          trialEndsAt={data.billing.pilotEndsAt}
          activePlaceCount={activePlaceCount}
        />
      ) : (
        <BillingBanner
          hasCard={data.billing.hasCard}
          pilotRemainingDays={data.billing.pilotRemainingDays}
          activePlaceCount={activePlaceCount}
        />
      )}

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

// ── 파일럿 + 카드 등록 배너 ──────────────────────────────────────────────
// T-259 R6: register-first 흐름 — 카드 없어도 업체 등록은 가능하지만 발행/AI 리포트는 잠김.
//   activePlaceCount > 0 이면 "발행/리포트 잠김" 안내를 우선 노출.
function BillingBanner({
  hasCard, pilotRemainingDays, activePlaceCount,
}: {
  hasCard: boolean
  pilotRemainingDays: number
  activePlaceCount: number
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

  // T-259 R6: 카드 없음 + 등록한 업체 있음 → 발행/리포트 잠금 명시.
  if (!hasCard && activePlaceCount > 0 && pilotRemainingDays > 7) {
    return (
      <div className="dash-banner warn" role="alert">
        <div className="ic">🔒</div>
        <div>
          카드를 등록해야 블로그 자동 발행과 AI 인용 리포트가 시작됩니다.
          체험판 잔여 <b>{pilotRemainingDays}일</b> · 종료까지 카드 미등록 시 등록한 업체가 비공개로 전환됩니다.
        </div>
        <div className="grow" />
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }

  if (!hasCard && activePlaceCount > 0 && pilotRemainingDays > 0 && pilotRemainingDays <= 7) {
    return (
      <div className="dash-banner warn" role="alert">
        <div className="ic">⚠</div>
        <div>
          체험판 종료 <b>{pilotRemainingDays}일</b> 남음 · 카드 미등록 상태로 종료되면 등록한
          {activePlaceCount > 1 ? <> 업체 {activePlaceCount}개가 </> : <> 업체가 </>}
          비공개로 전환됩니다. 카드 등록 즉시 발행·리포트가 활성화됩니다.
        </div>
        <div className="grow" />
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }

  // 카드 없음 + 업체 0곳 — 등록 권유 (기존 EmptyState 와 별도 라인 유지).
  if (!hasCard && activePlaceCount === 0 && pilotRemainingDays > 7) {
    return (
      <div className="dash-banner" role="status">
        <div className="ic">!</div>
        <div>체험판 잔여 <b>{pilotRemainingDays}일</b> · 업체 등록 후 카드를 등록하면 발행·리포트가 활성화됩니다.</div>
        <div className="grow" />
        <Link href="/owner/places/new">업체 등록 →</Link>
      </div>
    )
  }

  // 만료됨.
  if (!hasCard && pilotRemainingDays < 0) {
    return (
      <div className="dash-banner danger" role="alert">
        <div className="ic">⚠</div>
        <div>
          파일럿이 종료됐어요. 카드 미등록 상태이므로 등록한 업체는 비공개 상태입니다.
          카드 등록 즉시 공개·발행·리포트가 다시 시작됩니다.
        </div>
        <div className="grow" />
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }

  return null
}
