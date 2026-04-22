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

describe('deleteBlogPostById', () => {
  const mockDeleteEq = vi.fn()
  beforeEach(() => {
    mockDeleteEq.mockReset()
    mockDeleteEq.mockResolvedValue({ error: null })
    // T-200: delete 전 select(city, sector, slug) 호출 경로 추가 → mock 에 select 지원.
    mockFrom.mockImplementation(() => ({
      delete: vi.fn(() => ({ eq: mockDeleteEq })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: null })),
        })),
      })),
    }))
  })

  it('id 빈 값 → 실패', async () => {
    const { deleteBlogPostById } = await import('@/lib/actions/blog-edit')
    expect((await deleteBlogPostById('   ')).success).toBe(false)
  })

  it('admin null → 실패', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { deleteBlogPostById } = await import('@/lib/actions/blog-edit')
    expect((await deleteBlogPostById('abc-uuid')).success).toBe(false)
  })

  it('정상 삭제 → revalidatePath 호출', async () => {
    const cache = await import('next/cache')
    vi.mocked(cache.revalidatePath).mockClear()
    const { deleteBlogPostById } = await import('@/lib/actions/blog-edit')
    const r = await deleteBlogPostById('abc-uuid')
    expect(r.success).toBe(true)
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'abc-uuid')
    expect(cache.revalidatePath).toHaveBeenCalledWith('/admin/blog')
    expect(cache.revalidatePath).toHaveBeenCalledWith('/blog')
  })

  it('DB 에러 → 실패', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'fk violation' } })
    const { deleteBlogPostById } = await import('@/lib/actions/blog-edit')
    const r = await deleteBlogPostById('abc-uuid')
    expect(r.success).toBe(false)
    expect(r.error).toBe('fk violation')
  })
})
