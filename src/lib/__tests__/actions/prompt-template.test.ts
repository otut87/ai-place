// T-128 — 프롬프트 활성화 서버 액션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockActivate = vi.fn()
const mockRequire = vi.fn().mockResolvedValue(undefined)

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: () => mockRequire(),
}))
vi.mock('@/lib/admin/prompt-templates', () => ({
  activatePromptVersion: (...args: unknown[]) => mockActivate(...args),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  mockActivate.mockReset()
  mockRequire.mockClear()
})

describe('activatePromptAction', () => {
  it('성공 시 success: true 반환', async () => {
    mockActivate.mockResolvedValueOnce({ success: true })
    const { activatePromptAction } = await import('@/lib/actions/prompt-template')
    const r = await activatePromptAction('id-123')
    expect(r.success).toBe(true)
    expect(mockActivate).toHaveBeenCalledWith('id-123')
    expect(mockRequire).toHaveBeenCalledOnce()
  })

  it('실패 시 error 전달', async () => {
    mockActivate.mockResolvedValueOnce({ success: false, error: 'not found' })
    const { activatePromptAction } = await import('@/lib/actions/prompt-template')
    const r = await activatePromptAction('bad-id')
    expect(r.success).toBe(false)
    expect(r.error).toBe('not found')
  })
})
