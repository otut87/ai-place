// T-149 — ownerSignupAction 유효성 + 가드 경로 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSignUp = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    auth: { signUp: (...a: unknown[]) => mockSignUp(...a) },
  }),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

beforeEach(() => {
  mockSignUp.mockReset()
  mockFrom.mockReset()
})

function mockCustomerLookup(existing: { id: string; user_id: string | null } | null) {
  const updateEq = vi.fn().mockResolvedValue({ error: null })
  const insert = vi.fn(() => ({
    select: () => ({ single: () => Promise.resolve({ data: { id: 'new-c' }, error: null }) }),
  }))
  mockFrom.mockImplementation((table: string) => {
    if (table === 'customers') return {
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: existing }) }) }),
      insert,
      update: () => ({ eq: updateEq }),
    }
    return {}
  })
  return { updateEq, insert }
}

describe('ownerSignupAction', () => {
  it('잘못된 이메일 → 실패', async () => {
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'not-email', password: 'Password123', termsAgreed: true })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/이메일/)
  })

  it('비밀번호 < 8자 → 실패', async () => {
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'a@b.com', password: '1234', termsAgreed: true })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/8자/)
  })

  it('약관 미동의 → 실패', async () => {
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'a@b.com', password: 'Password123', termsAgreed: false })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/약관/)
  })

  it('Supabase Auth 에러 → 실패 반환', async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: 'duplicate email' } })
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'a@b.com', password: 'Password123', termsAgreed: true })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('duplicate')
  })

  it('신규 유저 → customer 생성 + 성공', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u-1' }, session: null }, error: null })
    const { insert } = mockCustomerLookup(null)
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'a@b.com', password: 'Password123', termsAgreed: true, name: '홍길동' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.userId).toBe('u-1')
      expect(r.customerId).toBe('new-c')
      expect(r.requiresVerification).toBe(true)
    }
    expect(insert).toHaveBeenCalledOnce()
  })

  it('기존 customer row 에 user_id 연결', async () => {
    mockSignUp.mockResolvedValue({ data: { user: { id: 'u-2' }, session: { access_token: 'x' } }, error: null })
    const { updateEq, insert } = mockCustomerLookup({ id: 'old-c', user_id: null })
    const { ownerSignupAction } = await import('@/lib/actions/owner-signup')
    const r = await ownerSignupAction({ email: 'a@b.com', password: 'Password123', termsAgreed: true })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.customerId).toBe('old-c')
      expect(r.requiresVerification).toBe(false)
    }
    expect(updateEq).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })
})
