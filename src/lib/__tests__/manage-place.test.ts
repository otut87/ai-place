/**
 * manage-place Server Actions 단위 테스트
 * Mock: auth, supabase admin client, next/cache, audit-places
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockRecordAudit = vi.fn().mockResolvedValue({ success: true })
const mockRecordUpdateDiffs = vi.fn().mockResolvedValue({ success: true, recorded: 0 })
vi.mock('@/lib/actions/audit-places', () => ({
  recordAudit: mockRecordAudit,
  recordUpdateDiffs: mockRecordUpdateDiffs,
}))

const mockSingle = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockDelete = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  update: mockUpdate,
  delete: mockDelete,
}))

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(async () => {
  vi.clearAllMocks()
  mockRecordAudit.mockResolvedValue({ success: true })
  mockRecordUpdateDiffs.mockResolvedValue({ success: true, recorded: 0 })
  mockSingle.mockResolvedValue({
    data: {
      city: 'cheonan', category: 'dermatology', slug: 'test',
      customer_id: null, status: 'pending',
      name: '기존 이름', description: '기존 설명',
    },
    error: null,
  })
  mockEq.mockResolvedValue({ error: null })

  const { requireAuthForAction } = await import('@/lib/auth')
  vi.mocked(requireAuthForAction).mockResolvedValue({ id: 'admin-1' } as never)
})

describe('getPlaceById', () => {
  it('성공 시 데이터 반환', async () => {
    mockSingle.mockResolvedValue({ data: { id: '1', name: '테스트' }, error: null })
    const { getPlaceById } = await import('@/lib/actions/manage-place')
    const result = await getPlaceById('1')
    expect(result).toBeTruthy()
    expect(result?.name).toBe('테스트')
  })

  it('에러 시 null 반환', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const { getPlaceById } = await import('@/lib/actions/manage-place')
    const result = await getPlaceById('bad-id')
    expect(result).toBeNull()
  })
})

describe('updatePlaceStatus', () => {
  it('성공 시 success: true', async () => {
    const { updatePlaceStatus } = await import('@/lib/actions/manage-place')
    const result = await updatePlaceStatus('1', 'active')
    expect(result.success).toBe(true)
  })

  it('DB 에러 시 실패', async () => {
    mockEq.mockResolvedValue({ error: { message: 'db error' } })
    const { updatePlaceStatus } = await import('@/lib/actions/manage-place')
    const result = await updatePlaceStatus('1', 'active')
    expect(result.success).toBe(false)
  })

  it('상태 전환 시 audit 기록', async () => {
    const { updatePlaceStatus } = await import('@/lib/actions/manage-place')
    await updatePlaceStatus('1', 'active')
    expect(mockRecordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'status', field: 'status', before: 'pending', after: 'active', actorId: 'admin-1',
    }))
  })

  it('이미 같은 상태면 audit 미기록', async () => {
    mockSingle.mockResolvedValue({
      data: { city: 'c', category: 'd', slug: 's', customer_id: null, status: 'active' },
      error: null,
    })
    const { updatePlaceStatus } = await import('@/lib/actions/manage-place')
    await updatePlaceStatus('1', 'active')
    expect(mockRecordAudit).not.toHaveBeenCalled()
  })
})

describe('updatePlace', () => {
  it('성공 시 success: true', async () => {
    const { updatePlace } = await import('@/lib/actions/manage-place')
    const result = await updatePlace('1', { name: '수정됨' })
    expect(result.success).toBe(true)
  })

  it('DB 에러 시 실패', async () => {
    mockEq.mockResolvedValue({ error: { message: 'db error' } })
    const { updatePlace } = await import('@/lib/actions/manage-place')
    const result = await updatePlace('1', { name: '수정' })
    expect(result.success).toBe(false)
  })

  it('수정 시 입력된 필드만 audit diff 호출', async () => {
    const { updatePlace } = await import('@/lib/actions/manage-place')
    await updatePlace('1', { name: '새 이름' })
    expect(mockRecordUpdateDiffs).toHaveBeenCalledWith(
      '1',
      'admin-1',
      expect.objectContaining({ name: '기존 이름' }),
      expect.objectContaining({ name: '새 이름' }),
    )
  })
})

describe('deletePlace', () => {
  it('성공 시 success: true', async () => {
    const { deletePlace } = await import('@/lib/actions/manage-place')
    const result = await deletePlace('1')
    expect(result.success).toBe(true)
  })

  it('DB 에러 시 실패', async () => {
    mockEq.mockResolvedValue({ error: { message: 'db error' } })
    const { deletePlace } = await import('@/lib/actions/manage-place')
    const result = await deletePlace('1')
    expect(result.success).toBe(false)
  })

  it('삭제 시 before 스냅샷으로 audit 기록', async () => {
    const { deletePlace } = await import('@/lib/actions/manage-place')
    await deletePlace('1')
    expect(mockRecordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'delete',
      placeId: '1',
      actorId: 'admin-1',
      after: null,
      before: expect.objectContaining({ city: 'cheonan' }),
    }))
  })
})
