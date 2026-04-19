import { describe, it, expect } from 'vitest'
import { mockAdapter } from '@/lib/billing/mock'

describe('mockAdapter.issueBillingKey', () => {
  it('customerKey 기반 빌링키 발급 성공', async () => {
    const r = await mockAdapter.issueBillingKey({ authKey: 'a', customerKey: 'cus_1' })
    expect(r.success).toBe(true)
    expect(r.billingKey).toContain('mock_bk_cus_1_')
    expect(r.cardNumberMasked).toBe('1234-****-****-5678')
    expect(r.expiryMonth).toBe(12)
  })
})

describe('mockAdapter.chargeOnce', () => {
  const BASE = { billingKey: 'bk_1', customerKey: 'cus_1', orderName: 'test', amount: 33000 }

  it('성공 경로', async () => {
    const r = await mockAdapter.chargeOnce({ ...BASE, orderId: 'o-1' })
    expect(r.success).toBe(true)
    expect(r.paymentKey).toBeDefined()
    expect(r.approvedAt).toBeDefined()
  })

  it('잔액부족', async () => {
    const r = await mockAdapter.chargeOnce({ ...BASE, orderId: 'o-2-fail-balance' })
    expect(r.success).toBe(false)
    expect(r.error?.category).toBe('insufficient_balance')
    expect(r.error?.code).toBe('NOT_ENOUGH_BALANCE')
  })

  it('카드 만료', async () => {
    const r = await mockAdapter.chargeOnce({ ...BASE, orderId: 'o-3-fail-expired' })
    expect(r.success).toBe(false)
    expect(r.error?.category).toBe('card_expired')
  })

  it('한도초과', async () => {
    const r = await mockAdapter.chargeOnce({ ...BASE, orderId: 'o-4-fail-limit' })
    expect(r.success).toBe(false)
    expect(r.error?.category).toBe('limit_exceeded')
  })

  it('도난 카드', async () => {
    const r = await mockAdapter.chargeOnce({ ...BASE, orderId: 'o-5-fail-stolen' })
    expect(r.success).toBe(false)
    expect(r.error?.category).toBe('stolen_or_lost')
  })
})

describe('mockAdapter.revoke / verifyWebhook', () => {
  it('revoke 항상 성공', async () => {
    expect(await mockAdapter.revoke('bk_1')).toEqual({ success: true })
  })

  it('verifyWebhook 항상 true', async () => {
    expect(await mockAdapter.verifyWebhook({ rawBody: '{}', signature: 'x' })).toBe(true)
  })
})
