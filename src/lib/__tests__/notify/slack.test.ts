import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  vi.unstubAllGlobals()
  process.env = { ...ORIGINAL_ENV }
})

describe('sendSlack', () => {
  it('웹훅 URL 없음 → console 경로', async () => {
    delete process.env.SLACK_WEBHOOK_URL
    const { sendSlack } = await import('@/lib/notify/slack')
    const r = await sendSlack({ text: 'hello' })
    expect(r.provider).toBe('console')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('정상 전송', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks/xyz'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true })
    const { sendSlack } = await import('@/lib/notify/slack')
    const r = await sendSlack({ text: 'ping' })
    expect(r.success).toBe(true)
    expect(r.provider).toBe('webhook')
  })

  it('웹훅 에러 응답', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks/xyz'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    const { sendSlack } = await import('@/lib/notify/slack')
    const r = await sendSlack({ text: 'ping' })
    expect(r.success).toBe(false)
  })

  it('fetch 예외', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks/xyz'
    ;(global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('net'))
    const { sendSlack } = await import('@/lib/notify/slack')
    const r = await sendSlack({ text: 'ping' })
    expect(r.success).toBe(false)
  })
})
