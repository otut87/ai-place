// T-160·T-161 — 진단 이력 저장·조회 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockFrom.mockReset()
})

describe('saveDiagnosticRun', () => {
  it('error 있는 결과 → null 반환 (저장 스킵)', async () => {
    const { saveDiagnosticRun } = await import('@/lib/diagnostic/history')
    const r = await saveDiagnosticRun({
      result: { url: 'x', fetchedAt: 't', score: 0, checks: [], error: 'fetch fail', pagesScanned: 0, sitemapPresent: false },
      triggeredBy: 'public',
    })
    expect(r).toBeNull()
  })

  it('정상 결과 → insert 호출 + id 반환', async () => {
    const insertMock = vi.fn((_payload: Record<string, unknown>) => ({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'run-1' }, error: null }) }),
    }))
    mockFrom.mockReturnValue({ insert: insertMock })
    const { saveDiagnosticRun } = await import('@/lib/diagnostic/history')
    const r = await saveDiagnosticRun({
      result: { url: 'https://x.com/', fetchedAt: 't', score: 85, checks: [], pagesScanned: 3, sitemapPresent: true },
      triggeredBy: 'owner', customerId: 'c1', userAgent: 'Mozilla',
    })
    expect(r).toBe('run-1')
    const payload = insertMock.mock.calls[0]?.[0]
    expect(payload).toBeDefined()
    expect(payload?.origin).toBe('https://x.com')
    expect(payload?.score).toBe(85)
    expect(payload?.triggered_by).toBe('owner')
    expect(payload?.customer_id).toBe('c1')
  })

  it('DB error → null + 로그 (throw 안 함)', async () => {
    const insertMock = vi.fn(() => ({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'constraint' } }) }),
    }))
    mockFrom.mockReturnValue({ insert: insertMock })
    const { saveDiagnosticRun } = await import('@/lib/diagnostic/history')
    const r = await saveDiagnosticRun({
      result: { url: 'https://x.com/', fetchedAt: 't', score: 50, checks: [], pagesScanned: 1, sitemapPresent: false },
      triggeredBy: 'public',
    })
    expect(r).toBeNull()
  })
})

describe('scoreDelta', () => {
  it('prev null → new', async () => {
    const { scoreDelta } = await import('@/lib/diagnostic/history')
    expect(scoreDelta(null, 50).tone).toBe('new')
  })
  it('상승 → up + 라벨', async () => {
    const { scoreDelta } = await import('@/lib/diagnostic/history')
    const d = scoreDelta(58, 82)
    expect(d.delta).toBe(24)
    expect(d.tone).toBe('up')
    expect(d.label).toBe('이전 대비 +24점')
  })
  it('하락 → down', async () => {
    const { scoreDelta } = await import('@/lib/diagnostic/history')
    const d = scoreDelta(80, 75)
    expect(d.delta).toBe(-5)
    expect(d.tone).toBe('down')
  })
  it('동일 → same', async () => {
    const { scoreDelta } = await import('@/lib/diagnostic/history')
    expect(scoreDelta(80, 80).tone).toBe('same')
  })
})

describe('computeCheckDiffs', () => {
  it('이전 없는 체크 → prevStatus null + pointDelta = current', async () => {
    const { computeCheckDiffs } = await import('@/lib/diagnostic/history')
    const diffs = computeCheckDiffs([], [{ id: 'faq_schema', label: 'FAQ', status: 'pass', points: 15 }])
    expect(diffs[0].prevStatus).toBeNull()
    expect(diffs[0].pointDelta).toBe(15)
  })
  it('체크 상태 개선 → pointDelta 양수', async () => {
    const { computeCheckDiffs } = await import('@/lib/diagnostic/history')
    const diffs = computeCheckDiffs(
      [{ id: 'faq_schema', status: 'fail', points: 0 }],
      [{ id: 'faq_schema', label: 'FAQ', status: 'pass', points: 15 }],
    )
    expect(diffs[0].prevStatus).toBe('fail')
    expect(diffs[0].currStatus).toBe('pass')
    expect(diffs[0].pointDelta).toBe(15)
  })
})

describe('getPreviousRun / listRecentRuns', () => {
  it('getPreviousRun 결과 없음 → null', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ lt: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) }) }) }),
    })
    const { getPreviousRun } = await import('@/lib/diagnostic/history')
    expect(await getPreviousRun('https://x.com', new Date().toISOString())).toBeNull()
  })

  it('listRecentRuns 빈 결과 → 빈 배열', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }),
    })
    const { listRecentRuns } = await import('@/lib/diagnostic/history')
    expect(await listRecentRuns('https://x.com')).toEqual([])
  })
})
