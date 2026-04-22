// T-195 — 랭킹 배지 SVG (1~5위 강조용).

export interface RankingData {
  rank: number                    // 1~5
  title: string                   // 업체명
  subtitle?: string               // 카테고리 or 한 줄 특징
}

const COLORS = ['#c9a24a', '#a8a8a8', '#c68855', '#5f8fa8', '#6a9955']

export function SvgRankingBadge({ data }: { data: RankingData }) {
  const width = 320
  const height = 100
  const padding = 16
  const circleR = 30
  const color = COLORS[Math.max(0, Math.min(4, data.rank - 1))]

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${data.rank}위 ${data.title}`}
    >
      <rect width={width} height={height} fill="#ffffff" stroke="#e7e7e7" rx={10} />

      {/* 랭킹 서클 */}
      <circle cx={padding + circleR} cy={height / 2} r={circleR} fill={color} />
      <text
        x={padding + circleR}
        y={height / 2 + 8}
        fontSize={26}
        fontWeight={700}
        fill="#ffffff"
        textAnchor="middle"
      >
        {data.rank}
      </text>

      {/* 타이틀 */}
      <text
        x={padding + circleR * 2 + 16}
        y={data.subtitle ? height / 2 : height / 2 + 6}
        fontSize={16}
        fontWeight={600}
        fill="#191919"
      >
        {data.title}
      </text>

      {/* 서브타이틀 */}
      {data.subtitle && (
        <text
          x={padding + circleR * 2 + 16}
          y={height / 2 + 20}
          fontSize={12}
          fill="#6b6b6b"
        >
          {data.subtitle}
        </text>
      )}
    </svg>
  )
}
