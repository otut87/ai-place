import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  maskCardNumber,
  parseCardExpiry,
  getTossSecretKey,
  getTossClientKey,
  isUsingTossTestKey,
  tossAdapter,
} from '@/lib/billing/toss'

describe('maskCardNumber', () => {
  it('16자리 정상 마스킹', () => {
    expect(maskCardNumber('1234567890123456')).toBe('1234-****-****-3456')
  })

  it('대시 포함 입력 정규화', () => {
    expect(maskCardNumber('1234-5678-9012-3456')).toBe('1234-****-****-3456')
  })

  it('null/undefined/짧음', () => {
    expect(maskCardNumber(null)).toBeUndefined()
    expect(maskCardNumber(undefined)).toBeUndefined()
    expect(maskCardNumber('1234')).toBe('1234')
  })
})

describe('parseCardExpiry', () => {
  it('YYMM → 2000+YY, MM', () => {
    expect(parseCardExpiry('2812')).toEqual([2028, 12])
  })

  it('잘못된 월 → undefined', () => {
    expect(parseCardExpiry('2813')).toEqual([undefined, undefined])
    expect(parseCardExpiry('2800')).toEqual([undefined, undefined])
  })

  it('null/짧음 → undefined', () => {
    expect(parseCardExpiry(null)).toEqual([undefined, undefined])
    expect(parseCardExpiry('28')).toEqual([undefined, undefined])
  })
})

describe('키 우선순위', () => {
  const ORIGINAL_SECRET = process.env.TOSS_SECRET_KEY
  const ORIGINAL_CLIENT = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) delete process.env.TOSS_SECRET_KEY
    else process.env.TOSS_SECRET_KEY = ORIGINAL_SECRET
    if (ORIGINAL_CLIENT === undefined) delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    else process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY = ORIGINAL_CLIENT
  })

  it('env 미설정 → 공개 테스트키 사용', () => {
    delete process.env.TOSS_SECRET_KEY
    delete process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY
    expect(getTossSecretKey()).toMatch(/^test_sk_/)
    expect(getTossClientKey()).toMatch(/^test_ck_/)
    expect(isUsingTossTestKey()).toBe(true)
  })

  it('env 설정 → env 우선', () => {
    process.env.TOSS_SECRET_KEY = 'live_sk_abc'
    expect(getTossSecretKey()).toBe('live_sk_abc')
    expect(isUsingTossTestKey()).toBe(false)
  })

  it('test_sk_ 프리픽스는 라이브 아님', () => {
    process.env.TOSS_SECRET_KEY = 'test_sk_foo'
    expect(isUsingTossTestKey()).toBe(true)
  })
})

describe('tossAdapter.issueBillingKey (fetch mock)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    delete process.env.TOSS_SECRET_KEY
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('성공 응답', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        billingKey: 'bk_toss_123',
        customerKey: 'cus_1',
        authenticatedAt: '2026-04-20T00:00:00Z',
        cardCompany: '삼성',
        cardNumber: '1234567890123456',
        cardType: '신용',
        method: '카드',
        cardExpiry: '2812',
      }),
    }) as unknown as typeof fetch

    const r = await tossAdapter.issueBillingKey({ authKey: 'a', customerKey: 'cus_1' })
    expect(r.success).toBe(true)
    expect(r.billingKey).toBe('bk_toss_123')
    expect(r.cardNumberMasked).toBe('1234-****-****-3456')
    expect(r.expiryYear).toBe(2028)
    expect(r.expiryMonth).toBe(12)
  })

  it('실패 응답 — 에러 코드/메시지 전달', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ code: 'INVALID_AUTH_KEY', message: '인증 키가 유효하지 않습니다' }),
    }) as unknown as typeof fetch

    const r = await tossAdapter.issueBillingKey({ authKey: 'bad', customerKey: 'cus_1' })
    expect(r.success).toBe(false)
    expect(r.error?.code).toBe('INVALID_AUTH_KEY')
    expect(r.error?.message).toBe('인증 키가 유효하지 않습니다')
  })

  it('네트워크 에러', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const r = await tossAdapter.issueBillingKey({ authKey: 'a', customerKey: 'cus_1' })
    expect(r.success).toBe(false)
    expect(r.error?.code).toBe('NETWORK_ERROR')
  })
})

describe('tossAdapter.chargeOnce (fetch mock)', () => {
  const originalFetch = globalThis.fetch
  const INPUT = {
    billingKey: 'bk_1',
    customerKey: 'cus_1',
    orderId: 'ord_1',
    orderName: '2026-04 구독',
    amount: 33000,
  }

  beforeEach(() => {
    delete process.env.TOSS_SECRET_KEY
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('DONE → 성공', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        paymentKey: 'pk_1',
        orderId: 'ord_1',
        status: 'DONE',
        approvedAt: '2026-04-20T00:00:00Z',
      }),
    }) as unknown as typeof fetch

    const r = await tossAdapter.chargeOnce(INPUT)
    expect(r.success).toBe(true)
    expect(r.paymentKey).toBe('pk_1')
  })

  it('DONE 외 상태 → 실패 + 카테고리', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ paymentKey: 'x', orderId: 'ord_1', status: 'ABORTED' }),
    }) as unknown as typeof fetch

    const r = await tossAdapter.chargeOnce(INPUT)
    expect(r.success).toBe(false)
    expect(r.error?.code).toBe('ABORTED')
  })

  it('HTTP 에러 → classifyFailure 적용', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ code: 'NOT_ENOUGH_BALANCE', message: '잔액 부족' }),
    }) as unknown as typeof fetch

    const r = await tossAdapter.chargeOnce(INPUT)
    expect(r.success).toBe(false)
    expect(r.error?.code).toBe('NOT_ENOUGH_BALANCE')
    expect(r.error?.category).toBe('insufficient_balance')
  })
})

describe('tossAdapter.verifyWebhook', () => {
  const ORIGINAL = process.env.TOSS_WEBHOOK_SECRET

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.TOSS_WEBHOOK_SECRET
    else process.env.TOSS_WEBHOOK_SECRET = ORIGINAL
  })

  it('secret 미설정 → 통과 (개발 모드)', async () => {
    delete process.env.TOSS_WEBHOOK_SECRET
    expect(await tossAdapter.verifyWebhook({ rawBody: '{}', signature: 'x' })).toBe(true)
  })

  it('secret 있음 + 올바른 HMAC → 통과', async () => {
    process.env.TOSS_WEBHOOK_SECRET = 'shhhh'
    const { createHmac } = await import('node:crypto')
    const body = '{"event":"payment.succeeded"}'
    const sig = createHmac('sha256', 'shhhh').update(body).digest('hex')
    expect(await tossAdapter.verifyWebhook({ rawBody: body, signature: sig })).toBe(true)
  })

  it('secret 있음 + 잘못된 서명 → 거부', async () => {
    process.env.TOSS_WEBHOOK_SECRET = 'shhhh'
    expect(await tossAdapter.verifyWebhook({ rawBody: '{}', signature: 'wrong' })).toBe(false)
  })
})
