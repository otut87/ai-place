// T-165 — 공유 링크 생성·조회 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

beforeEach(() => {
  mockFrom.mockReset()
})

describe('createReportShareAction', () => {
  it('정상 생성 → 16자 hash + url 반환', async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ insert: insertMock })
    const { createReportShareAction } = await import('@/lib/actions/report-share')
    const r = await createReportShareAction({ runId: 'run-1', title: 'T', expiryDays: 7 })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.link.hash.length).toBe(16)
      expect(r.link.url).toMatch(/^\/reports\/[A-Za-z0-9_-]{16}$/)
      expect(new Date(r.link.expiresAt).getTime()).toBeGreaterThan(Date.now())
    }
  })

  it('DB 에러 → 실패', async () => {
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: 'constraint' } }) })
    const { createReportShareAction } = await import('@/lib/actions/report-share')
    const r = await createReportShareAction({ runId: 'run-1' })
    expect(r.success).toBe(false)
  })
})

describe('viewReportShare', () => {
  it('없는 hash → null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    })
    const { viewReportShare } = await import('@/lib/actions/report-share')
    expect(await viewReportShare('xx')).toBeNull()
  })

  it('만료된 링크 → null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { hash: 'x', run_id: 'r1', title: null, client_name: null, baseline_run_id: null,
          expires_at: new Date(Date.now() - 1000).toISOString(), views: 0 },
      }) }) }),
    })
    const { viewReportShare } = await import('@/lib/actions/report-share')
    expect(await viewReportShare('x')).toBeNull()
  })

  it('유효 링크 → views 증가 + 반환', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({
        data: { hash: 'h', run_id: 'r1', title: 'T', client_name: null, baseline_run_id: null,
          expires_at: new Date(Date.now() + 86400000).toISOString(), views: 3 },
      }) }) }),
      update: () => ({ eq: updateEq }),
    })
    const { viewReportShare } = await import('@/lib/actions/report-share')
    const v = await viewReportShare('h')
    expect(v?.views).toBe(4)
    expect(updateEq).toHaveBeenCalledOnce()
  })
})
