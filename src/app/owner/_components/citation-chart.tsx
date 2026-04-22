// Sprint D-2 / T-203 — AI 봇 방문 추이 차트 (SVG).
// 실시간(ai-search) 3엔진 + 학습(ai-training) 4엔진 이중 뷰.
// Server component — 정적 SVG path 만 생성, JS 인터랙션 없음.

import type { OwnerDailyTrendRow } from '@/lib/owner/bot-stats'

type SearchEngine = 'chatgpt' | 'claude' | 'perplexity' | 'other'
type TrainingEngine = 'chatgpt' | 'claude' | 'gemini' | 'other'

const SEARCH_ENGINES: Array<{ key: SearchEngine; label: string; color: string }> = [
  { key: 'chatgpt',    label: 'ChatGPT',    color: '#10a37f' },
  { key: 'claude',     label: 'Claude',     color: '#cc785c' },
  { key: 'perplexity', label: 'Perplexity', color: '#20808d' },
  { key: 'other',      label: '기타',       color: '#9a9a9a' },
]
const TRAINING_ENGINES: Array<{ key: TrainingEngine; label: string; color: string }> = [
  { key: 'chatgpt', label: 'GPTBot',       color: '#10a37f' },
  { key: 'claude',  label: 'ClaudeBot',    color: '#cc785c' },
  { key: 'gemini',  label: 'Gemini',       color: '#4285f4' },
  { key: 'other',   label: '기타',         color: '#9a9a9a' },
]

// SVG viewBox 기준.
const VB_W = 700
const VB_H = 240
const PAD_L = 28
const PAD_R = 10
const PAD_T = 20
const PAD_B = 28

function toPath(values: number[], maxY: number): string {
  if (values.length === 0) return ''
  const plotW = VB_W - PAD_L - PAD_R
  const plotH = VB_H - PAD_T - PAD_B
  const stepX = values.length > 1 ? plotW / (values.length - 1) : plotW
  const safeMax = Math.max(1, maxY)
  const pts = values.map((v, i) => {
    const x = PAD_L + i * stepX
    const y = PAD_T + plotH * (1 - v / safeMax)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return `M${pts.join(' L')}`
}

function Chart({
  title, rows, engines, group,
}: {
  title: string
  rows: OwnerDailyTrendRow[]
  engines: Array<{ key: string; label: string; color: string }>
  group: 'aiSearch' | 'aiTraining'
}) {
  // 엔진별 value series + grand max
  const series = engines.map((e) => ({
    ...e,
    values: rows.map((r) => (r[group] as Record<string, number>)[e.key] ?? 0),
  }))
  const grandMax = Math.max(
    1,
    ...series.flatMap((s) => s.values),
  )
  const yTicks = 4
  const yLabels = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = Math.round((grandMax * (yTicks - i)) / yTicks)
    return v
  })

  const startLabel = rows[0]?.date.slice(5) ?? ''
  const midLabel = rows[Math.floor(rows.length / 2)]?.date.slice(5) ?? ''
  const endLabel = rows[rows.length - 1]?.date.slice(5) ?? ''

  const plotH = VB_H - PAD_T - PAD_B
  const plotW = VB_W - PAD_L - PAD_R

  const totalEvents = series.reduce((s, e) => s + e.values.reduce((a, b) => a + b, 0), 0)

  return (
    <div className="dash-panel">
      <div className="head">
        <h3>{title}</h3>
        <span className="chip">{rows.length}일 · 총 {totalEvents.toLocaleString()}건</span>
      </div>

      <svg
        role="img"
        aria-label={`${title} 일자별 추이`}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height: 220, display: 'block' }}
      >
        {/* grid + Y labels */}
        <g stroke="var(--line)" strokeWidth={1}>
          {yLabels.map((_, i) => {
            const y = PAD_T + (plotH * i) / yTicks
            return <line key={i} x1={PAD_L} y1={y} x2={VB_W - PAD_R} y2={y} />
          })}
        </g>
        <g fontFamily="var(--mono)" fontSize={10} fill="#9a9a9a">
          {yLabels.map((v, i) => {
            const y = PAD_T + (plotH * i) / yTicks + 3
            return <text key={i} x={4} y={y}>{v}</text>
          })}
        </g>

        {/* X labels — start / mid / end */}
        <g fontFamily="var(--mono)" fontSize={10} fill="#9a9a9a">
          <text x={PAD_L} y={VB_H - 8}>{startLabel}</text>
          <text x={PAD_L + plotW / 2} y={VB_H - 8} textAnchor="middle">{midLabel}</text>
          <text x={VB_W - PAD_R} y={VB_H - 8} textAnchor="end">{endLabel}</text>
        </g>

        {/* engine lines */}
        {series.map((s) => {
          const d = toPath(s.values, grandMax)
          if (!d) return null
          return (
            <path
              key={s.key}
              d={d}
              stroke={s.color}
              strokeWidth={2.2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </svg>

      <div className="legend">
        {series.map((s) => {
          const sum = s.values.reduce((a, b) => a + b, 0)
          return (
            <span key={s.key}>
              <span className="d" style={{ background: s.color }} />
              {' '}{s.label} · {sum}건
            </span>
          )
        })}
      </div>
    </div>
  )
}

interface Props {
  rows: OwnerDailyTrendRow[]
  /** D<15 이면 오버레이 + 흐릿 처리. */
  measuring: boolean
  measuringLabel: string
}

export function CitationCharts({ rows, measuring, measuringLabel }: Props) {
  return (
    <section className="row" style={{ position: 'relative' }}>
      <Chart
        title="🟢 AI 답변 · 실시간 인용 추이"
        rows={rows}
        engines={SEARCH_ENGINES}
        group="aiSearch"
      />
      <Chart
        title="🟡 AI 학습 크롤링 추이"
        rows={rows}
        engines={TRAINING_ENGINES}
        group="aiTraining"
      />

      {measuring && (
        <div
          className="measuring-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="body">
            <div className="big">측정 중 · {measuringLabel}</div>
            <div className="sub">AI 봇 방문까지 평균 3~10일 · 15일 후 실수치가 공개됩니다.</div>
          </div>
        </div>
      )}
    </section>
  )
}
