import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEq = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockEq.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockEq.mockResolvedValue({ count: 5, error: null })
  mockSelect.mockImplementation(() => ({ eq: mockEq }))
  mockFrom.mockImplementation(() => ({ select: mockSelect }))
})

describe('getPendingReviewCount', () => {
  it('admin null → 0', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { getPendingReviewCount } = await import('@/lib/admin/review-counts')
    expect(await getPendingReviewCount()).toBe(0)
  })

  it('정상 count 반환', async () => {
    const { getPendingReviewCount } = await import('@/lib/admin/review-counts')
    expect(await getPendingReviewCount()).toBe(5)
    expect(mockSelect).toHaveBeenCalledWith('id', { count: 'exact', head: true })
  })

  it('DB 에러 → 0', async () => {
    mockEq.mockResolvedValueOnce({ count: null, error: { message: 'x' } })
    const { getPendingReviewCount } = await import('@/lib/admin/review-counts')
    expect(await getPendingReviewCount()).toBe(0)
  })

  it('count 가 null 이면 0', async () => {
    mockEq.mockResolvedValueOnce({ count: null, error: null })
    const { getPendingReviewCount } = await import('@/lib/admin/review-counts')
    expect(await getPendingReviewCount()).toBe(0)
  })
})

describe('getBillingFailureCount', () => {
  it('T-073 이전이므로 0 반환', async () => {
    const { getBillingFailureCount } = await import('@/lib/admin/review-counts')
    expect(await getBillingFailureCount()).toBe(0)
  })
})
