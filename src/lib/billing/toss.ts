// T-071 — 토스페이먼츠 PG 어댑터 (정기결제 / 빌링키).
// 가입 없이 사용 가능한 공개 테스트키를 fallback 으로 사용 — docs.tosspayments.com.
//
// 레퍼런스:
//   빌링 인증키 → 빌링키 교환:
//     POST https://api.tosspayments.com/v1/billing/authorizations/issue
//   빌링키로 결제:
//     POST https://api.tosspayments.com/v1/billing/{billingKey}
//   인증: Basic Buffer.from(`${secretKey}:`).toString('base64')
//
// 키 우선순위: TOSS_SECRET_KEY env > 공개 테스트키 (개발용).

import {
  classifyFailure,
  type BillingKeyResult,
  type ChargeOnceInput,
  type ChargeResult,
  type IssueBillingKeyInput,
  type PgAdapter,
  type WebhookVerifyInput,
} from './adapter'

// docs.tosspayments.com 공개 테스트키 — 누구나 사용 가능, 실제 승인은 일어나지 않음.
const PUBLIC_TEST_SECRET_KEY = 'test_sk_Z1aOwX7K8mOMjAxDpg8xrJyEwyAQ'
const PUBLIC_TEST_CLIENT_KEY = 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq'
const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

export function getTossSecretKey(): string {
  return process.env.TOSS_SECRET_KEY ?? PUBLIC_TEST_SECRET_KEY
}

export function getTossClientKey(): string {
  return process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? PUBLIC_TEST_CLIENT_KEY
}

/** 테스트키 사용 중 여부 (UI 배너·어드민 표시용). 실서비스는 `live_sk_` 프리픽스. */
export function isUsingTossTestKey(): boolean {
  return getTossSecretKey().startsWith('test_sk_')
}

function basicAuthHeader(): string {
  const secret = getTossSecretKey()
  return 'Basic ' + Buffer.from(`${secret}:`).toString('base64')
}

interface TossErrorBody {
  code?: string
  message?: string
}

interface TossBillingResponse {
  billingKey: string
  customerKey: string
  authenticatedAt: string
  method?: string
  cardCompany?: string
  cardNumber?: string                 // '1234****...'
  cardType?: string                   // '신용' | '체크'
  card?: {
    issuerCode?: string
    acquirerCode?: string
    number?: string
    cardType?: string
  }
  // 만료 년월은 응답에 따라 'YYMM' 혹은 별도 필드
  cardExpiry?: string                 // 'YYMM'
}

interface TossChargeResponse {
  paymentKey: string
  orderId: string
  status: string                      // 'DONE' | 'ABORTED' | 'EXPIRED' ...
  approvedAt?: string
}

async function parseErrorBody(res: Response): Promise<TossErrorBody> {
  try {
    return (await res.json()) as TossErrorBody
  } catch {
    return {}
  }
}

export const tossAdapter: PgAdapter = {
  provider: 'toss',

  async issueBillingKey({ authKey, customerKey }: IssueBillingKeyInput): Promise<BillingKeyResult> {
    try {
      const res = await fetch(`${TOSS_API_BASE}/billing/authorizations/issue`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ authKey, customerKey }),
      })

      if (!res.ok) {
        const err = await parseErrorBody(res)
        return {
          success: false,
          error: { code: err.code ?? `HTTP_${res.status}`, message: err.message ?? res.statusText },
        }
      }

      const data = (await res.json()) as TossBillingResponse
      const [yy, mm] = parseCardExpiry(data.cardExpiry)
      return {
        success: true,
        billingKey: data.billingKey,
        cardCompany: data.cardCompany ?? data.card?.issuerCode,
        cardNumberMasked: maskCardNumber(data.cardNumber ?? data.card?.number),
        cardType: data.cardType ?? data.card?.cardType,
        method: data.method ?? '카드',
        expiryYear: yy,
        expiryMonth: mm,
      }
    } catch (e) {
      return {
        success: false,
        error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : 'unknown' },
      }
    }
  },

  async chargeOnce(input: ChargeOnceInput): Promise<ChargeResult> {
    try {
      const res = await fetch(`${TOSS_API_BASE}/billing/${encodeURIComponent(input.billingKey)}`, {
        method: 'POST',
        headers: {
          Authorization: basicAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerKey: input.customerKey,
          orderId: input.orderId,
          orderName: input.orderName,
          amount: input.amount,
          customerEmail: input.customerEmail,
          customerName: input.customerName,
        }),
      })

      if (!res.ok) {
        const err = await parseErrorBody(res)
        const code = err.code ?? `HTTP_${res.status}`
        return {
          success: false,
          orderId: input.orderId,
          error: {
            code,
            message: err.message ?? res.statusText,
            category: classifyFailure(code),
          },
        }
      }

      const data = (await res.json()) as TossChargeResponse
      if (data.status !== 'DONE') {
        return {
          success: false,
          orderId: input.orderId,
          error: {
            code: data.status,
            message: `승인되지 않음 (${data.status})`,
            category: classifyFailure(data.status),
          },
        }
      }

      return {
        success: true,
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        approvedAt: data.approvedAt,
      }
    } catch (e) {
      return {
        success: false,
        orderId: input.orderId,
        error: {
          code: 'NETWORK_ERROR',
          message: e instanceof Error ? e.message : 'unknown',
          category: 'other',
        },
      }
    }
  },

  async revoke(_billingKey: string) {
    // 토스페이먼츠는 빌링키 해지 API 를 노출하지 않음 (가맹점에서 논리 삭제).
    // DB status='revoked' 처리만 하면 됨 — 실제 해지는 고객이 카드사 측에서 처리.
    return { success: true }
  },

  async verifyWebhook({ rawBody, signature }: WebhookVerifyInput) {
    const secret = process.env.TOSS_WEBHOOK_SECRET
    if (!secret) {
      // secret 미설정 — 개발 환경에서는 통과, 프로덕션 배포 전 설정 필요
      return true
    }
    try {
      const { createHmac } = await import('node:crypto')
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex')
      return timingSafeEqual(expected, signature)
    } catch {
      return false
    }
  },
}

export function maskCardNumber(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return raw
  const first = digits.slice(0, 4)
  const last = digits.slice(-4)
  return `${first}-****-****-${last}`
}

export function parseCardExpiry(raw: string | undefined | null): [number | undefined, number | undefined] {
  if (!raw) return [undefined, undefined]
  const digits = raw.replace(/\D/g, '')
  if (digits.length !== 4) return [undefined, undefined]
  const yy = Number.parseInt(digits.slice(0, 2), 10)
  const mm = Number.parseInt(digits.slice(2, 4), 10)
  if (!Number.isFinite(yy) || !Number.isFinite(mm)) return [undefined, undefined]
  if (mm < 1 || mm > 12) return [undefined, undefined]
  return [2000 + yy, mm]
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
