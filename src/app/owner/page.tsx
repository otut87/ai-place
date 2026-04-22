// Sprint D-1 / T-200 — 오너 대시보드 홈.
// KPI 3 카드 + 내 업체 카드 + 할 일 + 파일럿/결제 배너 + 빈 상태 3종.

import Link from 'next/link'
import type { Metadata } from 'next'
import { loadOwnerDashboard, type OwnerDashboardData } from '@/lib/owner/dashboard-data'
import { MEASUREMENT_WINDOW_DAYS } from '@/lib/owner/measurement-window'
import type { OwnerBotBucket } from '@/lib/owner/bot-stats'
import { composePageTitle } from '@/lib/seo/compose-title'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('내 대시보드'),
  description: '내 업체의 AI 인용·AEO·할 일을 한눈에 확인하세요.',
  robots: { index: false, follow: false },
}

interface Params {
  searchParams: Promise<{ registered?: string; msg?: string }>
}

export default async function OwnerDashboardPage({ searchParams }: Params) {
  const { registered, msg } = await searchParams
  const data = await loadOwnerDashboard()

  return (
    <>
      {registered && msg && (
        <div className="owner-banner ok">✅ {msg}</div>
      )}

      <PilotBanner billing={data.billing} />

      <Greeting data={data} />

      {data.places.length === 0 ? (
        <EmptyStateNoPlace />
      ) : (
        <>
          <section className="owner-kpis">
            <KpiAiCitation botSummary={data.botSummary} measuring={data.window.isMeasuring} windowLabel={data.window.label} />
            <KpiAeoScore places={data.places} averageScore={data.averageAeoScore} />
            <KpiPlaces places={data.places} />
          </section>

          <section className="owner-two-col">
            <div className="owner-card">
              <h2>내 업체</h2>
              <PlaceCardList places={data.places} />
            </div>
            <div className="owner-card">
              <h2>할 일</h2>
              <TodoList todos={data.todos} />
            </div>
          </section>
        </>
      )}
    </>
  )
}

