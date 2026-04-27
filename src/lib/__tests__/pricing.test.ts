// T-234 — pricing 단일 소스 헬퍼 검증.

import { describe, it, expect } from 'vitest'
import {
  MONTHLY_PRICE_KRW,
  MONTHLY_PRICE_TEXT,
  MONTHLY_PRICE_LABEL,
  formatMonthlyTotal,
} from '@/lib/pricing'
import { PLAN_AMOUNT_PER_PLACE } from '@/lib/billing/types'

describe('pricing — 표시용 가격 단일 소스', () => {
  it('MONTHLY_PRICE_KRW 는 PLAN_AMOUNT_PER_PLACE 와 같다', () => {
    expect(MONTHLY_PRICE_KRW).toBe(PLAN_AMOUNT_PER_PLACE)
  })

  it('MONTHLY_PRICE_TEXT 는 한국식 천 단위 + "원" 접미', () => {
    expect(MONTHLY_PRICE_TEXT).toBe(`${MONTHLY_PRICE_KRW.toLocaleString('ko-KR')}원`)
    expect(MONTHLY_PRICE_TEXT).toMatch(/^[\d,]+원$/)
  })

  it('MONTHLY_PRICE_LABEL 은 "월 N원" 형식', () => {
    expect(MONTHLY_PRICE_LABEL).toBe(`월 ${MONTHLY_PRICE_TEXT}`)
    expect(MONTHLY_PRICE_LABEL.startsWith('월 ')).toBe(true)
  })
})

describe('formatMonthlyTotal', () => {
  it('업체 1곳 → 단가 그대로', () => {
    expect(formatMonthlyTotal(1)).toBe(MONTHLY_PRICE_TEXT)
  })

  it('업체 N곳 → N × 단가', () => {
    const n = 3
    const expected = `${(n * MONTHLY_PRICE_KRW).toLocaleString('ko-KR')}원`
    expect(formatMonthlyTotal(n)).toBe(expected)
  })

  it('업체 0곳 → "0원"', () => {
    expect(formatMonthlyTotal(0)).toBe('0원')
  })
})
