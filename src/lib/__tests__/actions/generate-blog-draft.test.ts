// T-129 — generateBlogDraftAction 서버 액션 얕은 테스트 (DB·LLM 호출 목킹).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireAuth = vi.fn().mockResolvedValue(undefined)
const mockAdmin = {
  from: vi.fn(),
}
const mockGenerateBlogDraft = vi.fn()

vi.mock('@/lib/auth', () => ({ requireAuthForAction: () => mockRequireAuth() }))
vi.mock('@/lib/supabase/admin-client', () => ({ getAdminClient: () => mockAdmin }))
vi.mock('@/lib/data.supabase', () => ({
  getAllPlaces: vi.fn().mockResolvedValue([]),
  getCities: vi.fn().mockResolvedValue([{ slug: 'cheonan', name: '천안시', nameEn: 'Cheonan' }]),
  getSectors: vi.fn().mockResolvedValue([{ slug: 'medical', name: '의료', nameEn: 'Medical' }]),
  getCategories: vi.fn().mockResolvedValue([{ slug: 'dermatology', name: '피부과', sector: 'medical' }]),
}))
vi.mock('@/lib/ai/generate-blog-draft', () => ({
  generateBlogDraft: (...args: unknown[]) => mockGenerateBlogDraft(...args),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockRequireAuth.mockClear()
  mockAdmin.from.mockReset()
  mockGenerateBlogDraft.mockReset()
})

describe('generateBlogDraftAction', () => {
  it('후보 업체 0 → 실패 반환', async () => {
    const { generateBlogDraftAction } = await import('@/lib/actions/generate-blog-draft')
    const r = await generateBlogDraftAction({
      city: 'cheonan', sector: 'medical', category: 'dermatology', postType: 'general',
    })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/후보|업체/)
  })

  it('city 미존재 → 실패', async () => {
    const { generateBlogDraftAction } = await import('@/lib/actions/generate-blog-draft')
    const r = await generateBlogDraftAction({
      city: 'nowhere', sector: 'medical', postType: 'general',
    })
    expect(r.success).toBe(false)
  })
})
