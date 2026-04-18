/**
 * actions/bulk-places.ts 테스트 (T-047)
 * 가드 경로 중심 — 인증 mock + admin 클라이언트 유/무 시나리오.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockIn = vi.fn()
const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockIn.mockReset()
  mockUpdate.mockReset()
  mockDelete.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ data: [{ city: 'cheonan', category: 'dermatology', slug: 'x' }] }) })),
    update: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null, count: 2 }) })),
    delete: vi.fn(() => ({ in: vi.fn().mockResolvedValue({ error: null, count: 2 }) })),
    // T-055: 감사 로그 insert (recordAudit)
    insert: vi.fn().mockResolvedValue({ error: null }),
  }))
})

describe('bulkUpdateStatus', () => {
  it('빈 ids → error', async () => {
    const { bulkUpdateStatus } = await import('@/lib/actions/bulk-places')
    const r = await bulkUpdateStatus([], 'activate')
    expect(r.success).toBe(false)
  })

  it('잘못된 action → error', async () => {
    const { bulkUpdateStatus } = await import('@/lib/actions/bulk-places')
    // @ts-expect-error invalid action
    const r = await bulkUpdateStatus(['a'], 'invalid-action')
    expect(r.success).toBe(false)
  })

  it('delete 액션은 bulkUpdateStatus 로는 불가', async () => {
    const { bulkUpdateStatus } = await import('@/lib/actions/bulk-places')
    const r = await bulkUpdateStatus(['a'], 'delete')
    expect(r.success).toBe(false)
  })

  it('활성화 성공 시 processed 반환', async () => {
    const { bulkUpdateStatus } = await import('@/lib/actions/bulk-places')
    const r = await bulkUpdateStatus(['a', 'b'], 'activate')
    expect(r.success).toBe(true)
    expect(r.processed).toBe(2)
  })

  it('admin 클라이언트 null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { bulkUpdateStatus } = await import('@/lib/actions/bulk-places')
    const r = await bulkUpdateStatus(['a'], 'activate')
    expect(r.success).toBe(false)
  })
})

describe('bulkDeletePlaces', () => {
  it('빈 ids → error', async () => {
    const { bulkDeletePlaces } = await import('@/lib/actions/bulk-places')
    const r = await bulkDeletePlaces([])
    expect(r.success).toBe(false)
  })

  it('정상 삭제 시 processed 반환', async () => {
    const { bulkDeletePlaces } = await import('@/lib/actions/bulk-places')
    const r = await bulkDeletePlaces(['a', 'b'])
    expect(r.success).toBe(true)
    expect(r.processed).toBe(2)
  })

  it('admin 클라이언트 null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { bulkDeletePlaces } = await import('@/lib/actions/bulk-places')
    const r = await bulkDeletePlaces(['a'])
    expect(r.success).toBe(false)
  })
})
