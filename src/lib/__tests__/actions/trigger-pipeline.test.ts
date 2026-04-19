import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(async () => ({ id: 'admin-1' })),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockInsert.mockReset()
  mockFrom.mockReset()

  mockSingle.mockResolvedValue({ data: { id: 'job-123' }, error: null })
  mockInsert.mockReturnValue({ select: vi.fn(() => ({ single: mockSingle })) })
  mockFrom.mockImplementation(() => ({ insert: mockInsert }))
})

describe('enqueuePipelineJob', () => {
  it('insert 성공 → { success, id }', async () => {
    const { enqueuePipelineJob } = await import('@/lib/actions/trigger-pipeline')
    const r = await enqueuePipelineJob({ jobType: 'collect', targetType: 'place', targetId: 'p1' })
    expect(r.success).toBe(true)
    expect(r.id).toBe('job-123')
    expect(mockFrom).toHaveBeenCalledWith('pipeline_jobs')
  })

  it('admin null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { enqueuePipelineJob } = await import('@/lib/actions/trigger-pipeline')
    const r = await enqueuePipelineJob({ jobType: 'generate' })
    expect(r.success).toBe(false)
  })

  it('insert error → 에러 전달', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'unique_violation' } })
    const { enqueuePipelineJob } = await import('@/lib/actions/trigger-pipeline')
    const r = await enqueuePipelineJob({ jobType: 'publish' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('unique_violation')
  })
})
