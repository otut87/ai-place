import { describe, it, expect } from 'vitest'
import {
  BILLING_POLICY_TEXTS,
  BILLING_PRODUCT,
  buildReceiptFooter,
  summarizeBillingCycle,
} from '@/lib/billing/policy'

describe('BILLING_POLICY_TEXTS', () => {
  it('부가세 적격증빙 문구 포함', () => {
    expect(BILLING_POLICY_TEXTS.proofOfTax).toContain('카드매출전표')
    expect(BILLING_POLICY_TEXTS.proofOfTax).toContain('부가세')
  })

  it('재시도 정책 문구 3회 명시', () => {
    expect(BILLING_POLICY_TEXTS.retryPolicy).toContain('3회')
  })
})

describe('BILLING_PRODUCT', () => {
  it('월 14,900원 고정 (T-206 단일 요금제 최종)', () => {
    expect(BILLING_PRODUCT.amount).toBe(14900)
    expect(BILLING_PRODUCT.amountText).toBe('14,900원')
  })
})

describe('buildReceiptFooter', () => {
  it('부가세 + 환불 + 문의 3블록', () => {
    const footer = buildReceiptFooter()
    expect(footer).toContain('카드매출전표')
    expect(footer).toContain('환불')
    expect(footer).toContain('support@aiplace.kr')
  })
})

describe('summarizeBillingCycle', () => {
  it('한 줄 요약', () => {
    expect(summarizeBillingCycle()).toBe('월 1회 자동결제 · 14,900원')
  })
})
