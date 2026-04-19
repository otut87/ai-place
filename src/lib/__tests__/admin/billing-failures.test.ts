import { describe, it, expect } from 'vitest'
import {
  FAILURE_CATEGORY_LABEL,
  badgeToneForSubscription,
} from '@/lib/admin/billing-failures'

describe('FAILURE_CATEGORY_LABEL', () => {
  it('모든 카테고리 한국어 매핑', () => {
    expect(FAILURE_CATEGORY_LABEL.insufficient_balance).toBe('잔액 부족')
    expect(FAILURE_CATEGORY_LABEL.card_expired).toBe('카드 만료')
    expect(FAILURE_CATEGORY_LABEL.limit_exceeded).toBe('한도 초과')
    expect(FAILURE_CATEGORY_LABEL.invalid_card).toBe('카드 오류')
    expect(FAILURE_CATEGORY_LABEL.do_not_honor).toBe('카드사 승인 거절')
    expect(FAILURE_CATEGORY_LABEL.stolen_or_lost).toBe('도난/분실')
    expect(FAILURE_CATEGORY_LABEL.other).toBe('기타')
  })
})

describe('badgeToneForSubscription', () => {
  it('past_due → warn', () => {
    expect(badgeToneForSubscription('past_due')).toBe('warn')
  })

  it('suspended → danger', () => {
    expect(badgeToneForSubscription('suspended')).toBe('danger')
    expect(badgeToneForSubscription('canceled')).toBe('danger')
  })

  it('active/기타 → ok', () => {
    expect(badgeToneForSubscription('active')).toBe('ok')
    expect(badgeToneForSubscription('pending')).toBe('ok')
  })
})
