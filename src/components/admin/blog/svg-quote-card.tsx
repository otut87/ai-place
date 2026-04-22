// T-195 — 인용 카드 SVG (리뷰 요약 하이라이트).

export interface QuoteCardData {
  quote: string                   // 30~60자
  source: string                  // 업체명 또는 "AI 요약"
  rating: number | null
}

export function SvgQuoteCard({ data }: { data: QuoteCardData }) {
  const width = 600
  const height = 200
  const padding = 24

  const maxCharsPerLine = 26
  const lines: string[] = []
  let current = ''
  for (const ch of data.quote) {
    if (current.length >= maxCharsPerLine && /\s/.test(ch)) {
      lines.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  if (current) lines.push(current.trim())
  const visibleLines = lines.slice(0, 3)

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${data.source} 인용`}
    >
      <defs>
        <linearGradient id="quoteBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fdfcfa" />
          <stop offset="100%" stopColor="#f5f1ea" />
        </linearGradient>
      </defs>
      <rect width={width} height={height} fill="url(#quoteBg)" rx={12} />

      {/* 인용 부호 */}
      <text
        x={padding}
        y={padding + 40}
        fontSize={54}
        fontWeight={700}
        fill="#00a67c"
        opacity={0.3}
      >
        &quot;
      </text>

      {/* 본문 */}
      {visibleLines.map((ln, i) => (
        <text
          key={i}
          x={padding + 40}
          y={padding + 36 + i * 26}
          fontSize={16}
          fontWeight={500}
          fill="#191919"
        >
          {ln}
        </text>
      ))}

      {/* 출처 + 평점 */}
      <text
        x={padding}
        y={height - padding}
        fontSize={12}
        fill="#6b6b6b"
      >
        — {data.source}
        {data.rating != null && ` · ★ ${data.rating.toFixed(1)}`}
      </text>
    </svg>
  )
}
