import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: vi.fn().mockResolvedValue({ id: 'owner-1', email: 'o@x.com' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockOr = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/actions/audit-places', () => ({
  recordUpdateDiffs: vi.fn().mockResolvedValue({ success: true, recorded: 2 }),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockUpdateEq.mockReset()
  mockOr.mockReset()
  mockFrom.mockReset()

  mockSingle.mockResolvedValue({
    data: {
      id: 'p-1', city: 'cheonan', category: 'dermatology', slug: 'x',
      owner_id: 'owner-1', owner_email: 'o@x.com',
      description: 'old desc', phone: '010', opening_hours: null, tags: ['a'], images: null,
    },
    error: null,
  })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockOr.mockResolvedValue({ data: [{ id: 'p-1', slug: 'x', name: 'n', city: 'c', category: 'd', status: 'active', description: '', phone: '', opening_hours: null, tags: [], images: null, updated_at: null }], error: null })

  mockFrom.mockImplementation((table: string) => {
    if (table === 'customers') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: () => Promise.resolve({ data: null }) })),
        })),
      }
    }
    // places — listOwnerPlaces 는 owner_id / owner_email / customer_id 3경로 조회.
    // .eq() 는 thenable(배열 리턴) + .single() 체인 둘 다 지원해야 함.
    const eqReturn = {
      single: mockSingle,
      then: (onFulfilled: (v: unknown) => unknown) => mockOr().then(onFulfilled),
    }
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => eqReturn),
        or: vi.fn(() => ({ order: vi.fn(() => mockOr()) })),
      })),
      update: vi.fn(() => ({ eq: mockUpdateEq })),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }
  })
})

describe('listOwnerPlaces', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listOwnerPlaces } = await import('@/lib/actions/owner-places')
    expect(await listOwnerPlaces()).toEqual([])
  })

  it('정상 조회', async () => {
    const { listOwnerPlaces } = await import('@/lib/actions/owner-places')
    const rows = await listOwnerPlaces()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('p-1')
  })

  it('모든 경로에서 DB 에러/빈 결과 → []', async () => {
    // listOwnerPlaces 는 owner_id / owner_email / customer_id 3경로 조회 — 모두 빈 배열.
    mockOr.mockResolvedValue({ data: null, error: { message: 'x' } })
    const { listOwnerPlaces } = await import('@/lib/actions/owner-places')
    expect(await listOwnerPlaces()).toEqual([])
  })
})

describe('updateOwnerPlace', () => {
  it('빈 패치 거부', async () => {
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', {})
    expect(r.success).toBe(false)
  })

  it('금지 필드 제거 후 빈 패치가 되면 거부', async () => {
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { status: 'active', slug: 'hack' })
    expect(r.success).toBe(false)
  })

  it('형식 불량 → 에러', async () => {
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { phone: 'bad!!' })
    expect(r.success).toBe(false)
  })

  it('admin null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { description: '충분히 긴 설명 입력' })
    expect(r.success).toBe(false)
  })

  it('업체 없음 → error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'nf' } })
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { description: '충분히 긴 설명 입력' })
    expect(r.success).toBe(false)
  })

  it('소유권 없음 → error', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'p-1', city: 'c', category: 'd', slug: 'x',
        owner_id: 'other', owner_email: 'other@x.com',
        description: null, phone: null, opening_hours: null, tags: null, images: null,
      },
      error: null,
    })
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { description: '충분히 긴 설명 입력' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('본인 소유')
  })

  it('정상 업데이트', async () => {
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', {
      description: '천안 불당 위치. 피부과 전문 진료.',
      phone: '041-123',
    })
    expect(r.success).toBe(true)
    expect(r.fieldsChanged).toBe(2)
  })

  it('DB 에러 → error', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'x' } })
    const { updateOwnerPlace } = await import('@/lib/actions/owner-places')
    const r = await updateOwnerPlace('p-1', { description: '천안 불당 위치. 피부과 전문.' })
    expect(r.success).toBe(false)
  })
})
