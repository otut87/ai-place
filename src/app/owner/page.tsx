// T-201 — 오너 대시보드 홈 (docs/AIPLACE/dashboard.html 디자인).
// loadOwnerDashboard 의 실측 데이터를 그대로 활용.
// 허수 금지: 실측 불가 지표는 노출하지 않는다.

import Link from 'next/link'
import type { Metadata } from 'next'
import { loadOwnerDashboard, type OwnerDashboardData } from '@/lib/owner/dashboard-data'
import { MEASUREMENT_WINDOW_DAYS } from '@/lib/owner/measurement-window'
import type { OwnerBotBucket } from '@/lib/owner/bot-stats'
import { composePageTitle } from '@/lib/seo/compose-title'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('오너 대시보드'),
  description: '내 업체의 AI 인용 · AEO 점수 · 할 일을 한눈에 확인하세요.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{ registered?: string; msg?: string }>
}

export default async function OwnerHomePage({ searchParams }: Params) {
  const { registered, msg } = await searchParams
  const data = await loadOwnerDashboard()

  return (
    <>
      {registered && msg && (
        <div className="owner-banner ok" role="status">
          <span>✅ {msg}</span>
        </div>
      )}

      <PilotBanner billing={data.billing} />
      <Greeting data={data} />

      {data.places.length === 0 ? (
        <EmptyStateNoPlace />
      ) : (
        <>
          <section className="kpi-grid">
            <KpiAiCitation
              botSummary={data.botSummary}
              measuring={data.window.isMeasuring}
              windowLabel={data.window.label}
            />
            <KpiAeoScore places={data.places} averageScore={data.averageAeoScore} />
            <KpiPlaces places={data.places} />
          </section>

          <section className="row">
            <PlaceListPanel places={data.places} />
            <TodoPanel todos={data.todos} />
          </section>
        </>
      )}
    </>
  )
}

