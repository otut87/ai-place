// T-195 — 비교표 SVG (원가 0).
// pipeline 에서 ReactDOMServer.renderToStaticMarkup 으로 문자열화 → base64 data URI 삽입.

export interface ComparisonData {
  headers: string[]                // e.g. ['업체', '전문의', '리뷰', '평점']
  rows: Array<{ place: string; values: (string | number)[] }>
  title?: string
}

const BG = '#ffffff'
const FG = '#191919'
const MUTED = '#6b6b6b'
const ACCENT = '#00a67c'

export function SvgComparisonTable({ data }: { data: ComparisonData }) {
  const rowHeight = 36
  const headerHeight = 44
  const padding = 16
  const colCount = data.headers.length
  const width = Math.max(480, colCount * 120)
  const bodyHeight = rowHeight * data.rows.length
  const titleHeight = data.title ? 32 : 0
  const height = titleHeight + headerHeight + bodyHeight + padding * 2

  const colWidth = (width - padding * 2) / colCount

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={data.title ?? '비교표'}
    >
      <rect width={width} height={height} fill={BG} />

      {data.title && (
        <text
          x={padding}
          y={padding + 20}
          fontSize={16}
          fontWeight={600}
          fill={FG}
        >
          {data.title}
        </text>
      )}

      {/* 헤더 */}
      <g transform={`translate(${padding}, ${padding + titleHeight})`}>
        <rect width={width - padding * 2} height={headerHeight} fill={ACCENT} rx={4} />
        {data.headers.map((h, i) => (
          <text
            key={i}
            x={colWidth * i + colWidth / 2}
            y={headerHeight / 2 + 5}
            fontSize={13}
            fontWeight={600}
            fill="#ffffff"
            textAnchor="middle"
          >
            {h}
          </text>
        ))}
      </g>

      {/* 본문 */}
      <g transform={`translate(${padding}, ${padding + titleHeight + headerHeight})`}>
        {data.rows.map((row, rIdx) => (
          <g key={rIdx} transform={`translate(0, ${rIdx * rowHeight})`}>
            {rIdx % 2 === 1 && (
              <rect width={width - padding * 2} height={rowHeight} fill="#fafafa" />
            )}
            <text
              x={colWidth / 2}
              y={rowHeight / 2 + 5}
              fontSize={12}
              fontWeight={500}
              fill={FG}
              textAnchor="middle"
            >
              {row.place}
            </text>
            {row.values.map((v, vIdx) => (
              <text
                key={vIdx}
                x={colWidth * (vIdx + 1) + colWidth / 2}
                y={rowHeight / 2 + 5}
                fontSize={12}
                fill={MUTED}
                textAnchor="middle"
              >
                {String(v)}
              </text>
            ))}
          </g>
        ))}
      </g>
    </svg>
  )
}
