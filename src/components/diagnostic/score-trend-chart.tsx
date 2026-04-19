// T-162 — 점수 추이 라인 차트 (SVG 인라인, dep 0).
// 최근 N개 진단 결과를 시간순으로 표시.

export interface ScorePoint {
  score: number
  date: string                 // ISO 8601
}

interface Props {
  points: ScorePoint[]         // 시간 내림차순 기대 → 내부에서 오름차순 변환
  width?: number
  height?: number
  benchmarkScore?: number      // 등록 업체 평균선 (점선 표시)
}

export function ScoreTrendChart({ points, width = 320, height = 120, benchmarkScore }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-28 items-center justify-center rounded-lg border border-dashed border-[#dddddd] text-xs text-[#9a9a9a]">
        진단 이력이 없습니다
      </div>
    )
  }

  // 시간 오름차순 정렬
  const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const padding = { top: 12, right: 8, bottom: 24, left: 24 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const minScore = 0
  const maxScore = 100

  const xStep = sorted.length > 1 ? chartWidth / (sorted.length - 1) : 0
  const y = (v: number) => padding.top + chartHeight * (1 - (v - minScore) / (maxScore - minScore))

  const pathData = sorted.map((p, i) => {
    const x = padding.left + i * xStep
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y(p.score).toFixed(1)}`
  }).join(' ')

  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const delta = last.score - first.score

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-[#6a6a6a]">점수 추이 (최근 {sorted.length}회)</span>
        {sorted.length > 1 && (
          <span className={`font-medium ${delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-[#484848]'}`}>
            {delta > 0 ? `+${delta}` : delta}점 ({first.score} → {last.score})
          </span>
        )}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="점수 추이">
        {/* 그리드 (0, 50, 100) */}
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={padding.left} y1={y(v)} x2={width - padding.right} y2={y(v)}
              stroke="#e5e7eb" strokeWidth="1" strokeDasharray="2,2" />
            <text x={padding.left - 4} y={y(v) + 3} fontSize="9" fill="#9a9a9a" textAnchor="end">{v}</text>
          </g>
        ))}

        {/* 벤치마크 선 */}
        {benchmarkScore !== undefined && (
          <g>
            <line x1={padding.left} y1={y(benchmarkScore)} x2={width - padding.right} y2={y(benchmarkScore)}
              stroke="#10b981" strokeWidth="1" strokeDasharray="4,2" opacity="0.5" />
            <text x={width - padding.right - 2} y={y(benchmarkScore) - 2} fontSize="8" fill="#10b981" textAnchor="end">
              평균 {benchmarkScore}
            </text>
          </g>
        )}

        {/* 라인 */}
        <path d={pathData} stroke="#008060" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

        {/* 점 */}
        {sorted.map((p, i) => (
          <circle key={i} cx={padding.left + i * xStep} cy={y(p.score)} r="3" fill="#008060" />
        ))}

        {/* X축 — 첫·마지막 날짜 */}
        <text x={padding.left} y={height - 4} fontSize="9" fill="#6a6a6a">
          {new Date(first.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
        </text>
        {sorted.length > 1 && (
          <text x={width - padding.right} y={height - 4} fontSize="9" fill="#6a6a6a" textAnchor="end">
            {new Date(last.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </text>
        )}
      </svg>
    </div>
  )
}