// ── Pilot / Billing Banner ────────────────────────────────────────
function PilotBanner({ billing }: { billing: OwnerDashboardData['billing'] }) {
  const { hasCard, pilotRemainingDays } = billing

  if (hasCard && pilotRemainingDays > 0 && pilotRemainingDays <= 30) {
    const used = 30 - pilotRemainingDays
    const pct = Math.max(0, Math.min(100, (used / 30) * 100))
    return (
      <div className="owner-banner ok" role="status">
        <span>파일럿 D+{used}/30 · 잔 {pilotRemainingDays}일</span>
        <div className="progress"><div className="bar" style={{ width: `${pct}%` }} /></div>
        <Link href="/owner/billing">결제 관리</Link>
      </div>
    )
  }

  if (hasCard) return null

  if (pilotRemainingDays < 0) {
    return (
      <div className="owner-banner danger" role="alert">
        <span>⚠️ 파일럿이 종료됐어요. 카드 등록으로 구독을 재개할 수 있습니다.</span>
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }
  if (pilotRemainingDays <= 7) {
    return (
      <div className="owner-banner warn" role="alert">
        <span>파일럿 종료 {pilotRemainingDays}일 남음 · 지금 카드 등록하면 AI 노출이 끊기지 않아요.</span>
        <Link href="/owner/billing">카드 등록 →</Link>
      </div>
    )
  }
  return (
    <div className="owner-banner ok" role="status">
      <span>파일럿 잔 {pilotRemainingDays}일 · 카드 등록은 종료 7일 전까지 완료하면 돼요.</span>
      <Link href="/owner/billing">결제 관리</Link>
    </div>
  )
}

// ── Greeting (dashboard.html 의 .greeting) ────────────────────────
function Greeting({ data }: { data: OwnerDashboardData }) {
  const email = data.user.email ?? ''
  const name = email ? email.split('@')[0] : '사장님'
  const totalCitations = data.botSummary.aiSearch.total
  const totalTraining = data.botSummary.aiTraining.total

  let subText: string
  if (data.places.length === 0) {
    subText = '업체를 1곳 이상 등록하면 AI 노출 측정이 시작됩니다.'
  } else if (data.window.isMeasuring) {
    subText = `AI 봇이 새 URL 을 발견하기까지 평균 3~10일 · ${data.window.label}`
  } else {
    subText = `지난 30일 · AI 답변 ${totalCitations}회 인용 · 학습 크롤링 ${totalTraining}회.`
  }

  return (
    <header className="greeting">
      <div>
        <h1>
          안녕하세요, <span className="it">{name}</span>님
        </h1>
        <p>{subText}</p>
      </div>
      {data.places.length > 0 && (
        <Link className="btn ghost sm" href="/owner/places/new">
          + 새 업체 추가
        </Link>
      )}
    </header>
  )
}

// ── KPI 1: AI 인용 (실시간 + 학습 2단) ──────────────────────────
function KpiAiCitation({
  botSummary, measuring, windowLabel,
}: {
  botSummary: OwnerDashboardData['botSummary']
  measuring: boolean
  windowLabel: string
}) {
  if (measuring) {
    return (
      <article className="kpi">
        <span className="k">🟢 AI 답변 · 실시간 인용</span>
        <div className="measuring-v">측정 중 · {windowLabel}</div>
        <span className="sub">AI 봇 방문까지 평균 3~7일</span>
        <div className="rule-sm" />
        <span className="k">🟡 AI 학습 크롤링</span>
        <div className="measuring-v">측정 중 · {windowLabel}</div>
        <div className="info-note">
          업체 등록 후 {MEASUREMENT_WINDOW_DAYS}일이 지나면 실수치가 공개됩니다.
        </div>
      </article>
    )
  }

  return (
    <article className="kpi">
      <span className="k">🟢 AI 답변 · 실시간 인용 (30일)</span>
      <div className="v">
        {botSummary.aiSearch.total.toLocaleString()}
        <span className="u">회</span>
      </div>
      <AttributionBreak bucket={botSummary.aiSearch} />
      <div className="sub">
        GPT {botSummary.aiSearch.byEngine.chatgpt ?? 0} · Claude {botSummary.aiSearch.byEngine.claude ?? 0}
        {' '}· Perp. {botSummary.aiSearch.byEngine.perplexity ?? 0} · 기타 {botSummary.aiSearch.byEngine.other ?? 0}
      </div>

      <div className="rule-sm" />

      <span className="k">🟡 AI 학습 크롤링 (Gemini 포함)</span>
      <div className="v">
        {botSummary.aiTraining.total.toLocaleString()}
        <span className="u">회</span>
      </div>
      <div className="sub">
        GPTBot {botSummary.aiTraining.byEngine.chatgpt ?? 0}
        {' '}· ClaudeBot {botSummary.aiTraining.byEngine.claude ?? 0}
        {' '}· Gemini {botSummary.aiTraining.byEngine.gemini ?? 0}
        {' '}· 기타 {botSummary.aiTraining.byEngine.other ?? 0}
      </div>

      <div className="info-note">
        ⓘ Gemini 실시간 인용은 전용 UA 가 없어 직접 측정 불가입니다.
      </div>
    </article>
  )
}

function AttributionBreak({ bucket }: { bucket: OwnerBotBucket }) {
  return (
    <div className="attr">
      <div className="row"><span>🟢 직접 방문</span><span className="v">{bucket.direct.toLocaleString()}회</span></div>
      <div className="row"><span>🟡 본문 언급</span><span className="v">{bucket.mention.toLocaleString()}회</span></div>
    </div>
  )
}

// ── KPI 2: AEO 점수 ─────────────────────────────────────────────
function KpiAeoScore({
  places, averageScore,
}: {
  places: OwnerDashboardData['places']
  averageScore: number | null
}) {
  if (averageScore === null || places.length === 0) {
    return (
      <article className="kpi">
        <span className="k">AEO 점수</span>
        <div className="v">—</div>
        <span className="sub">업체 등록 후 즉시 평가됩니다.</span>
      </article>
    )
  }

  const grade = averageScore >= 85 ? 'A' : averageScore >= 75 ? 'B' : averageScore >= 60 ? 'C' : 'D'
  const weakest = places.slice().sort((a, b) => a.aeoScore - b.aeoScore)[0]
  const nextTip = weakest?.aeoDeficiencies[0]

  return (
    <article className="kpi">
      <span className="k">AEO 점수 (평균)</span>
      <div className="v">
        {averageScore}
        <span className="u">/100</span>
      </div>
      <div className="label-small">
        <span className={`grade-pill ${grade}`}>{grade}등급</span>
        {' '}· {places.length}곳 평균
      </div>
      {weakest && (
        <div className="sub">
          최저 <b style={{ color: 'var(--ink)' }}>{weakest.name}</b> {weakest.aeoScore}점
        </div>
      )}
      {nextTip && <div className="info-note">다음: {nextTip}</div>}
    </article>
  )
}

// ── KPI 3: 내 업체 ───────────────────────────────────────────────
function KpiPlaces({ places }: { places: OwnerDashboardData['places'] }) {
  const active = places.filter((p) => p.status === 'active').length
  const pending = places.filter((p) => p.status === 'pending').length
  const totalMentions = places.reduce((s, p) => s + p.mentionCount, 0)
  return (
    <article className="kpi">
      <span className="k">내 업체</span>
      <div className="v">
        {places.length}
        <span className="u">곳</span>
      </div>
      <div className="sub">
        공개 {active}곳 · 검토 {pending}곳
      </div>
      <div className="label-small">
        총 콘텐츠 언급 <b style={{ color: 'var(--ink)' }}>{totalMentions}</b>회
      </div>
      <Link href="/owner/places/new" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--mono)' }}>
        + 새 업체 추가 →
      </Link>
    </article>
  )
}

