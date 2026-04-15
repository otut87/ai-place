/**
 * manage-place Server Actions 단위 테스트
 * Mock: auth, supabase admin client, next/cache
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth
vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(),
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock supabase admin client
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

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { city: 'cheonan', category: 'dermatology', slug: 'test' }, error: null })
  mockEq.mockResolvedValue({ error: null })
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
})
