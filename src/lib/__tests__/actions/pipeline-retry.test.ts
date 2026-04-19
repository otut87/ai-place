import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn(async () => ({ id: 'admin-1' })),
}))

vi.mock('@/lib/admin/pipeline-jobs', () => ({
  retryPipelineJob: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('retryPipelineJobAction', () => {
  it('success → revalidatePath 호출', async () => {
    const { retryPipelineJob } = await import('@/lib/admin/pipeline-jobs')
    const { revalidatePath } = await import('next/cache')
    vi.mocked(retryPipelineJob).mockResolvedValue({ success: true })

    const { retryPipelineJobAction } = await import('@/lib/actions/pipeline-retry')
    const r = await retryPipelineJobAction('job-1')
    expect(r.success).toBe(true)
    expect(revalidatePath).toHaveBeenCalledWith('/admin/pipelines')
  })

  it('failure → revalidatePath 호출 안 함', async () => {
    const { retryPipelineJob } = await import('@/lib/admin/pipeline-jobs')
    const { revalidatePath } = await import('next/cache')
    vi.mocked(retryPipelineJob).mockResolvedValue({ success: false, error: 'not_found' })

    const { retryPipelineJobAction } = await import('@/lib/actions/pipeline-retry')
    const r = await retryPipelineJobAction('job-1')
    expect(r.success).toBe(false)
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
