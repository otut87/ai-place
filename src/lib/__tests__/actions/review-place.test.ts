import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u-1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/actions/audit-places', () => ({
  recordAudit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/actions/notify', () => ({
  dispatchNotify: vi.fn().mockResolvedValue({}),
}))

const mockSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockUpdateEq.mockReset()
  mockFrom.mockReset()

  mockSingle.mockResolvedValue({
    data: {
      city: 'cheonan', category: 'dermatology', slug: 'x',
      name: '테스트업체', owner_email: 'o@x.com', status: 'pending',
    },
    error: null,
  })
  mockUpdateEq.mockResolvedValue({ error: null })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
    update: vi.fn(() => ({ eq: mockUpdateEq })),
  }))
})

describe('approvePlace', () => {
  it('placeId 누락 → error', async () => {
    const { approvePlace } = await import('@/lib/actions/review-place')
    const r = await approvePlace('')
    expect(r.success).toBe(false)
  })

  it('admin null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { approvePlace } = await import('@/lib/actions/review-place')
    const r = await approvePlace('p-1')
    expect(r.success).toBe(false)
  })

  it('업체 없음 → error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'nf' } })
    const { approvePlace } = await import('@/lib/actions/review-place')
    const r = await approvePlace('p-1')
    expect(r.success).toBe(false)
  })

  it('정상 승인', async () => {
    const { approvePlace } = await import('@/lib/actions/review-place')
    const r = await approvePlace('p-1')
    expect(r.success).toBe(true)
    expect(mockUpdateEq).toHaveBeenCalled()
    const { dispatchNotify } = await import('@/lib/actions/notify')
    expect(dispatchNotify).toHaveBeenCalledWith(expect.objectContaining({
      type: 'place.approved',
      placeName: '테스트업체',
    }))
  })

  it('DB 에러 → error', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'x' } })
    const { approvePlace } = await import('@/lib/actions/review-place')
    const r = await approvePlace('p-1')
    expect(r.success).toBe(false)
  })
})

describe('rejectPlace', () => {
  it('허용되지 않은 reason → error', async () => {
    const { rejectPlace } = await import('@/lib/actions/review-place')
    // @ts-expect-error invalid reason
    const r = await rejectPlace({ placeId: 'p', reason: 'bogus' })
    expect(r.success).toBe(false)
  })

  it('정상 반려 + 사유 audit 기록', async () => {
    const { rejectPlace } = await import('@/lib/actions/review-place')
    const r = await rejectPlace({ placeId: 'p-1', reason: 'fact_error', note: '주소 불일치' })
    expect(r.success).toBe(true)
    const { recordAudit } = await import('@/lib/actions/audit-places')
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'status',
      after: 'rejected',
      reason: 'fact_error: 주소 불일치',
    }))
  })

  it('note 없이 reason 만 → audit 에 reason 만', async () => {
    const { rejectPlace } = await import('@/lib/actions/review-place')
    await rejectPlace({ placeId: 'p-1', reason: 'duplicate' })
    const { recordAudit } = await import('@/lib/actions/audit-places')
    expect(recordAudit).toHaveBeenLastCalledWith(expect.objectContaining({
      reason: 'duplicate',
    }))
  })

  it('admin null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { rejectPlace } = await import('@/lib/actions/review-place')
    const r = await rejectPlace({ placeId: 'p', reason: 'tone' })
    expect(r.success).toBe(false)
  })
})
