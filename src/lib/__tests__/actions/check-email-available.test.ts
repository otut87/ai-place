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

describe('checkEmailAvailableAction', () => {
  it('잘못된 이메일 → invalid', async () => {
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    expect((await checkEmailAvailableAction('no-at-sign')).status).toBe('invalid')
    expect((await checkEmailAvailableAction('a@')).status).toBe('invalid')
    expect((await checkEmailAvailableAction('a@b')).status).toBe('invalid')
  })

  it('공백만 있는 입력 → invalid', async () => {
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    expect((await checkEmailAvailableAction('   ')).status).toBe('invalid')
  })

  it('유효 이메일 · DB 미존재 → available', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    const r = await checkEmailAvailableAction('new@test.com')
    expect(r.status).toBe('available')
  })

  it('유효 이메일 · DB 존재 → taken', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'c-1' }, error: null })
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    const r = await checkEmailAvailableAction('taken@test.com')
    expect(r.status).toBe('taken')
  })

  it('DB 에러 (PGRST116 제외) → error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'X01', message: 'db fail' } })
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    const r = await checkEmailAvailableAction('fail@test.com')
    expect(r.status).toBe('error')
  })

  it('PGRST116 (row not found) → available 취급', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'nope' } })
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    const r = await checkEmailAvailableAction('rst116@test.com')
    expect(r.status).toBe('available')
  })

  it('admin null → fail-open available', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    const r = await checkEmailAvailableAction('nocrash@test.com')
    expect(r.status).toBe('available')
  })

  it('email 을 소문자 + trim 으로 정규화', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    const { checkEmailAvailableAction } = await import('@/lib/actions/check-email-available')
    await checkEmailAvailableAction('  Upper@TEST.COM  ')
    expect(mockEq).toHaveBeenCalledWith('email', 'upper@test.com')
  })
})
