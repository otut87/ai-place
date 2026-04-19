// T-074 — 카드 만료 임박 스캔·알림.
// 정책: 만료 30일 전 1회 + 7일 전 1회 이메일.
// 판단은 expiry_year/month 기준으로 "월 말일" 에 만료된다고 가정.

import type { DbBillingKey } from './types'

export const EXPIRY_WARNING_DAYS = [30, 7] as const
export type WarningDay = (typeof EXPIRY_WARNING_DAYS)[number]

/**
 * 카드 만료일(해당 월 말일)까지 남은 일수.
 * 만료월이 없으면 null.
 */
export function daysUntilCardExpiry(
  card: Pick<DbBillingKey, 'expiry_year' | 'expiry_month'>,
  now: Date = new Date(),
): number | null {
  if (!card.expiry_year || !card.expiry_month) return null
  // 만료월 다음 달 1일 0시 - 1 ms = 해당 월 마지막 순간
  const expiry = new Date(Date.UTC(card.expiry_year, card.expiry_month, 1, 0, 0, 0)).getTime() - 1
  const diffMs = expiry - now.getTime()
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000))
}

/**
 * 오늘(now) 이 30일 혹은 7일 임계를 "처음 넘는 날" 인지 판정.
 * diff === 30 또는 diff === 7 일 때만 true (하루 지나면 31·8 로 다시 판정 실패 → 중복 발송 방지).
 *
 * Cron 이 매일 실행된다는 전제 하에 하루 한 번만 히트.
 */
export function warningDayForToday(daysLeft: number): WarningDay | null {
  if (daysLeft === 30) return 30
  if (daysLeft === 7) return 7
  return null
}

export interface ExpiryCandidate {
  billingKeyId: string
  customerId: string
  customerName: string | null
  customerEmail: string | null
  cardCompany: string | null
  cardNumberMasked: string | null
  daysLeft: number
  warningDay: WarningDay
}
