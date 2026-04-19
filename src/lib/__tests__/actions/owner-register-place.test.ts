// T-151/T-152/T-153 — Owner 자체 업체 등록 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRequireOwner = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/owner/auth', () => ({
  requireOwnerForAction: () => mockRequireOwner(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockRequireOwner.mockReset()
  mockFrom.mockReset()
  mockRequireOwner.mockResolvedValue({ id: 'u1', email: 'o@x.com' })
})

function mockDbOk(opts: { customerId?: string; existing?: Array<{ id: string; name: string; address: string; slug: string }>; insertId?: string } = {}) {
  const customerId = opts.customerId ?? 'c1'
  const existing = opts.existing ?? []
  const insertId = opts.insertId ?? 'p-new'
  const insertMock = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: insertId }, error: null }) }),
  }))

  mockFrom.mockImplementation((table: string) => {
    if (table === 'customers') return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: customerId } }) }) }),
      insert: vi.fn(() => ({
        select: () => ({ single: () => Promise.resolve({ data: { id: customerId }, error: null }) }),
      })),
      update: vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) })),
    }
    if (table === 'places') {
      // googlePlaceId 유니크 조회, slug 중복 조회 — 둘 다 .eq().maybeSingle() 체인.
      // 좌표 근접 조회 — .gte().lte().gte().lte() 체인으로 배열 반환.
      // city+category 유사도 조회 — .eq().eq() 체인으로 배열 반환.
      const maybeNull = () => Promise.resolve({ data: null })
      const emptyArr = () => Promise.resolve({ data: [] })

      return {
        select: (_cols: string) => ({
          // .eq().maybeSingle() — google_place_id 단일 조회
          eq: (_k1: string, _v1: string) => ({
            maybeSingle: maybeNull,
            // .eq().eq() — city+category 리스트
            eq: (_k2: string, _v2: string) => ({
              // .eq().eq().eq() — slug 체크
              eq: () => ({ maybeSingle: maybeNull }),
              then: (onFulfilled: (x: unknown) => unknown) =>
                Promise.resolve({ data: existing }).then(onFulfilled),
            }),
          }),
          // 좌표 근접 조회 — .gte().lte().gte().lte()
          gte: () => ({ lte: () => ({ gte: () => ({ lte: emptyArr }) }) }),
        }),
        insert: insertMock,
      }
    }
    return {}
  })
  return { insertMock }
}

describe('registerOwnerPlaceAction', () => {
  it('업체명 빈값 → 실패', async () => {
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({ name: '', city: 'cheonan', category: 'medical', address: 'x' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/업체명/)
  })

  it('city slug 잘못됨 → 실패', async () => {
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({ name: 'X', city: '천안', category: 'medical', address: 'y' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/slug/)
  })

  it('customer 없음 + 자동 생성 실패 → 실패', async () => {
    // email 로도 조회 안 됨 → 자동 생성 시도 → insert 에러 → 에러 반환.
    mockFrom.mockImplementation((table: string) => {
      if (table === 'customers') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
        insert: vi.fn(() => ({
          select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'insert failed' } }) }),
        })),
      }
      return {}
    })
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({ name: 'X', city: 'cheonan', category: 'medical', address: 'y' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/customer/)
  })

  it('수동 등록 (Naver/Google 매칭 없음) → pending', async () => {
    mockDbOk()
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'Test Dental', city: 'cheonan', category: 'medical', address: '천안시',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.status).toBe('pending')
      expect(r.autoApproved).toBe(false)
    }
  })

  it('naverPlaceUrl 매칭 → auto active', async () => {
    mockDbOk()
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'Good Place', city: 'cheonan', category: 'restaurant',
      address: '천안시 동남구', phone: '010-1234-5678',
      naverPlaceUrl: 'https://m.place.naver.com/place/search/Good%20Place',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.status).toBe('active')
      expect(r.autoApproved).toBe(true)
    }
  })

  it('googlePlaceId 매칭 → auto active', async () => {
    mockDbOk()
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'Good Place', city: 'cheonan', category: 'restaurant',
      address: '천안시 동남구',
      googlePlaceId: 'ChIJtest123',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.status).toBe('active')
      expect(r.autoApproved).toBe(true)
    }
  })
})
