import { describe, it, expect } from 'vitest'
import {
  validateQuote,
  isLikelyVerbatim,
  requireAttribution,
  MAX_QUOTE_LENGTH,
} from '@/lib/compliance/review'

describe('validateQuote', () => {
  it('null/undefined → 유효', () => {
    expect(validateQuote(null).valid).toBe(true)
    expect(validateQuote(undefined).valid).toBe(true)
    expect(validateQuote('').valid).toBe(true)
  })

  it('50자 이하 → 유효', () => {
    expect(validateQuote('여드름 치료가 효과적이었습니다').valid).toBe(true)
  })

  it('50자 초과 → 거부', () => {
    const long = 'ㄱ'.repeat(MAX_QUOTE_LENGTH + 1)
    const r = validateQuote(long)
    expect(r.valid).toBe(false)
    expect(r.reason).toContain('50자')
  })

  it('이모지도 정확히 카운트', () => {
    // 이모지 1 = 1자로 spread 카운트
    const r = validateQuote('🌟'.repeat(MAX_QUOTE_LENGTH + 1))
    expect(r.valid).toBe(false)
  })
})

describe('isLikelyVerbatim', () => {
  it('30자 연속 일치 → 감지', () => {
    const src = '이 병원은 여드름 치료에 매우 효과적이었고 원장님도 친절하셨습니다. 재방문 의사 있습니다.'
    const summary = `고객은 "${src.slice(0, 35)}" 라고 평가`
    expect(isLikelyVerbatim(summary, src)).toBe(true)
  })

  it('패러프레이즈 → 감지 안 됨', () => {
    const src = '여드름 치료가 정말 효과적이었어요'
    const summary = '고객은 여드름 시술에 만족했다고 평가했습니다'
    expect(isLikelyVerbatim(summary, src)).toBe(false)
  })

  it('빈 입력', () => {
    expect(isLikelyVerbatim('', 'abc')).toBe(false)
    expect(isLikelyVerbatim('abc', '')).toBe(false)
  })
})

describe('requireAttribution', () => {
  it('excerpt 없음 → ok', () => {
    expect(requireAttribution({ excerpt: null, sourceUrl: null, sourceType: 'blog' }).ok).toBe(true)
  })

  it('excerpt 있음 + sourceUrl 없음 → 거부', () => {
    const r = requireAttribution({ excerpt: '좋아요', sourceUrl: null, sourceType: 'blog' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('출처')
  })

  it('excerpt 50자 초과 → 거부', () => {
    const long = 'ㄱ'.repeat(60)
    const r = requireAttribution({ excerpt: long, sourceUrl: 'https://blog.example', sourceType: 'blog' })
    expect(r.ok).toBe(false)
  })

  it('정상 → ok', () => {
    expect(requireAttribution({ excerpt: '좋아요', sourceUrl: 'https://x', sourceType: 'blog' }).ok).toBe(true)
  })
})
