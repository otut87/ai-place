// T-CP2 — 리뷰 저작권 가드.
// 정책: 블로그/카페 리뷰 원문을 DB 에 저장하지 않는다. AI 로 요약·패러프레이즈한 결과만 저장.
// 인용할 경우 50자 이내 + 출처 표기 필수.

const MAX_QUOTE_LENGTH = 50

export interface QuoteValidation {
  valid: boolean
  reason?: string
}

export function validateQuote(text: string | null | undefined): QuoteValidation {
  if (!text) return { valid: true }
  const len = [...text].length
  if (len > MAX_QUOTE_LENGTH) {
    return { valid: false, reason: `인용은 ${MAX_QUOTE_LENGTH}자 이내여야 합니다 (현재 ${len}자)` }
  }
  return { valid: true }
}

/** 리뷰 요약에서 원문 그대로 복제된 연속 문장이 감지되면 거부. */
export function isLikelyVerbatim(summary: string, source: string, minLen = 30): boolean {
  if (!summary || !source) return false
  const s = summary.replace(/\s+/g, ' ').trim()
  const src = source.replace(/\s+/g, ' ').trim()
  for (let i = 0; i + minLen <= src.length; i++) {
    const snippet = src.slice(i, i + minLen)
    if (s.includes(snippet)) return true
  }
  return false
}

export interface AttributionInput {
  excerpt: string | null
  sourceUrl: string | null
  sourceType: 'blog' | 'cafe' | 'news' | 'review'
}

export interface AttributionOk {
  ok: true
}
export interface AttributionFail {
  ok: false
  reason: string
}

export function requireAttribution(input: AttributionInput): AttributionOk | AttributionFail {
  if (!input.excerpt) return { ok: true }
  const q = validateQuote(input.excerpt)
  if (!q.valid) return { ok: false, reason: q.reason! }
  if (!input.sourceUrl) return { ok: false, reason: '인용 시 출처 URL 을 함께 저장해야 합니다.' }
  return { ok: true }
}

export { MAX_QUOTE_LENGTH }
