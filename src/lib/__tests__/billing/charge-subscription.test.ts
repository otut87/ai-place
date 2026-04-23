import { describe, it, expect, vi } from 'vitest'
import {
  buildOrderId,
  chargeSubscriptionOnce,
} from '@/lib/billing/charge-subscription'
import type { PgAdapter } from '@/lib/billing/adapter'

function makeAdapter(chargeImpl: PgAdapter['chargeOnce']): PgAdapter {
  return {
    provider: 'mock',
    issueBillingKey: vi.fn(),
    revoke: vi.fn(),
    verifyWebhook: vi.fn(),
    chargeOnce: chargeImpl,
  }
}

const NOW = new Date('2026-04-20T00:00:00Z')
const BASE = {
  subscriptionId: 'sub_1',
  billingKey: 'bk_1',
  customerKey: 'cus_1',
  customerName: '홍길동',
  customerEmail: 'hong@example.com',
  retriedCount: 0,
  now: NOW,
}

describe('buildOrderId', () => {
  it('멱등키 포맷', () => {
    expect(buildOrderId('sub_1', NOW, 0)).toBe('sub_1-202604-r0')
    expect(buildOrderId('sub_1', NOW, 2)).toBe('sub_1-202604-r2')
  })
})

describe('chargeSubscriptionOnce — 성공', () => {
  it('active + next_charge=+30d, retry=0, notify=none', async () => {
    const adapter = makeAdapter(async () => ({
      success: true,
      orderId: 'sub_1-202604-r0',
      paymentKey: 'pk_1',
      approvedAt: '2026-04-20T00:00:00Z',
    }))

    const r = await chargeSubscriptionOnce(adapter, BASE)
    expect(r.paymentRow.status).toBe('succeeded')
    expect(r.paymentRow.retried_count).toBe(0)
    expect(r.subscriptionPatch.status).toBe('active')
    expect(r.subscriptionPatch.failed_retry_count).toBe(0)
    expect(r.subscriptionPatch.next_charge_at).toBe('2026-05-20T00:00:00.000Z')
    // T-230: 성공 시 'payment.succeeded' 이벤트 emit — cron 이 dispatchNotify 로 이메일 발송.
    expect(r.notify.type).toBe('payment.succeeded')
    if (r.notify.type === 'payment.succeeded') {
      expect(r.notify.chargedAt).toBe('2026-04-20T00:00:00Z')
      expect(r.notify.nextChargeAt).toBe('2026-05-20T00:00:00.000Z')
    }
  })
})

describe('chargeSubscriptionOnce — 재시도 가능 실패', () => {
  it('first fail (retry=0) → past_due + next=+1d + payment.failed', async () => {
    const adapter = makeAdapter(async () => ({
      success: false,
      orderId: 'x',
      error: { code: 'NOT_ENOUGH_BALANCE', message: '잔액부족', category: 'insufficient_balance' },
    }))

    const r = await chargeSubscriptionOnce(adapter, BASE)
    expect(r.paymentRow.status).toBe('failed')
    expect(r.subscriptionPatch.status).toBe('past_due')
    expect(r.subscriptionPatch.failed_retry_count).toBe(1)
    expect(r.subscriptionPatch.next_charge_at).toBe('2026-04-21T00:00:00.000Z')
    if (r.notify.type === 'payment.failed') {
      expect(r.notify.nextRetryAt).toBe('2026-04-21T00:00:00.000Z')
      expect(r.notify.failureMessage).toBe('잔액부족')
    } else {
      throw new Error('expected payment.failed notify')
    }
  })

  it('second fail (retry=1) → past_due + next=+3d', async () => {
    const adapter = makeAdapter(async () => ({
      success: false,
      orderId: 'x',
      error: { code: 'LIMIT_OVER', message: '한도초과', category: 'limit_exceeded' },
    }))

    const r = await chargeSubscriptionOnce(adapter, { ...BASE, retriedCount: 1 })
    expect(r.subscriptionPatch.status).toBe('past_due')
    expect(r.subscriptionPatch.failed_retry_count).toBe(2)
    expect(r.subscriptionPatch.next_charge_at).toBe('2026-04-23T00:00:00.000Z')
  })
})

describe('chargeSubscriptionOnce — 재시도 소진', () => {
  it('third fail (retry=2) → suspended + retry_exhausted', async () => {
    const adapter = makeAdapter(async () => ({
      success: false,
      orderId: 'x',
      error: { code: 'NOT_ENOUGH_BALANCE', message: '잔액부족', category: 'insufficient_balance' },
    }))

    const r = await chargeSubscriptionOnce(adapter, { ...BASE, retriedCount: 2 })
    expect(r.subscriptionPatch.status).toBe('suspended')
    expect(r.subscriptionPatch.failed_retry_count).toBe(3)
    expect(r.subscriptionPatch.next_charge_at).toBeNull()
    expect(r.notify.type).toBe('payment.retry_exhausted')
  })
})

describe('chargeSubscriptionOnce — 재등록 필요 (즉시 suspended)', () => {
  it('card_expired → suspended 즉시', async () => {
    const adapter = makeAdapter(async () => ({
      success: false,
      orderId: 'x',
      error: { code: 'EXPIRED_CARD', message: '카드 만료', category: 'card_expired' },
    }))

    const r = await chargeSubscriptionOnce(adapter, BASE)
    expect(r.subscriptionPatch.status).toBe('suspended')
    expect(r.subscriptionPatch.next_charge_at).toBeNull()
    expect(r.notify.type).toBe('payment.retry_exhausted')
  })

  it('invalid_card → suspended 즉시', async () => {
    const adapter = makeAdapter(async () => ({
      success: false,
      orderId: 'x',
      error: { code: 'INVALID_CARD', message: '카드 오류', category: 'invalid_card' },
    }))

    const r = await chargeSubscriptionOnce(adapter, BASE)
    expect(r.subscriptionPatch.status).toBe('suspended')
  })
})

describe('chargeSubscriptionOnce — orderId 멱등성', () => {
  it('동일 subId+월+retry 는 동일 orderId', async () => {
    let captured = ''
    const adapter = makeAdapter(async (input) => {
      captured = input.orderId
      return { success: true, orderId: input.orderId, paymentKey: 'pk', approvedAt: '2026-04-20T00:00:00Z' }
    })

    await chargeSubscriptionOnce(adapter, BASE)
    expect(captured).toBe('sub_1-202604-r0')
  })
})