// ── 내 업체 패널 ─────────────────────────────────────────────────
function PlaceListPanel({ places }: { places: OwnerDashboardData['places'] }) {
  return (
    <div className="dash-panel">
      <div className="head">
        <h3>내 업체</h3>
        <Link className="more" href="/owner/places/new">+ 업체 추가</Link>
      </div>
      <div className="place-list">
        {places.map((p) => (
          <article key={p.id} className="place-row">
            <div>
              <div className="name">
                <b>{p.name}</b>
                <span className={`place-status ${p.status}`}>
                  {p.status === 'active' ? '공개' : p.status === 'pending' ? '검토 중' : p.status}
                </span>
                <span className={`grade-pill ${p.aeoGrade}`}>{p.aeoGrade} · {p.aeoScore}</span>
              </div>
              <div className="meta">
                /{p.city}/{p.category}/{p.slug}
                {' · '}언급 {p.mentionCount}회
              </div>
              {p.aeoDeficiencies.length > 0 && (
                <div className="badges">
                  {p.aeoDeficiencies.slice(0, 3).map((d) => (
                    <span key={d} className="deficiency-chip">{d}</span>
                  ))}
                  {p.aeoDeficiencies.length > 3 && (
                    <span className="deficiency-chip">+{p.aeoDeficiencies.length - 3}</span>
                  )}
                </div>
              )}
            </div>
            <div className="actions">
              <Link href={`/owner/places/${p.id}`}>편집</Link>
              {p.status === 'active' && (
                <Link
                  className="ghost"
                  href={`/${p.city}/${p.category}/${p.slug}`}
                  target="_blank"
                  rel="noopener"
                >
                  공개 ↗
                </Link>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

// ── 할 일 패널 ───────────────────────────────────────────────────
function TodoPanel({ todos }: { todos: OwnerDashboardData['todos'] }) {
  return (
    <div className="dash-panel">
      <div className="head">
        <h3>할 일 · {todos.length}건</h3>
        {todos.length > 0 && <span className="chip accent">우선순위 자동 정렬</span>}
      </div>
      {todos.length === 0 ? (
        <div className="task-empty">
          🎉 할 일이 모두 끝났어요.<br />AI 노출 데이터가 쌓이는 동안 다른 업체를 추가해 보세요.
        </div>
      ) : (
        <div>
          {todos.slice(0, 6).map((t, idx) => (
            <div key={`${t.id}-${idx}`} className="task">
              <div className="body">
                <b>{t.title}</b>
                <span>{t.description}</span>
                {t.actionHref && <Link href={t.actionHref}>이동 →</Link>}
              </div>
              <span className={`pri ${t.priority}`}>{t.priority}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 빈 상태: 업체 0 ───────────────────────────────────────────────
function EmptyStateNoPlace() {
  return (
    <div className="owner-empty-state">
      <span className="i">· · · 아직 아무것도 없어요 · · ·</span>
      <h3>
        첫 업체를 <span className="it">등록</span>해 볼까요?
      </h3>
      <p>
        업체명을 검색하면 네이버·Google 에서 기본 정보가 자동으로 채워져요.
        30초면 끝 · AI 최적화 프로필은 등록 직후 자동 생성됩니다.
      </p>
      <Link className="btn accent lg" href="/owner/places/new">
        + 업체 등록 시작 →
      </Link>
    </div>
  )
}
