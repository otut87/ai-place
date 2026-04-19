import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeSlug } from '@/lib/admin/master-data'

describe('normalizeSlug', () => {
  it('공백·대문자·특수문자 정리', () => {
    expect(normalizeSlug(' Cheonan City ')).toBe('cheonan-city')
    expect(normalizeSlug('피부과!!')).toBe('')          // 한글 → 빈 slug (영문 필수)
    expect(normalizeSlug('AA  BB')).toBe('aa-bb')
    expect(normalizeSlug('--foo--')).toBe('foo')
  })
})

// ── DB 함수 ─────────────────────────────
const mockSelect = vi.fn()
const mockUpsert = vi.fn()
const mockDeleteEq = vi.fn()
const mockCountEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockSelect.mockReset()
  mockUpsert.mockReset()
  mockDeleteEq.mockReset()
  mockCountEq.mockReset()
  mockFrom.mockReset()

  mockSelect.mockImplementation(() => {
    const chain: Record<string, unknown> = {}
    chain.order = vi.fn(() => chain)
    chain.eq = mockCountEq
    chain.then = (cb: (v: unknown) => unknown) => Promise.resolve({
      data: [{ id: '1', slug: 'cheonan', name: '천안', name_en: 'Cheonan', created_at: '2026-01-01T00:00:00Z' }],
      error: null,
    }).then(cb)
    return chain
  })

  mockCountEq.mockResolvedValue({ count: 0, error: null })
  mockUpsert.mockResolvedValue({ error: null })
  mockDeleteEq.mockResolvedValue({ error: null })

  mockFrom.mockImplementation(() => ({
    select: mockSelect,
    upsert: mockUpsert,
    delete: vi.fn(() => ({ eq: mockDeleteEq })),
  }))
})

describe('listCities', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listCities } = await import('@/lib/admin/master-data')
    expect(await listCities()).toEqual([])
  })

  it('정상 반환', async () => {
    const { listCities } = await import('@/lib/admin/master-data')
    const r = await listCities()
    expect(r).toHaveLength(1)
    expect(r[0].slug).toBe('cheonan')
  })
})

describe('upsertCity', () => {
  it('slug/name 빈 값 → 에러', async () => {
    const { upsertCity } = await import('@/lib/admin/master-data')
    expect((await upsertCity({ slug: '', name: 'x', nameEn: 'X' })).success).toBe(false)
    expect((await upsertCity({ slug: 'x', name: '', nameEn: 'X' })).success).toBe(false)
  })

  it('정상 저장', async () => {
    const { upsertCity } = await import('@/lib/admin/master-data')
    const r = await upsertCity({ slug: 'asan', name: '아산', nameEn: 'Asan' })
    expect(r.success).toBe(true)
    expect(mockUpsert).toHaveBeenCalled()
  })

  it('DB 에러 → 실패', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'dup' } })
    const { upsertCity } = await import('@/lib/admin/master-data')
    expect((await upsertCity({ slug: 'asan', name: '아산', nameEn: 'Asan' })).success).toBe(false)
  })
})

describe('deleteCity', () => {
  it('사용 중인 도시 → 거부', async () => {
    mockCountEq.mockResolvedValueOnce({ count: 5, error: null })
    const { deleteCity } = await import('@/lib/admin/master-data')
    const r = await deleteCity('cheonan')
    expect(r.success).toBe(false)
    expect(r.error).toContain('5개 업체')
  })

  it('빈 도시 → 삭제 성공', async () => {
    const { deleteCity } = await import('@/lib/admin/master-data')
    const r = await deleteCity('unused')
    expect(r.success).toBe(true)
  })
})

describe('upsertCategory / deleteCategory', () => {
  it('sector 누락 → 에러', async () => {
    const { upsertCategory } = await import('@/lib/admin/master-data')
    expect((await upsertCategory({ slug: 'x', name: 'X', nameEn: 'X', sector: '' })).success).toBe(false)
  })

  it('정상 저장', async () => {
    const { upsertCategory } = await import('@/lib/admin/master-data')
    expect((await upsertCategory({ slug: 'dermatology', name: '피부과', nameEn: 'Dermatology', sector: 'medical', icon: 'Stethoscope' })).success).toBe(true)
  })

  it('DB 에러 → 실패', async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: 'dup' } })
    const { upsertCategory } = await import('@/lib/admin/master-data')
    expect((await upsertCategory({ slug: 'x', name: 'X', nameEn: 'X', sector: 'living' })).success).toBe(false)
  })

  it('사용 중 카테고리 삭제 → 거부', async () => {
    mockCountEq.mockResolvedValueOnce({ count: 10, error: null })
    const { deleteCategory } = await import('@/lib/admin/master-data')
    expect((await deleteCategory('dermatology')).success).toBe(false)
  })

  it('미사용 카테고리 삭제 → 성공', async () => {
    const { deleteCategory } = await import('@/lib/admin/master-data')
    expect((await deleteCategory('unused')).success).toBe(true)
  })

  it('카테고리 삭제 DB 에러 → 실패', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'cannot delete' } })
    const { deleteCategory } = await import('@/lib/admin/master-data')
    expect((await deleteCategory('unused')).success).toBe(false)
  })
})

describe('admin null 가드 (전체 CRUD)', () => {
  it('upsertCity / deleteCity / upsertCategory / deleteCategory 가 admin_unavailable 을 반환한다', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    const { upsertCity, deleteCity, upsertCategory, deleteCategory } = await import('@/lib/admin/master-data')

    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    expect((await upsertCity({ slug: 'x', name: 'X', nameEn: 'X' })).error).toBe('admin_unavailable')

    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    expect((await deleteCity('x')).error).toBe('admin_unavailable')

    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    expect((await upsertCategory({ slug: 'x', name: 'X', nameEn: 'X', sector: 'living' })).error).toBe('admin_unavailable')

    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    expect((await deleteCategory('x')).error).toBe('admin_unavailable')
  })
})

describe('deleteCity DB 에러 경로', () => {
  it('count 검사 통과 후 delete 에러', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'FK violation' } })
    const { deleteCity } = await import('@/lib/admin/master-data')
    expect((await deleteCity('unused')).success).toBe(false)
  })
})

describe('listCategories / listSectors', () => {
  it('listCategories admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listCategories } = await import('@/lib/admin/master-data')
    expect(await listCategories()).toEqual([])
  })

  it('listSectors admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listSectors } = await import('@/lib/admin/master-data')
    expect(await listSectors()).toEqual([])
  })

  it('listCategories 정상 반환', async () => {
    const { listCategories } = await import('@/lib/admin/master-data')
    const r = await listCategories()
    expect(Array.isArray(r)).toBe(true)
  })

  it('listSectors 정상 반환', async () => {
    const { listSectors } = await import('@/lib/admin/master-data')
    const r = await listSectors()
    expect(Array.isArray(r)).toBe(true)
  })
})
