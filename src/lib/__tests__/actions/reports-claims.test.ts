// T-182 신고·클레임 시스템 — submit 액션 검증.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()
const mockHeaders = vi.fn(() => ({ get: () => '127.0.0.1' }))
const mockFrom = vi.fn()

vi.mock('@/lib/auth', () => ({
  getUser: () => mockGetUser(),
  requireAuthForAction: async () => ({ id: 'admin-1', email: 'support@dedo.kr' }),
}))
vi.mock('next/headers', () => ({ headers: () => Promise.resolve(mockHeaders()) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

beforeEach(() => {
  mockGetUser.mockReset()
  mockFrom.mockReset()
})

describe('submitReport', () => {
  it('잘못된 사유 → 실패', async () => {
    const { submitReport } = await import('@/lib/actions/reports-claims')
    // @ts-expect-error intentional bad value
    const r = await submitReport({ placeId: 'p1', reason: 'not_a_reason' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/사유/)
  })

  it('placeId 누락 → 실패', async () => {
    const { submitReport } = await import('@/lib/actions/reports-claims')
    const r = await submitReport({ placeId: '', reason: 'spam' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/업체/)
  })

  it('존재하지 않는 업체 → 실패', async () => {
    mockGetUser.mockResolvedValue(null)
    mockFrom.mockImplementation((t: string) => {
      if (t === 'places') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
      }
      return {}
    })
    const { submitReport } = await import('@/lib/actions/reports-claims')
    const r = await submitReport({ placeId: 'ghost', reason: 'spam' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/존재하지 않는/)
  })
})

describe('submitClaim', () => {
  it('로그인 안하면 실패', async () => {
    mockGetUser.mockResolvedValue(null)
    const { submitClaim } = await import('@/lib/actions/reports-claims')
    const r = await submitClaim({ placeId: 'p1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/로그인/)
  })

  it('placeId 누락 → 실패', async () => {
    mockGetUser.mockResolvedValue({ id: 'u1', email: 'u@test.com' })
    const { submitClaim } = await import('@/lib/actions/reports-claims')
    const r = await submitClaim({ placeId: '' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/업체/)
  })

  it('본인이 이미 owner 면 차단', async () => {
    mockGetUser.mockResolvedValue({ id: 'u1', email: 'own@test.com' })
    mockFrom.mockImplementation((t: string) => {
      if (t === 'places') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
          data: { id: 'p1', name: 'X', owner_email: 'own@test.com' },
        }) }) }),
      }
      return {}
    })
    const { submitClaim } = await import('@/lib/actions/reports-claims')
    const r = await submitClaim({ placeId: 'p1' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/이미/)
  })
})
