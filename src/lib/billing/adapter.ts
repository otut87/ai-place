// T-071 — PG 어댑터 인터페이스.
// 단일 PG 가정(토스페이먼츠) + mock 폴백으로 키 없이도 테스트 가능.

export interface IssueBillingKeyInput {
  authKey: string                  // 토스 위젯이 발급한 빌링 인증 키
  customerKey: string              // 가맹점 측 고객 식별자 (UUID)
}

export interface BillingKeyResult {
  success: boolean
  billingKey?: string
  cardCompany?: string
  cardNumberMasked?: string        // '1234-****-****-5678'
  cardType?: 'credit' | 'check' | string
  expiryYear?: number
  expiryMonth?: number
  method?: string
  error?: {
    code: string
    message: string
  }
}

export interface ChargeOnceInput {
  billingKey: string
  customerKey: string
  orderId: string                  // 멱등키 (DB 유니크)
  orderName: string                // '2026-04 AI Place 월 구독'
  amount: number                   // 원 단위 (33000)
  customerEmail?: string
  customerName?: string
}

export interface ChargeResult {
  success: boolean
  paymentKey?: string              // 토스 paymentKey
  orderId: string
  approvedAt?: string              // ISO 8601
  /** T-223: Toss receipts.url 등 PG 영수증 URL. 없으면 undefined. */
  receiptUrl?: string
  error?: {
    code: string                   // PG 원 코드 (예: REJECT_CARD_COMPANY)
    message: string                // PG 한글 메시지
    category: FailureCategory      // 정책 재시도 판단용
  }
}

export type FailureCategory =
  | 'insufficient_balance'         // 잔액부족 — 재시도 가치 높음
  | 'card_expired'                 // 만료 — 카드 재등록 필요
  | 'limit_exceeded'               // 한도초과 — 월말 대기
  | 'invalid_card'                 // 카드 오류 — 재등록 필요
  | 'do_not_honor'                 // 카드사 승인 거절 — 재시도
  | 'stolen_or_lost'               // 도난/분실 — 재등록 필요
  | 'other'                        // 알 수 없음

export interface ScheduleNextInput {
  subscriptionId: string
  nextChargeAt: string             // ISO 8601
}

export interface WebhookVerifyInput {
  rawBody: string
  signature: string                // Toss-Signature 등
}

export interface PgAdapter {
  provider: 'toss' | 'mock'
  issueBillingKey(input: IssueBillingKeyInput): Promise<BillingKeyResult>
  chargeOnce(input: ChargeOnceInput): Promise<ChargeResult>
  revoke(billingKey: string): Promise<{ success: boolean; error?: string }>
  verifyWebhook(input: WebhookVerifyInput): Promise<boolean>
}

/**
 * PG 실패 코드를 정책 카테고리로 매핑.
 * 토스페이먼츠 공식 실패 코드 — https://docs.tosspayments.com/reference/error-codes
 * 재시도 가능 여부는 T-073 에서 이 카테고리로 분기.
 */
export function classifyFailure(code: string | null | undefined): FailureCategory {
  if (!code) return 'other'
  const normalized = code.toUpperCase()

  if (normalized.includes('NOT_ENOUGH_BALANCE') || normalized.includes('INSUFFICIENT')) {
    return 'insufficient_balance'
  }
  if (normalized.includes('EXPIRED') || normalized.includes('EXPIRE_DATE')) {
    return 'card_expired'
  }
  if (normalized.includes('EXCEED') || normalized.includes('LIMIT')) {
    return 'limit_exceeded'
  }
  if (normalized.includes('STOLEN') || normalized.includes('LOST')) {
    return 'stolen_or_lost'
  }
  if (
    normalized.includes('INVALID_CARD') ||
    normalized.includes('NOT_REGISTERED') ||
    normalized.includes('NOT_SUPPORTED') ||
    normalized.includes('INVALID_NUMBER')
  ) {
    return 'invalid_card'
  }
  if (normalized.includes('REJECT') || normalized.includes('DO_NOT_HONOR')) {
    return 'do_not_honor'
  }
  return 'other'
}

/** FailureCategory → 재시도 여부. invalid_card / card_expired / stolen_or_lost 는 재등록 필요. */
export function isRetryableFailure(category: FailureCategory): boolean {
  return category === 'insufficient_balance'
      || category === 'limit_exceeded'
      || category === 'do_not_honor'
      || category === 'other'
}

/**
 * 재시도 일정 오프셋 (일 단위). retriedCount=0 → 첫 시도 직후 재시도 = +1d.
 * 3회 실패 시 구독 suspended 처리.
 */
export const RETRY_SCHEDULE_DAYS = [1, 3, 7] as const

export function nextRetryAt(retriedCount: number, from: Date = new Date()): Date | null {
  const offset = RETRY_SCHEDULE_DAYS[retriedCount]
  if (offset === undefined) return null
  const next = new Date(from)
  next.setDate(next.getDate() + offset)
  return next
}
