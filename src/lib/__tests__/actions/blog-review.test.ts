import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(async () => ({ id: 'admin-1' })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  mockEq.mockReset()
  mockFrom.mockReset()
  mockEq.mockResolvedValue({ error: null })
  mockFrom.mockImplementation(() => ({
    update: vi.fn(() => ({ eq: mockEq })),
  }))
})

describe('approveBlogPost', () => {
  it('빈 slug → 에러', async () => {
    const { approveBlogPost } = await import('@/lib/actions/blog-review')
    expect((await approveBlogPost('')).success).toBe(false)
  })

  it('admin null → 에러', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { approveBlogPost } = await import('@/lib/actions/blog-review')
    expect((await approveBlogPost('x')).success).toBe(false)
  })

  it('정상 → status=active 로 업데이트', async () => {
    const { approveBlogPost } = await import('@/lib/actions/blog-review')
    const r = await approveBlogPost('my-post')
    expect(r.success).toBe(true)
  })

  it('DB 에러 → 실패', async () => {
    mockEq.mockResolvedValueOnce({ error: { message: 'x' } })
    const { approveBlogPost } = await import('@/lib/actions/blog-review')
    expect((await approveBlogPost('x')).success).toBe(false)
  })
})

describe('rejectBlogPost', () => {
  it('잘못된 reason → 에러', async () => {
    const { rejectBlogPost } = await import('@/lib/actions/blog-review')
    // @ts-expect-error — 테스트 목적
    expect((await rejectBlogPost({ slug: 'x', reason: 'bad' })).success).toBe(false)
  })

  it('정상 반려', async () => {
    const { rejectBlogPost } = await import('@/lib/actions/blog-review')
    const r = await rejectBlogPost({ slug: 'x', reason: 'fact_error', note: 'typo' })
    expect(r.success).toBe(true)
  })

  it('빈 slug → 에러', async () => {
    const { rejectBlogPost } = await import('@/lib/actions/blog-review')
    expect((await rejectBlogPost({ slug: '', reason: 'tone' })).success).toBe(false)
  })
})
