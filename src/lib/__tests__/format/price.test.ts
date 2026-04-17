/**
 * format/price.ts 테스트 (T-010)
 */
import { describe, it, expect } from 'vitest'
import { formatPriceRange } from '@/lib/format/price'

describe('formatPriceRange', () => {
  it('단일 값 "5만원" → "5만원"', () => {
    expect(formatPriceRange('5만원')).toBe('5만원')
  })

  it('범위 "5-10만원" → "5-10만원"', () => {
    expect(formatPriceRange('5-10만원')).toBe('5-10만원')
  })

  it('숫자만 "50000" → "50,000원" (천단위 구분)', () => {
    expect(formatPriceRange('50000')).toBe('50,000원')
  })

  it('빈 값 → "상담 후 결정"', () => {
    expect(formatPriceRange('')).toBe('상담 후 결정')
    expect(formatPriceRange(undefined)).toBe('상담 후 결정')
  })

  it('이미 포맷된 한글 값은 그대로 반환', () => {
    expect(formatPriceRange('무료')).toBe('무료')
    expect(formatPriceRange('상담 후 결정')).toBe('상담 후 결정')
  })
})
