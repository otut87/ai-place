// T-071 — mock PG 어댑터. TOSS_SECRET_KEY 가 없어도 개발·테스트 통과.
// 토스 공개 테스트키가 있는 toss.ts 와 달리, 여기는 **완전 오프라인** 모드.
// 환경변수 `BILLING_ADAPTER=mock` 으로 강제할 수 있음.

import { classifyFailure, type ChargeOnceInput, type ChargeResult, type PgAdapter } from './adapter'

/**
 * orderId 접미로 가짜 실패를 유도하는 프리픽스:
 *   - 끝이 '-fail-balance' → 잔액부족
 *   - 끝이 '-fail-expired' → 카드 만료
 *   - 끝이 '-fail-limit'   → 한도초과
 *   - 그 외                → 성공
 */
function deriveMockFailure(orderId: string): { code: string; message: string } | null {
  if (orderId.endsWith('-fail-balance')) return { code: 'NOT_ENOUGH_BALANCE', message: '잔액이 부족합니다' }
  if (orderId.endsWith('-fail-expired')) return { code: 'EXPIRED_CARD', message: '카드가 만료되었습니다' }
  if (orderId.endsWith('-fail-limit'))  return { code: 'EXCEED_MAX_AMOUNT', message: '승인한도를 초과했습니다' }
  if (orderId.endsWith('-fail-stolen')) return { code: 'STOLEN_CARD', message: '도난 카드입니다' }
  return null
}

export const mockAdapter: PgAdapter = {
  provider: 'mock',

  async issueBillingKey({ customerKey }) {
    return {
      success: true,
      billingKey: `mock_bk_${customerKey}_${Date.now()}`,
      cardCompany: '삼성',
      cardNumberMasked: '1234-****-****-5678',
      cardType: 'credit',
      method: '카드',
      expiryYear: new Date().getFullYear() + 3,
      expiryMonth: 12,
    }
  },

  async chargeOnce(input: ChargeOnceInput): Promise<ChargeResult> {
    const fail = deriveMockFailure(input.orderId)
    if (fail) {
      return {
        success: false,
        orderId: input.orderId,
        error: { ...fail, category: classifyFailure(fail.code) },
      }
    }
    return {
      success: true,
      orderId: input.orderId,
      paymentKey: `mock_pk_${Date.now()}`,
      approvedAt: new Date().toISOString(),
    }
  },

  async revoke() {
    return { success: true }
  },

  async verifyWebhook() {
    return true
  },
}
