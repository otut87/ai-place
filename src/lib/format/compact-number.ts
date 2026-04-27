// T-253 — 큰 수를 K/M 표기로 압축. 1,234 → "1.2K" / 1,234,567 → "1.2M".
// 1,000 미만은 천 단위 콤마 그대로 (toLocaleString 'ko-KR').

export function formatCompactNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0'
  const abs = Math.abs(n)
  if (abs < 1_000) return n.toLocaleString('ko-KR')
  if (abs < 1_000_000) {
    const v = n / 1_000
    return v >= 100 ? `${Math.round(v)}K` : `${v.toFixed(1).replace(/\.0$/, '')}K`
  }
  const v = n / 1_000_000
  return v >= 100 ? `${Math.round(v)}M` : `${v.toFixed(1).replace(/\.0$/, '')}M`
}
