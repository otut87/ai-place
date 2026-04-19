import { describe, it, expect, vi, beforeEach } from 'vitest'
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

// ── listBillingFailures ─────────────────────────────
const mockLimit = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockFrom.mockReset()

  mockLimit.mockResolvedValue({
    data: [
      {
        id: 'pay-1',
        amount: 33000,
        pg_response_code: 'NOT_ENOUGH_BALANCE',
        pg_response_message: '잔액 부족',
        retried_count: 0,
        attempted_at: '2026-04-20T00:00:00Z',
        subscription_id: 'sub-1',
        subscriptions: {
          status: 'past_due',
          next_charge_at: '2026-04-21T00:00:00Z',
          failed_retry_count: 1,
          customer_id: 'cus-1',
          customers: { name: '홍길동', email: 'hong@example.com' },
        },
      },
      {
        id: 'pay-2',
        amount: 33000,
        pg_response_code: null,
        pg_response_message: null,
        retried_count: 0,
        attempted_at: '2026-04-19T00:00:00Z',
        subscription_id: 'sub-2',
        subscriptions: null,     // 필터 대상
      },
    ],
    error: null,
  })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({ limit: mockLimit })),
      })),
    })),
  }))
})

describe('listBillingFailures', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listBillingFailures } = await import('@/lib/admin/billing-failures')
    expect(await listBillingFailures()).toEqual([])
  })

  it('subscriptions null 인 행 제외', async () => {
    const { listBillingFailures } = await import('@/lib/admin/billing-failures')
    const r = await listBillingFailures()
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('pay-1')
    expect(r[0].category).toBe('insufficient_balance')
  })

  it('DB 에러 → []', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { listBillingFailures } = await import('@/lib/admin/billing-failures')
    expect(await listBillingFailures()).toEqual([])
  })
})
