// /owner 홈 대시보드 hero — 검정 카드 + 인사말 + 3 stats with sparkline.
// Remix dashboard.html 의 section.hero 재현.

import type { OwnerBotSummary, OwnerDailyTrendRow } from '@/lib/owner/bot-stats'

interface Props {
  userName: string
  periodLabel: string           // ex. "2026-04-22 · 지난 30일 요약"
  botSummary: OwnerBotSummary
  averageAeoScore: number | null
  placesCount: number
  placesLinked: number          // 콘텐츠 연결 업체 수
  dailyTrend: OwnerDailyTrendRow[]
  /** 주요 CTA href — "+ 새 업체 추가" */
  primaryCtaHref: string
  /** 보조 CTA href — "월간 리포트 PDF" */
  secondaryCtaHref?: string
}

const SPARK_W = 84
const SPARK_H = 40

function sparkPath(values: number[]): { d: string; lastX: number; lastY: number } {
  const n = values.length
  if (n === 0) return { d: '', lastX: SPARK_W, lastY: SPARK_H - 4 }
  const max = Math.max(1, ...values)
  const stepX = n > 1 ? SPARK_W / (n - 1) : SPARK_W
  const pts = values.map((v, i) => {
    const x = i * stepX
    const y = SPARK_H - 4 - ((v / max) * (SPARK_H - 8))
    return { x, y }
  })
  const d = `M${pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}`
  const last = pts[pts.length - 1]
  return { d, lastX: last.x, lastY: last.y }
}

export function DashHero({
  userName, periodLabel, botSummary, averageAeoScore,
  placesCount, placesLinked, dailyTrend,
  primaryCtaHref, secondaryCtaHref,
}: Props) {
  // 최근 7일 sparkline — dailyTrend 의 마지막 7개.
  const recent7 = dailyTrend.slice(-7)
  const searchSeries = recent7.map((r) => r.aiSearch.chatgpt + r.aiSearch.claude + r.aiSearch.perplexity + r.aiSearch.other)
  const trainingSeries = recent7.map((r) => r.aiTraining.chatgpt + r.aiTraining.claude + r.aiTraining.gemini + r.aiTraining.other)
  const searchSpark = sparkPath(searchSeries)
  const trainingSpark = sparkPath(trainingSeries)

  const search30 = botSummary.aiSearch.total
  const training30 = botSummary.aiTraining.total
  const aeoDisplay = averageAeoScore ?? 0
  const aeoDash = aeoDisplay / 100 * 113.1  // radius 18 → C=113.1

  // Hero lede 문구 — 실측만, 허수 없음.
  let lede: React.ReactNode
  if (placesCount === 0) {
    lede = <>업체를 등록하면 AI Place 는 24시간 안에 JSON-LD·FAQ·카테고리 매핑을 자동 생성합니다.</>
  } else {
    const gptBot = botSummary.aiTraining.byEngine.chatgpt ?? 0
    const claudeCount = (botSummary.aiSearch.byEngine.claude ?? 0) + (botSummary.aiTraining.byEngine.claude ?? 0)
    const gemini = botSummary.aiTraining.byEngine.gemini ?? 0
    const perplex = botSummary.aiSearch.byEngine.perplexity ?? 0
    const zeros: string[] = []
    if (claudeCount === 0) zeros.push('Claude')
    if (perplex === 0) zeros.push('Perplexity')
    if (gemini === 0) zeros.push('Gemini')
    lede = (
      <>
        등록된 <b>{placesCount}곳</b> 중 <b>{placesLinked}곳</b>이 AI 콘텐츠에 연결됐고, GPTBot 이 총 <b>{gptBot}회</b> 학습 크롤링을 수행했습니다.
        {zeros.length > 0 && <> <span className="zero">{zeros.join('·')}는 아직 기록 없음.</span></>}
      </>
    )
  }

  const headline = search30 > 0
    ? <>이번 달, AI가 당신의<br />업체를 <span style={{ color: 'var(--accent-2)' }}>{search30}회</span> 인용했습니다.</>
    : <>이번 달, AI 인용을<br /><span style={{ color: 'var(--accent-2)' }}>측정</span>하고 있어요.</>

  return (
    <section className="hero">
      <div>
        <p className="kicker">{periodLabel}</p>
        <h1>
          안녕하세요, <span className="serif">{userName}</span>님.<br />
          {headline}
        </h1>
        <p className="lede">{lede}</p>
        <div className="cta-row">
          <a className="btn accent" href={primaryCtaHref}>+ 새 업체 추가</a>
          {secondaryCtaHref && (
            <a className="btn ghost" href={secondaryCtaHref}>월간 리포트 ↓</a>
          )}
        </div>
      </div>

      <div className="divide" />

      <div className="stats">
        <HeroStat
          color="#10a37f"
          label="AI 답변 실시간 인용"
          value={search30}
          unit="회"
          sub={<>직접 답변 <b>{botSummary.aiSearch.direct}</b> · 본문 언급 <b>{botSummary.aiSearch.mention}</b></>}
        >
          <SparkSvg d={searchSpark.d} color="#10a37f" lastX={searchSpark.lastX} lastY={searchSpark.lastY} hasData={search30 > 0} />
        </HeroStat>

        <HeroStat
          color="var(--warn)"
          label="AI 학습 크롤링"
          value={training30}
          unit="회"
          sub={<>
            GPTBot <b>{botSummary.aiTraining.byEngine.chatgpt ?? 0}</b>
            {' · '}ClaudeBot <b>{botSummary.aiTraining.byEngine.claude ?? 0}</b>
            {' · '}Gemini <b>{botSummary.aiTraining.byEngine.gemini ?? 0}</b>
          </>}
        >
          <SparkSvg d={trainingSpark.d} color="#b45309" lastX={trainingSpark.lastX} lastY={trainingSpark.lastY} hasData={training30 > 0} />
        </HeroStat>

        <HeroStat
          color="var(--accent)"
          label={`AEO 점수 (${placesCount}곳 평균)`}
          value={averageAeoScore ?? 0}
          unit="/ 100"
          sub={averageAeoScore === null ? '업체 등록 후 즉시 평가' : '목표 90+'}
        >
          <svg width={44} height={44} viewBox="0 0 44 44" style={{ flex: '0 0 44px' }}>
            <circle cx={22} cy={22} r={18} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth={4} />
            <circle
              cx={22} cy={22} r={18} fill="none"
              stroke="#ff7a50" strokeWidth={4} strokeLinecap="round"
              strokeDasharray={`${aeoDash} 113.1`}
              transform="rotate(-90 22 22)"
            />
          </svg>
        </HeroStat>
      </div>
    </section>
  )
}

function HeroStat({
  color, label, value, unit, sub, children,
}: {
  color: string
  label: string
  value: number
  unit: string
  sub: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="stat">
      <div>
        <div className="lbl"><i style={{ background: color }} /> {label}</div>
        <div className="v">{value.toLocaleString()}<span className="u">{unit}</span></div>
        <div className="sub">{sub}</div>
      </div>
      {children}
    </div>
  )
}

function SparkSvg({
  d, color, lastX, lastY, hasData,
}: {
  d: string
  color: string
  lastX: number
  lastY: number
  hasData: boolean
}) {
  if (!hasData || !d) {
    return (
      <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} fill="none" preserveAspectRatio="none">
        <line x1={0} y1={SPARK_H - 4} x2={SPARK_W} y2={SPARK_H - 4} stroke={color} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="3 4" />
      </svg>
    )
  }
  return (
    <svg className="spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} fill="none" preserveAspectRatio="none">
      <path d={d} stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  )
}
