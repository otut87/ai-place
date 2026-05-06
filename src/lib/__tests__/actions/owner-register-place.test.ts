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

function mockDbOk(opts: {
  customerId?: string
  existing?: Array<{ id: string; name: string; address: string; slug: string }>
  insertId?: string
  /** T-259 R6: 등록 시 카드 보유 여부 — autoApproved 와 결합해 status 결정. 기본 1 (카드 있음). */
  activeCardCount?: number
} = {}) {
  const customerId = opts.customerId ?? 'c1'
  const existing = opts.existing ?? []
  const insertId = opts.insertId ?? 'p-new'
  const cardCount = opts.activeCardCount ?? 1
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
    // T-259 R6: count 조회만 사용. R6 status 결정 시 select(...).eq(...).eq(...) 체인.
    if (table === 'billing_keys') return {
      select: () => ({
        eq: () => ({ eq: () => Promise.resolve({ count: cardCount, data: null, error: null }) }),
      }),
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

  it('T-259 R6: customer 없음 + 카드 없음 → 등록 허용, customer 자동 생성, status=pending', async () => {
    // R6: register-first — 카드 선등록 게이트 제거. 카드 없는 owner 도 등록은 가능하지만
    //   place 는 status='pending' 으로 머무름. 카드 등록 후 active 전환은 별도 작업.
    mockDbOk({ activeCardCount: 0 })
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'X', city: 'cheonan', category: 'medical', address: 'y',
      naverPlaceUrl: 'https://m.place.naver.com/place/123',
    })
    expect(r.success).toBe(true)
    // Naver 매칭이 있어도 카드 미등록이므로 status=pending (R6).
    if (r.success) {
      expect(r.status).toBe('pending')
      expect(r.autoApproved).toBe(true)   // autoApproved 신호 자체는 true
    }
  })

  it('T-259 R6: customer 있고 카드 있음 + naver 매칭 → status=active 정상 흐름', async () => {
    mockDbOk({ activeCardCount: 1 })
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'X', city: 'cheonan', category: 'medical', address: 'y',
      naverPlaceUrl: 'https://m.place.naver.com/place/123',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.status).toBe('active')
      expect(r.autoApproved).toBe(true)
    }
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

  it('T-266: 관리자 이메일 + 카드 없음 + naver 매칭 → status=active (카드 게이트 우회)', async () => {
    mockRequireOwner.mockResolvedValueOnce({ id: 'u1', email: 'support@dedo.kr' })
    mockDbOk({ activeCardCount: 0 })
    const { registerOwnerPlaceAction } = await import('@/lib/actions/owner-register-place')
    const r = await registerOwnerPlaceAction({
      name: 'X', city: 'cheonan', category: 'medical', address: 'y',
      naverPlaceUrl: 'https://m.place.naver.com/place/123',
    })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.status).toBe('active')
      expect(r.autoApproved).toBe(true)
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
