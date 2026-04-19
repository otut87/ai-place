import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateEq = vi.fn()
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
  mockUpdateEq.mockReset()
  mockFrom.mockReset()
  mockUpdateEq.mockResolvedValue({ error: null })
  mockFrom.mockImplementation(() => ({
    update: vi.fn(() => ({ eq: mockUpdateEq })),
  }))
})

describe('saveBlogPost', () => {
  const BASE = {
    slug: 'test-post', title: 'Title', summary: 'S', content: 'C',
    category: 'dermatology', status: 'draft' as const,
  }

  it('admin null → 에러', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { saveBlogPost } = await import('@/lib/actions/blog-edit')
    expect((await saveBlogPost(BASE)).success).toBe(false)
  })

  it('slug/title 빈 값 → 에러', async () => {
    const { saveBlogPost } = await import('@/lib/actions/blog-edit')
    expect((await saveBlogPost({ ...BASE, slug: '' })).success).toBe(false)
    expect((await saveBlogPost({ ...BASE, title: '' })).success).toBe(false)
  })

  it('정상 저장 + revalidatePath 호출', async () => {
    const cache = await import('next/cache')
    const { saveBlogPost } = await import('@/lib/actions/blog-edit')
    const r = await saveBlogPost(BASE)
    expect(r.success).toBe(true)
    expect(cache.revalidatePath).toHaveBeenCalled()
  })

  it('status=active 인데 publishedAt 없음 → 현재시각 주입', async () => {
    let captured: unknown = null
    mockFrom.mockImplementation(() => ({
      update: vi.fn((payload: unknown) => {
        captured = payload
        return { eq: mockUpdateEq }
      }),
    }))
    const { saveBlogPost } = await import('@/lib/actions/blog-edit')
    await saveBlogPost({ ...BASE, status: 'active' })
    expect((captured as { published_at?: string }).published_at).toBeDefined()
  })

  it('DB 에러 → 실패', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'failed' } })
    const { saveBlogPost } = await import('@/lib/actions/blog-edit')
    expect((await saveBlogPost(BASE)).success).toBe(false)
  })
})
