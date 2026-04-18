import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...ORIGINAL_ENV }
})

describe('sendEmail — console fallback', () => {
  it('RESEND_API_KEY 없으면 콘솔 경로', async () => {
    delete process.env.RESEND_API_KEY
    delete process.env.RESEND_FROM
    const { sendEmail } = await import('@/lib/notify/email')
    const r = await sendEmail({ to: 'a@b.com', subject: 's', body: 'b' })
    expect(r.provider).toBe('console')
    expect(r.success).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('sendEmail — Resend 경로', () => {
  it('정상 응답', async () => {
    process.env.RESEND_API_KEY = 'k'
    process.env.RESEND_FROM = 'noreply@ai.kr'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'em-1' }),
    })
    const { sendEmail } = await import('@/lib/notify/email')
    const r = await sendEmail({ to: 'o@x.com', subject: 's', body: 'b' })
    expect(r.success).toBe(true)
    expect(r.provider).toBe('resend')
    expect(r.id).toBe('em-1')
    expect(global.fetch).toHaveBeenCalled()
  })

  it('Resend 에러 응답 → success=false', async () => {
    process.env.RESEND_API_KEY = 'k'
    process.env.RESEND_FROM = 'noreply@ai.kr'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 422,
      text: async () => 'bad-to',
    })
    const { sendEmail } = await import('@/lib/notify/email')
    const r = await sendEmail({ to: 'bad', subject: 's', body: 'b' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('422')
  })

  it('fetch 예외 → success=false', async () => {
    process.env.RESEND_API_KEY = 'k'
    process.env.RESEND_FROM = 'f@x.kr'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('net'))
    const { sendEmail } = await import('@/lib/notify/email')
    const r = await sendEmail({ to: 'a', subject: 's', body: 'b' })
    expect(r.success).toBe(false)
  })
})
