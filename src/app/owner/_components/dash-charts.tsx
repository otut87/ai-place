// /owner 홈 — 2 차트 (AI 답변 인용 / AI 학습 크롤링) Remix 스타일.
// SVG path + legend + summary 헤더.

import Link from 'next/link'
import type { OwnerDailyTrendRow } from '@/lib/owner/bot-stats'

const VB_W = 700
const VB_H = 220
const PAD_L = 32
const PAD_R = 10
const PAD_T = 22
const PAD_B = 40

const GRID_TICKS = 4

type SearchEngine = 'chatgpt' | 'claude' | 'perplexity' | 'other'
type TrainingEngine = 'chatgpt' | 'claude' | 'gemini' | 'other'

const SEARCH_ENGINES: Array<{ key: SearchEngine; label: string; color: string }> = [
  { key: 'chatgpt',    label: 'ChatGPT',    color: '#10a37f' },
  { key: 'claude',     label: 'Claude',     color: '#cc785c' },
  { key: 'perplexity', label: 'Perplexity', color: '#7a3f8f' },
  { key: 'other',      label: '기타',       color: '#9a9a9a' },
]
const TRAINING_ENGINES: Array<{ key: TrainingEngine; label: string; color: string }> = [
  { key: 'chatgpt', label: 'GPTBot',    color: '#b45309' },
  { key: 'claude',  label: 'ClaudeBot', color: '#cc785c' },
  { key: 'gemini',  label: 'Gemini',    color: '#4285f4' },
  { key: 'other',   label: '기타',      color: '#9a9a9a' },
]

function buildPath(values: number[], maxY: number): { line: string; area: string } {
  if (values.length === 0) return { line: '', area: '' }
  const plotW = VB_W - PAD_L - PAD_R
  const plotH = VB_H - PAD_T - PAD_B
  const stepX = values.length > 1 ? plotW / (values.length - 1) : plotW
  const safeMax = Math.max(1, maxY)
  const pts = values.map((v, i) => {
    const x = PAD_L + i * stepX
    const y = PAD_T + plotH * (1 - v / safeMax)
    return { x: +x.toFixed(1), y: +y.toFixed(1) }
  })
  const line = `M${pts.map((p) => `${p.x},${p.y}`).join(' L')}`
  const area = `${line} L${pts[pts.length - 1].x},${PAD_T + plotH} L${pts[0].x},${PAD_T + plotH} Z`
  return { line, area }
}

function parseKstDate(key: string): string {
  // "2026-04-22" → "4/22"
  const parts = key.split('-')
  if (parts.length === 3) return `${+parts[1]}/${+parts[2]}`
  return key
}

interface ChartProps {
  title: string
  dotColor: string
  rows: OwnerDailyTrendRow[]
  engines: ReadonlyArray<{ key: string; label: string; color: string }>
  group: 'aiSearch' | 'aiTraining'
  rangeDays: number
  /** current path — Link 로 기간 스위치 생성. */
  basePath: string
  total: number
}

