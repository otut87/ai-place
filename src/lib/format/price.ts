// 가격 포맷 유틸 (T-010)
// 한국어 "N만원", "N-M만원" 패턴 보존 + 순수 숫자는 "N,NNN원" 으로.

export function formatPriceRange(price: string | undefined): string {
  if (!price || !price.trim()) return '상담 후 결정'
  const trimmed = price.trim()
  // 이미 한글 단위 포함 (만원/천원/원/무료 등) → 원본 유지
  if (/[가-힣]/.test(trimmed)) return trimmed
  // 순수 숫자 → 천단위 쉼표 + 원
  if (/^\d+$/.test(trimmed)) {
    return `${Number(trimmed).toLocaleString('ko-KR')}원`
  }
  return trimmed
}
