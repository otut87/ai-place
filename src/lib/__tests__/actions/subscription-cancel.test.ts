// T-174 — 구독 취소 액션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireOwner = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: () => mockRequireOwner(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockRequireOwner.mockReset()
  mockFrom.mockReset()
  mockRequireOwner.mockResolvedValue({ id: 'u1', email: 'o@x.com' })
})

function mockSub(sub: Record<string, unknown> | null, updateError: unknown = null) {
  const updateEq = vi.fn().mockResolvedValue({ error: updateError })
  const insertThen = vi.fn().mockResolvedValue({ error: null })
  mockFrom.mockImplementation((table: string) => {
    if (table === 'subscriptions') return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: sub }) }) }),
      update: () => ({ eq: updateEq }),
    }
    if (table === 'subscription_events') return {
      insert: () => ({ then: insertThen, catch: () => insertThen() }),
    }
    return {}
  })
  return { updateEq }
}

describe('cancelSubscriptionAction', () => {
  it('구독 없음 → 실패', async () => {
    mockSub(null)
    const { cancelSubscriptionAction } = await import('@/lib/actions/subscription-cancel')
    const r = await cancelSubscriptionAction({ subscriptionId: 'x', mode: 'immediate' })
    expect(r.success).toBe(false)
  })

  it('다른 유저 구독 → 실패', async () => {
    mockSub({
      id: 's1', customer_id: 'c1', status: 'active', next_charge_at: '2026-05-01',
      customers: { user_id: 'other' },
    })
    const { cancelSubscriptionAction } = await import('@/lib/actions/subscription-cancel')
    const r = await cancelSubscriptionAction({ subscriptionId: 's1', mode: 'immediate' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/본인/)
  })

  it('이미 취소된 구독 → 실패', async () => {
    mockSub({
      id: 's1', customer_id: 'c1', status: 'cancelled', next_charge_at: null,
      customers: { user_id: 'u1' },
    })
    const { cancelSubscriptionAction } = await import('@/lib/actions/subscription-cancel')
    const r = await cancelSubscriptionAction({ subscriptionId: 's1', mode: 'immediate' })
    expect(r.success).toBe(false)
  })

  it('즉시 해지 → status cancelled', async () => {
    const { updateEq } = mockSub({
      id: 's1', customer_id: 'c1', status: 'active', next_charge_at: '2026-05-01',
      customers: [{ user_id: 'u1' }],
    })
    const { cancelSubscriptionAction } = await import('@/lib/actions/subscription-cancel')
    const r = await cancelSubscriptionAction({ subscriptionId: 's1', mode: 'immediate' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.mode).toBe('immediate')
    expect(updateEq).toHaveBeenCalled()
  })

  it('기간 만료 후 해지 → status pending_cancellation', async () => {
    const { updateEq } = mockSub({
      id: 's1', customer_id: 'c1', status: 'active', next_charge_at: '2026-05-15T00:00:00Z',
      customers: { user_id: 'u1' },
    })
    const { cancelSubscriptionAction } = await import('@/lib/actions/subscription-cancel')
    const r = await cancelSubscriptionAction({ subscriptionId: 's1', mode: 'end_of_period' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.mode).toBe('end_of_period')
      expect(r.effectiveDate).toBe('2026-05-15T00:00:00Z')
    }
    expect(updateEq).toHaveBeenCalled()
  })
})
