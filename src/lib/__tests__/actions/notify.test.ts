import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSendEmail = vi.fn()
const mockSendSlack = vi.fn()

vi.mock('@/lib/notify/email', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}))
vi.mock('@/lib/notify/slack', () => ({
  sendSlack: (...args: unknown[]) => mockSendSlack(...args),
}))

beforeEach(() => {
  mockSendEmail.mockReset()
  mockSendSlack.mockReset()
  mockSendEmail.mockResolvedValue({ success: true, provider: 'console' })
  mockSendSlack.mockResolvedValue({ success: true, provider: 'console' })
})

describe('dispatchNotify', () => {
  it('place.registered — 슬랙 + 이메일 전부 전송', async () => {
    const { dispatchNotify } = await import('@/lib/actions/notify')
    const r = await dispatchNotify({
      type: 'place.registered',
      placeName: '신규',
      placeUrl: 'https://aiplace.kr/admin',
      adminEmail: 'admin@x.com',
    })
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendSlack).toHaveBeenCalledTimes(1)
    expect(r.email?.success).toBe(true)
    expect(r.slack?.success).toBe(true)
  })

  it('place.approved — 이메일만 전송 (슬랙 페이로드 null)', async () => {
    const { dispatchNotify } = await import('@/lib/actions/notify')
    const r = await dispatchNotify({
      type: 'place.approved',
      placeName: '닥터에버스',
      placeUrl: 'https://x',
      ownerEmail: 'o@x.com',
    })
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendSlack).not.toHaveBeenCalled()
    expect(r.slack).toBeUndefined()
  })

  it('pending.backlog — 어드민 이메일 + 슬랙 전송', async () => {
    const { dispatchNotify } = await import('@/lib/actions/notify')
    await dispatchNotify({ type: 'pending.backlog', count: 5, adminEmail: 'a@b.com' })
    expect(mockSendEmail).toHaveBeenCalledTimes(1)
    expect(mockSendSlack).toHaveBeenCalledTimes(1)
  })

  it('adminEmail 없는 pending.backlog — 슬랙만', async () => {
    const { dispatchNotify } = await import('@/lib/actions/notify')
    const r = await dispatchNotify({ type: 'pending.backlog', count: 5 })
    expect(mockSendEmail).not.toHaveBeenCalled()
    expect(mockSendSlack).toHaveBeenCalledTimes(1)
    expect(r.email).toBeUndefined()
  })

  it('이메일 실패하더라도 슬랙은 시도', async () => {
    mockSendEmail.mockResolvedValueOnce({ success: false, provider: 'resend', error: 'x' })
    const { dispatchNotify } = await import('@/lib/actions/notify')
    const r = await dispatchNotify({
      type: 'place.registered',
      placeName: '신규', placeUrl: 'https://x', adminEmail: 'a@b.com',
    })
    expect(r.email?.success).toBe(false)
    expect(r.slack?.success).toBe(true)
  })
})
