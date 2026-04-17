/**
 * actions/blog-views.ts 테스트 (T-010d / T-010f)
 *
 * incrementBlogPostView: slug 유효성 + Supabase 폴백 + atomic read+write.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Supabase admin client mock ---
const mockMaybeSingle = vi.fn()
const mockUpdate = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockMaybeSingle.mockReset()
  mockUpdate.mockReset()
  mockFrom.mockReset()

  // 체이닝 builder: select().eq().eq().maybeSingle() / update().eq()
  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: mockMaybeSingle,
        })),
      })),
    })),
    update: vi.fn((payload: unknown) => {
      mockUpdate(payload)
      return { eq: vi.fn().mockResolvedValue({ data: null, error: null }) }
    }),
  }))
})

describe('incrementBlogPostView — 유효성 가드', () => {
  it('빈 slug 는 무시', async () => {
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('SLUG_PATTERN 위반(대문자/공백/특수문자) 은 무시', async () => {
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('BadSlug')
    await incrementBlogPostView('slug with space')
    await incrementBlogPostView('slug;drop;table')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('100자 초과 slug 는 무시', async () => {
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('a'.repeat(101))
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('incrementBlogPostView — 정상 동작', () => {
  it('row.view_count + 1 로 update', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { view_count: 42 }, error: null })
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('cheonan-dermatology-acne')
    expect(mockUpdate).toHaveBeenCalledWith({ view_count: 43 })
  })

  it('view_count null 일 때 0 + 1 = 1', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { view_count: null }, error: null })
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('x')
    expect(mockUpdate).toHaveBeenCalledWith({ view_count: 1 })
  })
})

describe('incrementBlogPostView — 폴백', () => {
  it('row 없음 시 update 호출 안 함', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await incrementBlogPostView('nonexistent')
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('incrementBlogPostView — admin client 없음', () => {
  it('getAdminClient null 반환 시 조용히 종료', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { incrementBlogPostView } = await import('@/lib/actions/blog-views')
    await expect(incrementBlogPostView('x')).resolves.toBeUndefined()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
