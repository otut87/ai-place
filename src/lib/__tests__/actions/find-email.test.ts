import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockMaybeSingle = vi.fn()
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
const mockEq = vi.fn(() => ({ limit: mockLimit }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockMaybeSingle.mockReset().mockResolvedValue({ data: null, error: null })
  mockEq.mockClear()
  mockSelect.mockClear()
  mockFrom.mockClear()
})

describe('findEmailByPhoneAction', () => {
  it('너무 짧은 번호 → 에러', async () => {
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('123')
    expect(r.success).toBe(false)
  })

  it('너무 긴 번호 → 에러', async () => {
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('1234567890123456')
    expect(r.success).toBe(false)
  })

  it('숫자 없음 → 에러', async () => {
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('abc-def')
    expect(r.success).toBe(false)
  })

  it('admin null → 서비스 장애', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('장애')
  })

  it('DB 에러 (PGRST116 제외) → 조회 실패', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'X', message: 'x' } })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('오류')
  })

  it('PGRST116 → 다음 후보로 계속', async () => {
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'empty' } })
      .mockResolvedValueOnce({ data: null, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(false)
  })

  it('매칭 없음 → 사용자 미가입 메시지', async () => {
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('가입된')
  })

  it('매칭 시 마스킹된 이메일 반환', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { email: 'example@test.com' }, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.maskedEmail).toContain('ex')
      expect(r.maskedEmail).toContain('@test.com')
      expect(r.maskedEmail).toContain('*')
    }
  })

  it('짧은 로컬 파트 (2자 이하) — 첫 글자만 노출', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { email: 'ab@t.com' }, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(true)
    if (r.success) expect(r.maskedEmail).toBe('a*@t.com')
  })

  it('비정상 이메일 (도메인 없음) — 원본 그대로 반환', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { email: 'nodomain' }, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    const r = await findEmailByPhoneAction('010-1234-5678')
    expect(r.success).toBe(true)
    if (r.success) expect(r.maskedEmail).toBe('nodomain')
  })

  it('11자리 010 번호 — 하이픈 포맷도 후보로 조회', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    await findEmailByPhoneAction('01012345678')
    const calledValues = mockEq.mock.calls.map((c) => c[1])
    expect(calledValues).toContain('01012345678')
    expect(calledValues).toContain('010-1234-5678')
  })

  it('10자리 01X 번호 — 하이픈 포맷 생성', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null })
    const { findEmailByPhoneAction } = await import('@/lib/actions/find-email')
    await findEmailByPhoneAction('0112345678')
    const calledValues = mockEq.mock.calls.map((c) => c[1])
    expect(calledValues).toContain('0112345678')
    expect(calledValues).toContain('011-234-5678')
  })
})
