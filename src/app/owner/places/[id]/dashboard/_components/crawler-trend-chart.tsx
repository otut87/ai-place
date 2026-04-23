// T-219 — 업체 대시보드용 AI 크롤러 접근 추이 차트 (SVG, 서버 렌더).
// aiSearch + aiTraining 엔진별 일일 카운트를 3개 area 로 누적 표시.
// 엔진 그룹(ChatGPT = GPTBot + ChatGPT-User + OAI-SearchBot,
//          Claude  = ClaudeBot + Anthropic-AI + Claude-Web,
//          Gemini  = Google-Extended).

import { dailyRowToChartCounts, type OwnerDailyTrendRow } from '@/lib/owner/bot-stats'

interface Props {
  rows: OwnerDailyTrendRow[]
  totals: { chatgpt: number; claude: number; gemini: number; other: number }
  periodLabel: string // "지난 30일" 등
  compareLabel?: string // "전월 32회 · ▲ +15회 (+47%)" 형태
}

// Chart viewBox 기준값 — CSS 에서 height 260px, 가로는 preserve 없이 100% stretch.
const VB_W = 720
const VB_H = 240
const PAD_L = 34   // Y축 라벨 영역
const PAD_R = 8
const PAD_T = 16
const PAD_B = 28

const SERIES = [
  { key: 'gemini', color: '#4285f4', fill: 'pdTG3', label: 'Google-Extended' },
  { key: 'claude', color: '#cc785c', fill: 'pdTG2', label: 'ClaudeBot' },
  { key: 'chatgpt', color: '#10a37f', fill: 'pdTG1', label: 'GPTBot' },
] as const

export function CrawlerTrendChart({ rows, totals, periodLabel, compareLabel }: Props) {
  const totalHits = totals.chatgpt + totals.claude + totals.gemini + totals.other

  if (rows.length === 0 || totalHits === 0) {
    return (
      <>
        <div className="cc-top">
          <div className="cc-stat">
            <div>
              <div className="chead" style={{ margin: 0 }}>
                <div>
                  <div className="k">{periodLabel} · 서버 로그 기반</div>
                  <h3>AI 크롤러 접근 추이</h3>
                </div>
              </div>
              <div className="big" style={{ marginTop: 6 }}>0<span className="u">회</span></div>
              <div className="peer">아직 AI 크롤러 방문 기록이 없습니다</div>
            </div>
          </div>
        </div>
        <div className="cc-empty">
          <div>
            <b>아직 AI 크롤러가 방문하지 않았습니다</b><br />
            IndexNow 제출 후 1–3일 경과 후 다시 확인해 주세요
          </div>
        </div>
      </>
    )
  }

  // 엔진별 일일 카운트 사전 계산 (aiSearch + aiTraining).
  const dailyCounts = rows.map((r) => dailyRowToChartCounts(r))

  // Y축 최대값: 차트 3개 라인(chatgpt/claude/gemini) 의 일자별 누적 합 최대치.
  let yMax = 0
  for (const c of dailyCounts) {
    const sum = c.chatgpt + c.claude + c.gemini
    if (sum > yMax) yMax = sum
  }
  yMax = Math.max(4, Math.ceil(yMax * 1.15)) // 상단 여백

  const plotW = VB_W - PAD_L - PAD_R
  const plotH = VB_H - PAD_T - PAD_B

  const n = rows.length
  const xOf = (i: number) => PAD_L + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const yOf = (v: number) => PAD_T + plotH - (plotH * Math.min(v, yMax)) / yMax

  // 각 시리즈의 line + area path 생성
  const paths = SERIES.map((s) => {
    const linePts = dailyCounts.map((c, i) => `${xOf(i).toFixed(1)},${yOf(c[s.key]).toFixed(1)}`).join(' ')
    const areaPts = `${linePts} L${xOf(n - 1).toFixed(1)},${(PAD_T + plotH).toFixed(1)} L${xOf(0).toFixed(1)},${(PAD_T + plotH).toFixed(1)} Z`
    return { ...s, linePts, areaPts }
  })

  // X축 라벨 — 처음/중간/끝 3개
  const xTicks: Array<{ x: number; label: string }> = []
  if (n >= 2) {
    const picks = [0, Math.floor(n / 2), n - 1]
    for (const i of picks) {
      const md = rows[i].date.slice(5).replace('-', '/')
      xTicks.push({ x: xOf(i), label: md })
    }
  }

  // Y축 4-tick
  const yTicks = [
    { v: yMax, y: yOf(yMax) },
    { v: Math.round(yMax * 0.75), y: yOf(yMax * 0.75) },
    { v: Math.round(yMax * 0.5), y: yOf(yMax * 0.5) },
    { v: 0, y: yOf(0) },
  ]

  return (
    <>
      <div className="cc-top">
        <div className="cc-stat">
          <div>
            <div className="chead" style={{ margin: 0 }}>
              <div>
                <div className="k">{periodLabel} · 서버 로그 기반</div>
                <h3>AI 크롤러 접근 추이</h3>
              </div>
            </div>
            <div className="big" style={{ marginTop: 6 }}>{totalHits}<span className="u">회</span></div>
            {compareLabel && <div className="peer">{compareLabel}</div>}
          </div>
        </div>
      </div>

      <div className="cc-legend">
        <span className="lg"><span className="dd" style={{ background: '#10a37f' }}></span>GPTBot <b>{totals.chatgpt}</b></span>
        <span className="lg"><span className="dd" style={{ background: '#cc785c' }}></span>ClaudeBot <b>{totals.claude}</b></span>
        <span className="lg"><span className="dd" style={{ background: '#4285f4' }}></span>Google-Extended <b>{totals.gemini}</b></span>
      </div>

      <div className="cc-chart">
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" role="img" aria-label="AI 크롤러 방문 추이">
          <defs>
            <linearGradient id="pdTG1" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#10a37f" stopOpacity=".25" />
              <stop offset="1" stopColor="#10a37f" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pdTG2" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#cc785c" stopOpacity=".22" />
              <stop offset="1" stopColor="#cc785c" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="pdTG3" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#4285f4" stopOpacity=".20" />
              <stop offset="1" stopColor="#4285f4" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 가로 grid */}
          <g stroke="var(--line)" strokeWidth={1}>
            {yTicks.map((t, i) => (
              <line key={i} x1={PAD_L} y1={t.y.toFixed(1)} x2={VB_W - PAD_R} y2={t.y.toFixed(1)} />
            ))}
          </g>

          {/* Y 라벨 */}
          <g style={{ fontFamily: 'var(--mono)' }} fontSize="9.5" fill="var(--muted-2)">
            {yTicks.map((t, i) => (
              <text key={i} x={4} y={(t.y + 4).toFixed(1)}>{t.v}</text>
            ))}
          </g>

          {/* X 라벨 */}
          <g style={{ fontFamily: 'var(--mono)' }} fontSize="9.5" fill="var(--muted)" textAnchor="middle">
            {xTicks.map((t, i) => (
              <text key={i} x={t.x.toFixed(1)} y={VB_H - 8}>{t.label}</text>
            ))}
          </g>

          {/* 시리즈 (뒤→앞 순) */}
          {paths.map((p) => (
            <g key={p.key}>
              <path d={`M${p.areaPts}`} fill={`url(#${p.fill})`} />
              <polyline points={p.linePts} fill="none" stroke={p.color} strokeWidth={p.key === 'chatgpt' ? 2.4 : 2} />
            </g>
          ))}
        </svg>
      </div>
    </>
  )
}
