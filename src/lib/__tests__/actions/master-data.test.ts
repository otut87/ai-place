import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(async () => ({ id: 'admin-1' })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/admin/master-data', () => ({
  upsertCity: vi.fn(),
  deleteCity: vi.fn(),
  upsertCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('upsertCityAction', () => {
  it('성공 → revalidatePath', async () => {
    const lib = await import('@/lib/admin/master-data')
    const cache = await import('next/cache')
    vi.mocked(lib.upsertCity).mockResolvedValue({ success: true })
    const { upsertCityAction } = await import('@/lib/actions/master-data')
    const r = await upsertCityAction({ slug: 'asan', name: '아산', nameEn: 'Asan' })
    expect(r.success).toBe(true)
    expect(cache.revalidatePath).toHaveBeenCalled()
  })

  it('실패 → revalidatePath 미호출', async () => {
    const lib = await import('@/lib/admin/master-data')
    const cache = await import('next/cache')
    vi.mocked(lib.upsertCity).mockResolvedValue({ success: false, error: 'x' })
    const { upsertCityAction } = await import('@/lib/actions/master-data')
    await upsertCityAction({ slug: 'x', name: 'x', nameEn: 'x' })
    expect(cache.revalidatePath).not.toHaveBeenCalled()
  })
})

describe('deleteCityAction / deleteCategoryAction', () => {
  it('deleteCity', async () => {
    const lib = await import('@/lib/admin/master-data')
    vi.mocked(lib.deleteCity).mockResolvedValue({ success: true })
    const { deleteCityAction } = await import('@/lib/actions/master-data')
    expect((await deleteCityAction('x')).success).toBe(true)
  })

  it('deleteCategory', async () => {
    const lib = await import('@/lib/admin/master-data')
    vi.mocked(lib.deleteCategory).mockResolvedValue({ success: true })
    const { deleteCategoryAction } = await import('@/lib/actions/master-data')
    expect((await deleteCategoryAction('x')).success).toBe(true)
  })
})

describe('upsertCategoryAction', () => {
  it('성공 전달', async () => {
    const lib = await import('@/lib/admin/master-data')
    vi.mocked(lib.upsertCategory).mockResolvedValue({ success: true })
    const { upsertCategoryAction } = await import('@/lib/actions/master-data')
    const r = await upsertCategoryAction({ slug: 'test', name: 'T', nameEn: 'T', sector: 'medical' })
    expect(r.success).toBe(true)
  })
})