// ── Pilot / Billing Banner ────────────────────────────────────────
function PilotBanner({ billing }: { billing: OwnerDashboardData['billing'] }) {
  const { hasCard, pilotRemainingDays } = billing

  if (hasCard) {
    // 카드 등록 완료 + 파일럿 중 → OK 배너
    if (pilotRemainingDays > 0 && pilotRemainingDays <= 30) {
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
    return null
  }

  // 카드 미등록
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
        <span>파일럿 종료 {pilotRemainingDays}일 남음 · 지금 카드를 등록하면 AI 노출이 끊기지 않아요.</span>
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

// ── Greeting ─────────────────────────────────────────────────────
function Greeting({ data }: { data: OwnerDashboardData }) {
  const email = data.user.email ?? ''
  const name = email ? email.split('@')[0] : '사장님'

  const total = data.botSummary.aiSearch.total + data.botSummary.aiTraining.total

  return (
    <header className="owner-greeting">
      <h1>{name}님, 반갑습니다</h1>
      <p className="sub">
        {data.places.length === 0
          ? '업체를 1곳 이상 등록하면 AI 노출 측정이 시작됩니다.'
          : data.window.isMeasuring
            ? `AI 봇이 새 URL 을 발견하기까지 평균 3~10일이 걸립니다 · ${data.window.label}`
            : `지난 30일 내 업체 관련 AI 봇 방문 ${total.toLocaleString()}건.`}
      </p>
    </header>
  )
}

// ── KPI 1: AI 인용 ────────────────────────────────────────────────
function KpiAiCitation({
  botSummary, measuring, windowLabel,
}: {
  botSummary: OwnerDashboardData['botSummary']
  measuring: boolean
  windowLabel: string
}) {
  if (measuring) {
    return (
      <article className="kpi-card measuring">
        <span className="label">🟢 AI 답변 · 실시간 인용</span>
        <div className="big">측정 중 · {windowLabel}</div>
        <div className="sub">AI 봇 방문까지 평균 3~7일</div>
        <div className="divider" />
        <span className="label">🟡 AI 학습 크롤링</span>
        <div className="big">측정 중 · {windowLabel}</div>
        <div className="info-note">ⓘ 업체 등록 후 {MEASUREMENT_WINDOW_DAYS}일이 지나면 지표가 공개됩니다.</div>
      </article>
    )
  }

  return (
    <article className="kpi-card">
      <span className="label">🟢 AI 답변 · 실시간 인용 (30일)</span>
      <EngineBucket bucket={botSummary.aiSearch} engineKeys={['chatgpt', 'claude', 'perplexity', 'other']} engineLabels={{ chatgpt: 'GPT', claude: 'Claude', perplexity: 'Perp.', other: '기타' }} />
      <div className="divider" />
      <span className="label">🟡 AI 학습 크롤링 (Gemini 포함)</span>
      <EngineBucket bucket={botSummary.aiTraining} engineKeys={['chatgpt', 'claude', 'gemini', 'other']} engineLabels={{ chatgpt: 'GPTBot', claude: 'ClaudeBot', gemini: 'Gemini', other: '기타' }} />
      <div className="info-note">ⓘ Gemini 실시간 인용은 전용 UA 가 없어 직접 측정 불가입니다.</div>
    </article>
  )
}

function EngineBucket({
  bucket, engineKeys, engineLabels,
}: {
  bucket: OwnerBotBucket
  engineKeys: string[]
  engineLabels: Record<string, string>
}) {
  return (
    <>
      <div className="big">{bucket.total.toLocaleString()}<span className="unit">회</span></div>
      <div className="break">
        <div className="row"><span>🟢 직접 방문</span><span className="v">{bucket.direct.toLocaleString()}회</span></div>
        <div className="row"><span>🟡 본문 언급</span><span className="v">{bucket.mention.toLocaleString()}회</span></div>
      </div>
      <div className="sub">
        {engineKeys
          .map((k) => `${engineLabels[k]} ${(bucket.byEngine[k] ?? 0).toLocaleString()}`)
          .join(' · ')}
      </div>
    </>
  )
}

// ── KPI 2: AEO 점수 ──────────────────────────────────────────────
function KpiAeoScore({
  places, averageScore,
}: {
  places: OwnerDashboardData['places']
  averageScore: number | null
}) {
  if (averageScore === null || places.length === 0) {
    return (
      <article className="kpi-card">
        <span className="label">AEO 점수</span>
        <div className="big">—</div>
        <div className="sub">업체 등록 후 즉시 평가됩니다.</div>
      </article>
    )
  }

  // 가장 낮은 점수 업체에서 개선할 항목 1개 추출.
  const weakest = places.slice().sort((a, b) => a.aeoScore - b.aeoScore)[0]
  const nextTip = weakest.aeoDeficiencies[0]

  const grade = averageScore >= 85 ? 'A' : averageScore >= 75 ? 'B' : averageScore >= 60 ? 'C' : 'D'

  return (
    <article className="kpi-card">
      <span className="label">AEO 점수 (평균)</span>
      <div className="big">
        {averageScore}
        <span className="unit">/100</span>
        <span style={{ marginLeft: 10, verticalAlign: 'middle' }}>
          <span className={`grade-pill grade-${grade}`}>{grade}등급</span>
        </span>
      </div>
      <div className="sub">
        {places.length}곳 평균 · 최저 {weakest.name} {weakest.aeoScore}점
      </div>
      {nextTip && <div className="info-note">다음: {weakest.name} — {nextTip}</div>}
    </article>
  )
}

// ── KPI 3: 내 업체 ──────────────────────────────────────────────
function KpiPlaces({ places }: { places: OwnerDashboardData['places'] }) {
  const active = places.filter((p) => p.status === 'active').length
  const pending = places.filter((p) => p.status === 'pending').length
  const avg = places.length === 0 ? 0 : Math.round(places.reduce((s, p) => s + p.aeoScore, 0) / places.length)
  return (
    <article className="kpi-card">
      <span className="label">내 업체</span>
      <div className="big">{places.length}<span className="unit">곳</span></div>
      <div className="sub">공개 {active}곳 · 검토 {pending}곳 · 평균 AEO {avg}점</div>
      <Link href="/owner/places/new" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>+ 새 업체 추가 →</Link>
    </article>
  )
}

// ── 업체 카드 리스트 ─────────────────────────────────────────────
function PlaceCardList({ places }: { places: OwnerDashboardData['places'] }) {
  return (
    <div className="place-card-list">
      {places.map((p) => (
        <article key={p.id} className="place-card">
          <div>
            <div className="name">
              <span className="nm">{p.name}</span>
              <span className={`status-pill ${p.status}`}>
                {p.status === 'active' ? '공개' : p.status === 'pending' ? '검토 중' : p.status}
              </span>
            </div>
            <div className="meta">
              /{p.city}/{p.category}/{p.slug} · AEO {p.aeoScore}점 · {p.aeoGrade}등급 · 언급 {p.mentionCount}회
            </div>
            {p.aeoDeficiencies.length > 0 && (
              <div className="badges">
                {p.aeoDeficiencies.slice(0, 3).map((d) => (
                  <span key={d} className="badge warn">{d}</span>
                ))}
                {p.aeoDeficiencies.length > 3 && (
                  <span className="badge">+{p.aeoDeficiencies.length - 3}</span>
                )}
              </div>
            )}
          </div>
          <div className="actions">
            <Link href={`/owner/places/${p.id}`}>편집</Link>
            {p.status === 'active' && (
              <Link href={`/${p.city}/${p.category}/${p.slug}`} target="_blank" rel="noopener">
                공개 페이지 ↗
              </Link>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

// ── 할 일 ────────────────────────────────────────────────────────
function TodoList({ todos }: { todos: OwnerDashboardData['todos'] }) {
  if (todos.length === 0) {
    return (
      <div className="todo-empty">
        🎉 할 일이 모두 끝났어요. AI 노출 데이터가 쌓이는 동안 다른 업체를 추가해보세요.
      </div>
    )
  }

  return (
    <ul className="todo-list" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {todos.slice(0, 8).map((t, idx) => (
        <li key={`${t.id}-${idx}`} className="todo-item">
          <span className={`prio ${t.priority}`}>{t.priority}</span>
          <div className="body">
            <span className="title">{t.title}</span>
            <span className="desc">{t.description}</span>
          </div>
          {t.actionHref && (
            <span className="act"><Link href={t.actionHref}>이동 →</Link></span>
          )}
        </li>
      ))}
    </ul>
  )
}

// ── 빈 상태: 업체 0건 ─────────────────────────────────────────────
function EmptyStateNoPlace() {
  return (
    <div className="owner-empty-state">
      <h3>아직 등록된 업체가 없습니다</h3>
      <p>업체명을 검색하면 기본 정보가 자동으로 채워져요 — 30초면 끝.</p>
      <Link href="/owner/places/new" className="btn">+ 첫 업체 등록하기</Link>
    </div>
  )
}
