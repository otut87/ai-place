/**
 * actions/inline-edit-place.ts 테스트 (T-049)
 * 화이트리스트 필드 검증 + admin 클라이언트 폴백.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockUpdateEq.mockReset()
  mockFrom.mockReset()

  mockSingle.mockResolvedValue({ data: { city: 'cheonan', category: 'dermatology', slug: 'x' } })
  mockUpdateEq.mockResolvedValue({ error: null })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
    update: vi.fn(() => ({ eq: mockUpdateEq })),
    // T-055: 감사 로그 insert (recordUpdateDiffs)
    insert: vi.fn().mockResolvedValue({ error: null }),
  }))
})

describe('updatePlaceInlineField', () => {
  it('허용되지 않은 필드는 거부', async () => {
    const { updatePlaceInlineField } = await import('@/lib/actions/inline-edit-place')
    // @ts-expect-error invalid field
    const r = await updatePlaceInlineField('p1', 'not_allowed', 'value')
    expect(r.success).toBe(false)
  })

  it('검증 실패 시 에러 반환', async () => {
    const { updatePlaceInlineField } = await import('@/lib/actions/inline-edit-place')
    // description 은 10자 이상 규칙이 있으므로 너무 짧으면 실패
    const r = await updatePlaceInlineField('p1', 'description', 'a')
    expect(r.success).toBe(false)
  })

  it('정상 업데이트 시 value 반환', async () => {
    const { updatePlaceInlineField } = await import('@/lib/actions/inline-edit-place')
    const r = await updatePlaceInlineField('p1', 'name', '새로운 업체명')
    expect(r.success).toBe(true)
    expect(r.value).toBe('새로운 업체명')
  })

  it('admin 클라이언트 null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { updatePlaceInlineField } = await import('@/lib/actions/inline-edit-place')
    const r = await updatePlaceInlineField('p1', 'name', '이름')
    expect(r.success).toBe(false)
  })

  it('DB 에러 시 error 반환', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'db-fail' } })
    const { updatePlaceInlineField } = await import('@/lib/actions/inline-edit-place')
    const r = await updatePlaceInlineField('p1', 'name', '이름')
    expect(r.success).toBe(false)
  })
})
