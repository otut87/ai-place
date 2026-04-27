// T-253 — formatCompactNumber 단위 검증.

import { describe, it, expect } from 'vitest'
import { formatCompactNumber } from '@/lib/format/compact-number'

describe('formatCompactNumber', () => {
  it('1,000 미만은 ko-KR 콤마 표기', () => {
    expect(formatCompactNumber(0)).toBe('0')
    expect(formatCompactNumber(7)).toBe('7')
    expect(formatCompactNumber(123)).toBe('123')
    expect(formatCompactNumber(999)).toBe('999')
  })

  it('1,000 부터 K 표기 — 한 자리 소수 + 트레일링 .0 제거', () => {
    expect(formatCompactNumber(1_000)).toBe('1K')
    expect(formatCompactNumber(1_200)).toBe('1.2K')
    expect(formatCompactNumber(2_700)).toBe('2.7K')
    expect(formatCompactNumber(2_717)).toBe('2.7K')
  })

  it('100K 이상은 정수 K', () => {
    expect(formatCompactNumber(100_000)).toBe('100K')
    expect(formatCompactNumber(999_999)).toBe('1000K')
  })

  it('1,000,000 이상은 M 표기', () => {
    expect(formatCompactNumber(1_000_000)).toBe('1M')
    expect(formatCompactNumber(1_500_000)).toBe('1.5M')
  })

  it('0 또는 음수/NaN 은 0 으로 폴백', () => {
    expect(formatCompactNumber(NaN)).toBe('0')
    expect(formatCompactNumber(-100)).toBe('0')
    expect(formatCompactNumber(Infinity)).toBe('0')
  })
})
