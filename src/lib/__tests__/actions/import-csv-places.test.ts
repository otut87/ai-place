/**
 * actions/import-csv-places.ts 테스트 (T-053)
 * CSV → 행 검증 → DB insert. 가드 경로 중심.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/data', () => ({
  getCities: vi.fn().mockResolvedValue([{ slug: 'cheonan', name: '천안' }]),
  getCategories: vi.fn().mockResolvedValue([{ slug: 'dermatology', name: '피부과' }]),
}))

const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockInsert.mockReset()
  mockFrom.mockReset()

  mockInsert.mockResolvedValue({ error: null, count: 1 })
  mockFrom.mockImplementation(() => ({ insert: (rows: unknown) => mockInsert(rows) }))
})

const VALID_CSV = [
  'slug,name,city,category,description,address,phone',
  '"test-place","테스트업체","cheonan","dermatology","40자 이상의 설명 텍스트를 여기에 충분히 길게 작성합니다.","천안시 서북구 불당동 1-1","041-123-4567"',
].join('\n')

describe('importCsvPlaces', () => {
  it('admin client null → 즉시 error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { importCsvPlaces } = await import('@/lib/actions/import-csv-places')
    const r = await importCsvPlaces(VALID_CSV)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/Admin/)
  })

  it('깨진 CSV → parse error 반환', async () => {
    const { importCsvPlaces } = await import('@/lib/actions/import-csv-places')
    const r = await importCsvPlaces('')
    expect(r.success).toBe(false)
  })

  it('정상 CSV → 행 결과 + insert 호출', async () => {
    const { importCsvPlaces } = await import('@/lib/actions/import-csv-places')
    const r = await importCsvPlaces(VALID_CSV)
    expect(r.success).toBe(true)
    expect(r.results.length).toBe(1)
    expect(mockInsert).toHaveBeenCalled()
  })

  it('DB insert 실패 → success=false', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'db-fail' }, count: 0 })
    const { importCsvPlaces } = await import('@/lib/actions/import-csv-places')
    const r = await importCsvPlaces(VALID_CSV)
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/DB/)
  })

  it('검증 실패 행은 errors 포함, insert 호출 안 함', async () => {
    const invalidCsv = [
      'slug,name,city,category,description,address',
      '"x","업","cheonan","dermatology","짧음","천안"',
    ].join('\n')
    const { importCsvPlaces } = await import('@/lib/actions/import-csv-places')
    const r = await importCsvPlaces(invalidCsv)
    expect(r.success).toBe(true)
    expect(r.results[0].ok).toBe(false)
    expect(mockInsert).not.toHaveBeenCalled()
  })
})
