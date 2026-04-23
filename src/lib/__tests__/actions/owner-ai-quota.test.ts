// T-218 — getOwnerAiQuota 액션 단위 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: vi.fn(async () => ({ id: 'user-1', email: 'o@test.com' })),
}))

const mockMaybeSingle = vi.fn()
const mockEq = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

const mockCheckAiRateLimit = vi.fn()
vi.mock('@/lib/ai/owner-generate', () => ({
  checkAiRateLimit: (id: string) => mockCheckAiRateLimit(id),
}))

beforeEach(() => {
  mockMaybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
  mockCheckAiRateLimit.mockReset()
  mockFrom.mockClear()
})

describe('getOwnerAiQuota', () => {
  it('admin null → null', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { getOwnerAiQuota } = await import('@/lib/actions/owner-ai-quota')
    const r = await getOwnerAiQuota('place-1')
    expect(r).toBeNull()
  })

  it('place 없음 → null', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { getOwnerAiQuota } = await import('@/lib/actions/owner-ai-quota')
    const r = await getOwnerAiQuota('place-1')
    expect(r).toBeNull()
  })

  it('다른 오너 place → null', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null })
    const { getOwnerAiQuota } = await import('@/lib/actions/owner-ai-quota')
    const r = await getOwnerAiQuota('place-1')
    expect(r).toBeNull()
  })

  it('본인 place → checkAiRateLimit 호출 결과 반환', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { owner_id: 'user-1' }, error: null })
    mockCheckAiRateLimit.mockResolvedValueOnce({
      allowed: true, monthlyLimit: 5, monthlyUsed: 2, remainingHours: 0, reason: null,
    })
    const { getOwnerAiQuota } = await import('@/lib/actions/owner-ai-quota')
    const r = await getOwnerAiQuota('place-1')
    expect(r?.monthlyUsed).toBe(2)
    expect(mockCheckAiRateLimit).toHaveBeenCalledWith('place-1')
  })

  it('owner_id null 이면 (legacy) 허용', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { owner_id: null }, error: null })
    mockCheckAiRateLimit.mockResolvedValueOnce({
      allowed: true, monthlyLimit: 5, monthlyUsed: 0, remainingHours: 0, reason: null,
    })
    const { getOwnerAiQuota } = await import('@/lib/actions/owner-ai-quota')
    const r = await getOwnerAiQuota('place-1')
    expect(r?.allowed).toBe(true)
  })
})
