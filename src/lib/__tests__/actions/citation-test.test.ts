// T-140 — Owner citation test server action 테스트 (가드 경로 위주).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireOwner = vi.fn()
const mockFrom = vi.fn()
const mockHasActiveSub = vi.fn()
const mockCheckRateLimit = vi.fn()

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: () => mockRequireOwner(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/diagnostic/citation-test', () => ({
  hasActiveSubscription: (...a: unknown[]) => mockHasActiveSub(...a),
  checkCitationTestRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
  buildCitationQueries: () => ['q1'],
}))
vi.mock('@/lib/ai/llm-engines', () => ({
  callChatGPT: vi.fn().mockResolvedValue(''),
  callClaude: vi.fn().mockResolvedValue(''),
  callGemini: vi.fn().mockResolvedValue(''),
  isPlaceCited: vi.fn().mockReturnValue(false),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockRequireOwner.mockReset()
  mockFrom.mockReset()
  mockHasActiveSub.mockReset()
  mockCheckRateLimit.mockReset()
  mockRequireOwner.mockResolvedValue({ id: 'u1', email: 'o@x.com' })
})

function mockPlaceFetch(place: Record<string, unknown> | null, customer: Record<string, unknown> | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'places') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: place }) }) }) }
    if (table === 'customers') return { select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: customer }) }) }) }
    return {
      insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: 't1' } }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
  })
}

describe('runCitationTestAction', () => {
  it('업체 없음 → 실패', async () => {
    mockPlaceFetch(null, null)
    const { runCitationTestAction } = await import('@/lib/actions/citation-test')
    const r = await runCitationTestAction('missing')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/찾을 수 없/)
  })

  it('customer_id 없음 → 실패', async () => {
    mockPlaceFetch({ id: 'p1', name: 'x', city: 'c', category: 'd', slug: 's', customer_id: null }, null)
    const { runCitationTestAction } = await import('@/lib/actions/citation-test')
    const r = await runCitationTestAction('p1')
    expect(r.success).toBe(false)
  })

  it('다른 유저 소유 → 실패', async () => {
    mockPlaceFetch(
      { id: 'p1', name: 'x', city: 'c', category: 'd', slug: 's', customer_id: 'c1' },
      { user_id: 'other-user' },
    )
    const { runCitationTestAction } = await import('@/lib/actions/citation-test')
    const r = await runCitationTestAction('p1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/권한/)
  })

  it('구독 비활성 → 실패', async () => {
    mockPlaceFetch(
      { id: 'p1', name: 'x', city: 'c', category: 'd', slug: 's', customer_id: 'c1' },
      { user_id: 'u1' },
    )
    mockHasActiveSub.mockResolvedValue(false)
    const { runCitationTestAction } = await import('@/lib/actions/citation-test')
    const r = await runCitationTestAction('p1')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/구독/)
  })

  it('rate limit 걸림 → 실패 + remainingHours', async () => {
    mockPlaceFetch(
      { id: 'p1', name: 'x', city: 'c', category: 'd', slug: 's', customer_id: 'c1' },
      { user_id: 'u1' },
    )
    mockHasActiveSub.mockResolvedValue(true)
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remainingHours: 48, nextAllowedAt: 'iso' })
    const { runCitationTestAction } = await import('@/lib/actions/citation-test')
    const r = await runCitationTestAction('p1')
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.remainingHours).toBe(48)
      expect(r.error).toMatch(/48/)
    }
  })
})
