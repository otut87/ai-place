// AI Place — sparkline path 빌더.
// SVG 가 아닌 일별 카운트 배열을 받아 area + line 두 path 문자열을 반환.
// 데이터 모두 0 이면 빈 문자열 (호출처에서 placeholder 대체).

export interface SparklinePaths {
  /** area fill path (M...L...L width,height L 0,height Z) */
  fill: string
  /** stroke-only line path (M...L...) */
  stroke: string
  /** 데이터가 모두 0 이면 true — 호출처에서 차트 자체를 안 그릴 수 있음 */
  empty: boolean
}

export function buildSparkline(
  values: number[],
  opts: { width?: number; height?: number } = {},
): SparklinePaths {
  const width = opts.width ?? 400
  const height = opts.height ?? 60
  const empty = values.length === 0 || values.every(v => v === 0)
  if (empty) return { fill: '', stroke: '', empty: true }

  const max = Math.max(...values, 1)
  const stepX = values.length > 1 ? width / (values.length - 1) : 0
  const TOP_PAD = 5
  const BOTTOM_PAD = 2

  const points = values.map((v, i) => {
    const x = i * stepX
    const ratio = v / max
    const y = height - ratio * (height - TOP_PAD) - BOTTOM_PAD
    return [x, y] as const
  })

  const stroke = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ')
  const fill = `${stroke} L${width.toFixed(1)},${height.toFixed(1)} L0,${height.toFixed(1)} Z`

  return { fill, stroke, empty: false }
}
