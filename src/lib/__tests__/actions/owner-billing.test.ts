import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock: table 별 분기 ─────────────────────────────────
const state: {
  customer: { id: string; user_id: string | null; email: string; name: string | null; trial_ends_at: string | null } | null
  billingKeyId: string
  existingActiveCards: Array<{ id: string; is_primary: boolean }>
  existingSubId: string | null
  existingSubStatus: string
  bkInsertError: { message: string } | null
  subInsertError: { message: string } | null
  capturedSubUpdates: Record<string, unknown>[]
  capturedBkInserts: Record<string, unknown>[]
} = {
  customer: null,
  billingKeyId: 'bk-1',
  existingActiveCards: [],
  existingSubId: null,
  existingSubStatus: 'pending',
  bkInsertError: null,
  subInsertError: null,
  capturedSubUpdates: [],
  capturedBkInserts: [],
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'customers') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.customer, error: null }),
            }),
          }),
        }
      }
      if (table === 'billing_keys') {
        // select 에 { count, head } 옵션 주면 Promise<{count, data:null}> 반환 (head mode).
        //   아니면 data 반환. 두 경로 모두 지원.
        return {
          select: (_cols?: string, opts?: { count?: string; head?: boolean }) => {
            const head = opts?.head === true
            const promise = head
              ? Promise.resolve({ count: state.existingActiveCards.length, data: null, error: null })
              : Promise.resolve({ data: state.existingActiveCards, count: null, error: null })
            return {
              eq: () => ({
                eq: () => promise,
                then: (fn: (v: unknown) => unknown) => promise.then(fn),
              }),
            }
          },
          update: () => ({
            eq: () => ({ eq: async () => ({ error: null }) }),
          }),
          insert: (payload: Record<string, unknown>) => {
            state.capturedBkInserts.push(payload)
            return {
              select: () => ({
                single: async () => state.bkInsertError
                  ? { data: null, error: state.bkInsertError }
                  : { data: { id: state.billingKeyId }, error: null },
              }),
            }
          },
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({
                      data: state.existingSubId
                        ? { id: state.existingSubId, status: state.existingSubStatus }
                        : null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
          update: (payload: Record<string, unknown>) => {
            state.capturedSubUpdates.push(payload)
            return { eq: async () => ({ error: null }) }
          },
          insert: () => ({
            select: () => ({
              single: async () => state.subInsertError
                ? { data: null, error: state.subInsertError }
                : { data: { id: 'sub-1' }, error: null },
            }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as Record<string, unknown>
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

const mockIssue = vi.fn()
vi.mock('@/lib/billing/toss', () => ({
  tossAdapter: { issueBillingKey: (args: unknown) => mockIssue(args) },
}))

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: vi.fn(async () => ({ id: 'user-1', email: 'o@test.com' })),
}))

beforeEach(() => {
  state.customer = { id: 'c-1', user_id: 'user-1', email: 'o@test.com', name: null, trial_ends_at: null }
  state.billingKeyId = 'bk-1'
  state.existingSubId = null
  state.existingSubStatus = 'pending'
  state.bkInsertError = null
  state.subInsertError = null
  state.capturedSubUpdates = []
  state.capturedBkInserts = []
  state.existingActiveCards = []
  mockIssue.mockReset().mockResolvedValue({
    success: true,
    billingKey: 'bkey-xyz', method: '카드', cardCompany: 'SHINHAN',
    cardNumberMasked: '123****', cardType: '신용', expiryYear: 2030, expiryMonth: 12,
  })
})

describe('issueBillingKeyAction', () => {
  it('admin null → admin_unavailable', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null as never)
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('admin')
  })

  it('customer 없음 → customer 를 찾을 수 없음', async () => {
    state.customer = null
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('customer')
  })

  it('customer.user_id 불일치 → 본인 정보만', async () => {
    state.customer = { id: 'c-1', user_id: 'other', email: 'x', name: null, trial_ends_at: null }
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('본인')
  })

  it('Toss 발급 실패 → error', async () => {
    mockIssue.mockResolvedValueOnce({ success: false, error: { message: 'toss fail' } })
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
  })

  it('billing_keys insert 실패 → 카드 저장 실패', async () => {
    state.bkInsertError = { message: 'ins fail' }
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('저장')
  })

  it('기존 구독 없음 → subscription 생성 + success', async () => {
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.subscriptionId).toBe('sub-1')
  })

  it('기존 구독 있음 (active) → 업데이트, existing id 재사용', async () => {
    state.existingSubId = 'existing-sub'
    state.existingSubStatus = 'active'
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.subscriptionId).toBe('existing-sub')
  })

  it('past_due 구독 있음 → status=active 로 복구', async () => {
    state.existingSubId = 'pd-sub'
    state.existingSubStatus = 'past_due'
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    const lastUpdate = state.capturedSubUpdates[state.capturedSubUpdates.length - 1]
    expect(lastUpdate.status).toBe('active')
  })

  it('T-220.5: suspended 구독 있음 → status=active 로 재활성화', async () => {
    // 구 코드는 past_due 만 active 로 복구했으나, 실제로는 carried-over suspended 도
    // 카드 재등록 시 재활성화되어야 함. billing-state.ts 에서 suspended 가 active
    // 리스트에서 제외되므로, 영원히 suspended 에 갇히면 사용자 복구 경로 없음.
    state.existingSubId = 'susp-sub'
    state.existingSubStatus = 'suspended'
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    if (r.success) expect(r.subscriptionId).toBe('susp-sub')
    const lastUpdate = state.capturedSubUpdates[state.capturedSubUpdates.length - 1]
    expect(lastUpdate.status).toBe('active')
  })

  it('T-220.5: pending_cancellation 구독 있음 → status 유지 (사용자 해지 의도 존중)', async () => {
    state.existingSubId = 'pc-sub'
    state.existingSubStatus = 'pending_cancellation'
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    const lastUpdate = state.capturedSubUpdates[state.capturedSubUpdates.length - 1]
    expect(lastUpdate.status).toBe('pending_cancellation')
  })

  // T-223.5 — 다중 카드 + primary
  it('T-223.5: 첫 카드는 is_primary=true 로 insert', async () => {
    state.existingActiveCards = []
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    const ins = state.capturedBkInserts[0]
    expect(ins.is_primary).toBe(true)
  })

  it('T-223.5: 2번째 카드는 is_primary=false, 기존 카드 revoke 안 함', async () => {
    state.existingActiveCards = [{ id: 'bk-existing', is_primary: true }]
    state.existingSubId = 'sub-1'
    state.existingSubStatus = 'active'
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
    const ins = state.capturedBkInserts[0]
    expect(ins.is_primary).toBe(false)
    // subscription.billing_key_id 는 기존 primary 유지 — update payload 에 billing_key_id 없어야 함
    const lastUpdate = state.capturedSubUpdates[state.capturedSubUpdates.length - 1]
    expect(lastUpdate).not.toHaveProperty('billing_key_id')
  })

  it('trial_ends_at 이 미래 → next_charge_at=trial_ends_at (타임스탬프 로직 검증)', async () => {
    state.customer = {
      id: 'c-1', user_id: 'user-1', email: 'o@test.com', name: null,
      trial_ends_at: new Date(Date.now() + 10 * 86_400_000).toISOString(),
    }
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(true)
  })

  it('subscription insert 실패 → 구독 생성 실패', async () => {
    state.subInsertError = { message: 'sub fail' }
    const { issueBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await issueBillingKeyAction({ authKey: 'a', customerKey: 'c-1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('구독')
  })
})

describe('revokeBillingKeyAction', () => {
  it('admin null → admin_unavailable', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null as never)
    const { revokeBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await revokeBillingKeyAction()
    expect(r.success).toBe(false)
  })

  it('customer 없음 → 고객 정보 없음', async () => {
    state.customer = null
    const { revokeBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await revokeBillingKeyAction()
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('고객')
  })

  it('정상 해지 → success', async () => {
    const { revokeBillingKeyAction } = await import('@/lib/actions/owner-billing')
    const r = await revokeBillingKeyAction()
    expect(r.success).toBe(true)
  })
})

// T-223.5 — 카드 선등록 게이트 헬퍼.
describe('hasActiveBillingKey', () => {
  it('customer 없음 → false', async () => {
    state.customer = null
    const { hasActiveBillingKey } = await import('@/lib/actions/owner-billing')
    expect(await hasActiveBillingKey('user-1')).toBe(false)
  })

  it('admin null → false (안전하게 차단)', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null as never)
    const { hasActiveBillingKey } = await import('@/lib/actions/owner-billing')
    expect(await hasActiveBillingKey('user-1')).toBe(false)
  })

  it('active 카드 1장 이상 → true', async () => {
    state.existingActiveCards = [{ id: 'bk-1', is_primary: true }]
    const { hasActiveBillingKey } = await import('@/lib/actions/owner-billing')
    expect(await hasActiveBillingKey('user-1')).toBe(true)
  })

  it('active 카드 0장 → false', async () => {
    state.existingActiveCards = []
    const { hasActiveBillingKey } = await import('@/lib/actions/owner-billing')
    expect(await hasActiveBillingKey('user-1')).toBe(false)
  })
})
