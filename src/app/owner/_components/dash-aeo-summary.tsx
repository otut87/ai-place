// /owner 홈 AEO 요약 — gauge + 최고/중앙값/최저 + meter + hint.

import type { OwnerPlaceSummary } from '@/lib/owner/dashboard-data'
import type { AeoGrade } from '@/lib/owner/place-aeo-score'

interface Props {
  places: OwnerPlaceSummary[]
  averageScore: number | null
}

function toGrade(score: number): AeoGrade {
  if (score >= 85) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid]
}

export function DashAeoSummary({ places, averageScore }: Props) {
  const scores = places.map((p) => p.aeoScore)
  const max = scores.length > 0 ? Math.max(...scores) : 0
  const min = scores.length > 0 ? Math.min(...scores) : 0
  const med = median(scores)
  const avg = averageScore ?? 0
  const grade = toGrade(avg)

  // SVG gauge — r=44, C=276.5. dashArray = avg/100 * 276.5
  const C = 2 * Math.PI * 44
  const dash = Math.max(0, Math.min(1, avg / 100)) * C

  // Weakest place hint
  const weakest = [...places].sort((a, b) => a.aeoScore - b.aeoScore)[0]
  const firstDeficiency = weakest?.aeoRules?.find((r) => !r.passed)

  // Meter fill: average, target: 90
  const fillPct = Math.max(0, Math.min(100, avg))
  const tgtPct = 90

  return (
    <div className="aeo-sum">
      <div className="gauge">
        <svg viewBox="0 0 100 100">
          <circle cx={50} cy={50} r={44} fill="none" stroke="#efece4" strokeWidth={8} />
          <circle
            cx={50} cy={50} r={44} fill="none"
            stroke="url(#gAeoSum)" strokeWidth={8}
            strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="gAeoSum">
              <stop stopColor="#ff5c2b" />
              <stop offset="1" stopColor="#ff9a5c" />
            </linearGradient>
          </defs>
        </svg>
        <div className="vv">
          <span className="n">{avg}</span>
          <span className="s">/ 100</span>
        </div>
      </div>

      <div className="info">
        <div className="row1">
          <h3>AEO 점수 평균</h3>
          <small>{places.length}곳</small>
          <span className={`grade ${grade === 'A' ? '' : grade}`}>{grade} 등급</span>
        </div>
        <div className="stats">
          <div className="c"><div className="l">최고</div><div className="n">{max}<small>/100</small></div></div>
          <div className="c"><div className="l">중앙값</div><div className="n">{med}<small>/100</small></div></div>
          <div className="c"><div className="l">최저</div><div className="n">{min}<small>/100</small></div></div>
        </div>
        <div className="meter" aria-label="목표 90까지">
          <div className="fill" style={{ width: `${fillPct}%` }} />
          <div className="tgt" style={{ left: `${tgtPct}%` }} />
        </div>
        {weakest && firstDeficiency ? (
          <div className="hint">
            <b>{weakest.name}</b>({weakest.aeoScore}점) — <b>{firstDeficiency.label}</b> 보완 시 <b>+{firstDeficiency.weight}점</b> 회복 가능.
          </div>
        ) : (
          <div className="hint">등록된 업체 모두 AEO 규칙을 통과했습니다.</div>
        )}
      </div>
    </div>
  )
}
