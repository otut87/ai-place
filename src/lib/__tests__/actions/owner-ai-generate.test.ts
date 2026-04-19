// T-155·T-156·T-157 — Owner AI 생성 액션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireOwner = vi.fn()
const mockFrom = vi.fn()
const mockCheckRateLimit = vi.fn()
const mockGenerate = vi.fn()

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: () => mockRequireOwner(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/ai/owner-generate', () => ({
  checkAiRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
  generateOwnerDraft: (...a: unknown[]) => mockGenerate(...a),
}))
vi.mock('@/lib/data.supabase', () => ({
  getCities: async () => [{ slug: 'cheonan', name: '천안', nameEn: 'Cheonan' }],
  getCategories: async () => [{ slug: 'medical', name: '의료', sector: 'medical' }],
}))

beforeEach(() => {
  mockRequireOwner.mockReset()
  mockFrom.mockReset()
  mockCheckRateLimit.mockReset()
  mockGenerate.mockReset()
  mockRequireOwner.mockResolvedValue({ id: 'u1', email: 'o@x.com' })
})

describe('ownerGenerateAiAction', () => {
  it('프리뷰 (placeId 없음) → rate limit 스킵', async () => {
    mockGenerate.mockResolvedValue({
      success: true,
      output: { description: 'd', tags: [], services: [], recommendedFor: [], strengths: [] },
      usage: { input: 100, output: 200 },
    })
    const { ownerGenerateAiAction } = await import('@/lib/actions/owner-ai-generate')
    const r = await ownerGenerateAiAction({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(true)
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('업체 없음 → 실패', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    })
    const { ownerGenerateAiAction } = await import('@/lib/actions/owner-ai-generate')
    const r = await ownerGenerateAiAction({ placeId: 'p-missing', name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/업체/)
  })

  it('다른 유저 소유 → 실패', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { owner_id: 'other-u', customer_id: null } }) }) }),
    })
    const { ownerGenerateAiAction } = await import('@/lib/actions/owner-ai-generate')
    const r = await ownerGenerateAiAction({ placeId: 'p1', name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/본인/)
  })

  it('rate limit 월간 소진 → 실패 + reason=monthly', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { owner_id: 'u1', customer_id: 'c1' } }) }) }),
    })
    mockCheckRateLimit.mockResolvedValue({ allowed: false, reason: 'monthly', monthlyUsed: 5, monthlyLimit: 5, nextAllowedAt: null, remainingHours: 0 })
    const { ownerGenerateAiAction } = await import('@/lib/actions/owner-ai-generate')
    const r = await ownerGenerateAiAction({ placeId: 'p1', name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/한도/)
    expect(r.rateLimit?.reason).toBe('monthly')
  })

  it('정상 → output + 갱신된 rateLimit', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { owner_id: 'u1', customer_id: 'c1' } }) }) }),
    })
    mockCheckRateLimit
      .mockResolvedValueOnce({ allowed: true, monthlyUsed: 2, monthlyLimit: 5, nextAllowedAt: null, remainingHours: 0 })
      .mockResolvedValueOnce({ allowed: false, reason: 'weekly', monthlyUsed: 3, monthlyLimit: 5, nextAllowedAt: '', remainingHours: 168 })
    mockGenerate.mockResolvedValue({
      success: true,
      output: { description: 'new', tags: ['a'], services: [], recommendedFor: [], strengths: [] },
      usage: { input: 100, output: 200 },
    })
    const { ownerGenerateAiAction } = await import('@/lib/actions/owner-ai-generate')
    const r = await ownerGenerateAiAction({ placeId: 'p1', name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.output.description).toBe('new')
      expect(r.rateLimit.monthlyUsed).toBe(3)
    }
  })
})
