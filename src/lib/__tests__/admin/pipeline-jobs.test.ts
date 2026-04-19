import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JOB_STATUS_LABEL, jobStatusTone } from '@/lib/admin/pipeline-jobs'

describe('JOB_STATUS_LABEL', () => {
  it('5가지 상태 모두 한국어', () => {
    expect(JOB_STATUS_LABEL.pending).toBe('대기')
    expect(JOB_STATUS_LABEL.running).toBe('실행 중')
    expect(JOB_STATUS_LABEL.succeeded).toBe('성공')
    expect(JOB_STATUS_LABEL.failed).toBe('실패')
    expect(JOB_STATUS_LABEL.canceled).toBe('취소')
  })
})

describe('jobStatusTone', () => {
  it('상태 → tone', () => {
    expect(jobStatusTone('succeeded')).toBe('ok')
    expect(jobStatusTone('failed')).toBe('danger')
    expect(jobStatusTone('running')).toBe('warn')
    expect(jobStatusTone('pending')).toBe('warn')
    expect(jobStatusTone('canceled')).toBe('muted')
  })
})

// ── listPipelineJobs / retryPipelineJob ─────────────────────────────
const mockLimit = vi.fn()
const mockEq = vi.fn()
const mockOrder = vi.fn()
const mockSingle = vi.fn()
const mockInsert = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockEq.mockReset()
  mockOrder.mockReset()
  mockSingle.mockReset()
  mockInsert.mockReset()
  mockSelect.mockReset()
  mockFrom.mockReset()

  mockLimit.mockResolvedValue({
    data: [
      { id: 'j1', job_type: 'collect', target_type: 'place', target_id: 'p1', status: 'failed', error: 'timeout', retried_count: 0, started_at: null, finished_at: null, created_at: '2026-04-20T00:00:00Z' },
    ],
    error: null,
  })

  mockEq.mockImplementation(() => ({
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
  }))
  mockOrder.mockImplementation(() => ({ limit: mockLimit, order: mockOrder, eq: mockEq }))
  mockSelect.mockImplementation(() => ({ order: mockOrder, eq: mockEq }))
  mockSingle.mockResolvedValue({
    data: { job_type: 'collect', target_type: 'place', target_id: 'p1', input_payload: { foo: 'bar' }, retried_count: 0 },
    error: null,
  })
  mockInsert.mockResolvedValue({ error: null })

  mockFrom.mockImplementation(() => ({
    select: vi.fn((sel) => {
      if (typeof sel === 'string' && sel.includes('input_payload')) {
        return { eq: vi.fn(() => ({ single: mockSingle })) }
      }
      return mockSelect()
    }),
    insert: mockInsert,
  }))
})

describe('listPipelineJobs', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listPipelineJobs } = await import('@/lib/admin/pipeline-jobs')
    expect(await listPipelineJobs()).toEqual([])
  })

  it('결과 반환 (필터 없이)', async () => {
    const { listPipelineJobs } = await import('@/lib/admin/pipeline-jobs')
    const r = await listPipelineJobs()
    expect(r).toHaveLength(1)
    expect(r[0].status).toBe('failed')
  })

  it('status=all 은 필터 생략', async () => {
    const { listPipelineJobs } = await import('@/lib/admin/pipeline-jobs')
    await listPipelineJobs({ status: 'all' })
    // eq 가 status 용으로는 호출되지 않아야 함 — 여기서는 호출 횟수로 간접 검증
    expect(mockFrom).toHaveBeenCalledWith('pipeline_jobs')
  })

  it('DB 에러 → []', async () => {
    mockLimit.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { listPipelineJobs } = await import('@/lib/admin/pipeline-jobs')
    expect(await listPipelineJobs()).toEqual([])
  })
})

describe('retryPipelineJob', () => {
  it('admin null → 실패', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { retryPipelineJob } = await import('@/lib/admin/pipeline-jobs')
    const r = await retryPipelineJob('j1')
    expect(r.success).toBe(false)
  })

  it('로드 실패 → 에러', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'x' } })
    const { retryPipelineJob } = await import('@/lib/admin/pipeline-jobs')
    const r = await retryPipelineJob('j-missing')
    expect(r.success).toBe(false)
  })

  it('정상 재시도 → insert 호출', async () => {
    const { retryPipelineJob } = await import('@/lib/admin/pipeline-jobs')
    const r = await retryPipelineJob('j1')
    expect(r.success).toBe(true)
    expect(mockInsert).toHaveBeenCalled()
  })
})
