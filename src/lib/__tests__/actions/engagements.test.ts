// T-167·T-169·T-170 — engagement 액션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
const mockScan = vi.fn()
const mockSave = vi.fn()

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'admin' }),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('@/lib/diagnostic/scan-site', () => ({
  scanSite: (u: string) => mockScan(u),
}))
vi.mock('@/lib/diagnostic/history', () => ({
  saveDiagnosticRun: (...a: unknown[]) => mockSave(...a),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

beforeEach(() => {
  mockFrom.mockReset()
  mockScan.mockReset()
  mockSave.mockReset()
})

describe('createEngagementAction', () => {
  it('진단 실패 → 실패', async () => {
    mockScan.mockResolvedValue({ url: 'x', error: 'fetch fail', checks: [], pagesScanned: 0, sitemapPresent: false, score: 0, fetchedAt: 't' })
    const { createEngagementAction } = await import('@/lib/actions/engagements')
    const r = await createEngagementAction({ targetUrl: 'https://x.com' })
    expect(r.success).toBe(false)
  })

  it('baseline 저장 실패 → 실패', async () => {
    mockScan.mockResolvedValue({ url: 'https://x.com/', score: 60, checks: [], pagesScanned: 1, sitemapPresent: false, fetchedAt: 't' })
    mockSave.mockResolvedValue(null)
    const { createEngagementAction } = await import('@/lib/actions/engagements')
    const r = await createEngagementAction({ targetUrl: 'https://x.com' })
    expect(r.success).toBe(false)
  })

  it('정상 → engagement + 체크리스트 자동 생성', async () => {
    mockScan.mockResolvedValue({
      url: 'https://x.com/', score: 60, pagesScanned: 1, sitemapPresent: false, fetchedAt: 't',
      checks: [
        { id: 'faq_schema', label: 'FAQ', category: 'geo', status: 'fail', points: 0, maxPoints: 12 },
        { id: 'title', label: '제목', category: 'seo', status: 'pass', points: 5, maxPoints: 5 },
        { id: 'sameas_entity_linking', label: 'sameAs', category: 'aeo', status: 'warn', points: 2, maxPoints: 5 },
      ],
    })
    mockSave.mockResolvedValue('run-base')
    const engInsert = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'eng-1' }, error: null }) }),
    }))
    const taskInsert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'engagements') return { insert: engInsert }
      if (table === 'engagement_tasks') return { insert: taskInsert }
      return {}
    })
    const { createEngagementAction } = await import('@/lib/actions/engagements')
    const r = await createEngagementAction({ targetUrl: 'https://x.com/' })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.taskCount).toBe(2) // fail + warn
      expect(r.engagementId).toBe('eng-1')
    }
    expect(taskInsert).toHaveBeenCalledOnce()
  })
})

describe('toggleEngagementTaskAction', () => {
  it('update 성공', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ update: () => ({ eq: updateEq }) })
    const { toggleEngagementTaskAction } = await import('@/lib/actions/engagements')
    const r = await toggleEngagementTaskAction('task-1', true)
    expect(r.success).toBe(true)
    expect(updateEq).toHaveBeenCalled()
  })
})

describe('completeEngagementAction', () => {
  it('engagement 없음 → 실패', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
    })
    const { completeEngagementAction } = await import('@/lib/actions/engagements')
    const r = await completeEngagementAction('eng-x')
    expect(r.success).toBe(false)
  })

  it('정상 완료 → delta 계산', async () => {
    mockScan.mockResolvedValue({ url: 'https://x.com/', score: 91, checks: [], pagesScanned: 1, sitemapPresent: true, fetchedAt: 't' })
    mockSave.mockResolvedValue('run-final')
    const updateEq = vi.fn().mockResolvedValue({ error: null })
    let call = 0
    mockFrom.mockImplementation((table: string) => {
      call++
      if (table === 'engagements' && call === 1) return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { target_url: 'https://x.com/', baseline_run_id: 'base', customer_id: 'c1' } }) }) }),
      }
      if (table === 'diagnostic_runs') return {
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { score: 58 } }) }) }),
      }
      if (table === 'engagements') return {
        update: () => ({ eq: updateEq }),
      }
      return {}
    })
    const { completeEngagementAction } = await import('@/lib/actions/engagements')
    const r = await completeEngagementAction('eng-1')
    expect(r.success).toBe(true)
    expect(r.delta).toBe(33)
  })
})