function Chart({
  title, dotColor, rows, engines, group, rangeDays, basePath, total,
}: ChartProps) {
  const series = engines.map((e) => ({
    ...e,
    values: rows.map((r) => (r[group] as Record<string, number>)[e.key] ?? 0),
    sum: rows.reduce((s, r) => s + ((r[group] as Record<string, number>)[e.key] ?? 0), 0),
  }))

  const maxY = Math.max(1, ...series.flatMap((s) => s.values))
  const leadEngine = series.reduce((best, s) => (s.sum > best.sum ? s : best), series[0])

  // Y 축 티크 값 (정수로 표시)
  const yLabels = Array.from({ length: GRID_TICKS + 1 }, (_, i) => {
    const v = Math.round((maxY * (GRID_TICKS - i)) / GRID_TICKS)
    return v
  })

  const plotW = VB_W - PAD_L - PAD_R
  const plotH = VB_H - PAD_T - PAD_B

  // X 축 라벨 (시작/중간/끝)
  const xLabels = [
    rows[0]?.date,
    rows[Math.floor(rows.length / 4)]?.date,
    rows[Math.floor(rows.length / 2)]?.date,
    rows[Math.floor((rows.length * 3) / 4)]?.date,
    rows[rows.length - 1]?.date,
  ].filter(Boolean) as string[]

  return (
    <div className="dash-panel2 chart-card">
      <div className="phead">
        <h3><span className="dt" style={{ background: dotColor }} />{title}</h3>
        <div className="right">
          <div className="range">
            <Link href={`${basePath}?days=7`}  className={rangeDays === 7  ? 'active' : undefined}>7D</Link>
            <Link href={`${basePath}?days=30`} className={rangeDays === 30 ? 'active' : undefined}>30D</Link>
            <Link href={`${basePath}?days=90`} className={rangeDays === 90 ? 'active' : undefined}>90D</Link>
          </div>
        </div>
      </div>

      <div className="summary">
        <div>
          <div className="big">{total.toLocaleString()}<span className="u">건</span></div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 2 }}>
            {rangeDays}일 합계
          </div>
        </div>
        <div className="engines">
          {total === 0 ? (
            <>
              <div style={{ color: 'var(--muted-2)' }}>아직 기록 없음</div>
              <div style={{ color: 'var(--muted)', marginTop: 3 }}>AI 봇 발견까지 평균 3~10일</div>
            </>
          ) : (
            <>
              <div className={`lead${group === 'aiTraining' ? ' warn' : ''}`}>
                ● {leadEngine.label} 주도 · {leadEngine.sum}건
              </div>
              <div style={{ color: 'var(--muted)', marginTop: 3 }}>총 {total}건</div>
            </>
          )}
        </div>
      </div>

      <svg className="chart-svg" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
        {/* grid */}
        <g stroke="#efece4" strokeWidth={1}>
          {yLabels.map((_, i) => {
            const y = PAD_T + (plotH * i) / GRID_TICKS
            return <line key={i} x1={PAD_L} y1={y} x2={VB_W - PAD_R} y2={y} />
          })}
        </g>
        {/* y axis labels */}
        <g fontFamily="JetBrains Mono" fontSize={9.5} fill="#9a9a9a">
          {yLabels.map((v, i) => {
            const y = PAD_T + (plotH * i) / GRID_TICKS + 3
            return <text key={i} x={4} y={y}>{v}</text>
          })}
        </g>
        {/* x axis labels */}
        <g fontFamily="JetBrains Mono" fontSize={9.5} fill="#9a9a9a" textAnchor="middle">
          {xLabels.map((key, i) => {
            const x = PAD_L + (plotW * i) / Math.max(1, xLabels.length - 1)
            return <text key={i} x={x} y={VB_H - 8}>{parseKstDate(key)}</text>
          })}
        </g>
        {/* lines */}
        {series.map((s) => {
          if (s.sum === 0) {
            // zero baseline — dashed
            return (
              <line
                key={s.key}
                x1={PAD_L} y1={PAD_T + plotH}
                x2={VB_W - PAD_R} y2={PAD_T + plotH}
                stroke={s.color}
                strokeWidth={1.4}
                strokeDasharray="4 5"
                opacity={0.45}
              />
            )
          }
          const { line, area } = buildPath(s.values, maxY)
          if (!line) return null
          const lastVal = s.values[s.values.length - 1]
          const lastY = PAD_T + plotH * (1 - lastVal / Math.max(1, maxY))
          const lastX = VB_W - PAD_R
          return (
            <g key={s.key}>
              {s.key === leadEngine.key && (
                <path d={area} fill={`url(#chart-grad-${group}-${s.key})`} opacity={0.5} />
              )}
              <path d={line} stroke={s.color} fill="none" strokeWidth={2.4} strokeLinejoin="round" />
              {lastVal > 0 && <circle cx={lastX} cy={lastY} r={4} fill="#fff" stroke={s.color} strokeWidth={2} />}
            </g>
          )
        })}
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`chart-grad-${group}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={s.color} stopOpacity={0.18} />
              <stop offset="1" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
      </svg>

      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.key} className={s.sum === 0 ? 'zero' : undefined}>
            <i style={{ background: s.color }} /> {s.label} <b>{s.sum}건</b>
          </span>
        ))}
      </div>
    </div>
  )
}

interface Props {
  rows: OwnerDailyTrendRow[]
  searchTotal: number
  trainingTotal: number
  rangeDays: number
}

export function DashCharts({ rows, searchTotal, trainingTotal, rangeDays }: Props) {
  return (
    <div className="chart-row">
      <Chart
        title="AI 답변 · 실시간 인용 추이"
        dotColor="#10a37f"
        rows={rows}
        engines={SEARCH_ENGINES}
        group="aiSearch"
        rangeDays={rangeDays}
        basePath="/owner"
        total={searchTotal}
      />
      <Chart
        title="AI 학습 크롤링 추이"
        dotColor="var(--warn)"
        rows={rows}
        engines={TRAINING_ENGINES}
        group="aiTraining"
        rangeDays={rangeDays}
        basePath="/owner"
        total={trainingTotal}
      />
    </div>
  )
}
