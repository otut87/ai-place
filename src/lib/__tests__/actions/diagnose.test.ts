// T-136 / T-139 — 공개 진단 서버 액션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockScanSite = vi.fn()
const mockFrom = vi.fn()
const mockHeaders = vi.fn()
const mockSaveRun = vi.fn()
const mockGetPrev = vi.fn()

vi.mock('@/lib/diagnostic/scan-site', () => ({
  scanSite: (url: string) => mockScanSite(url),
}))
vi.mock('@/lib/diagnostic/history', async () => {
  const actual = await vi.importActual<typeof import('@/lib/diagnostic/history')>('@/lib/diagnostic/history')
  return {
    ...actual,
    saveDiagnosticRun: (...a: unknown[]) => mockSaveRun(...a),
    getPreviousRun: (...a: unknown[]) => mockGetPrev(...a),
  }
})
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))
vi.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: (k: string) => mockHeaders(k) }),
}))

beforeEach(() => {
  mockScanSite.mockReset()
  mockFrom.mockReset()
  mockHeaders.mockReset()
  mockSaveRun.mockReset()
  mockGetPrev.mockReset()
  mockSaveRun.mockResolvedValue('run-new')
  mockGetPrev.mockResolvedValue(null)
  mockHeaders.mockReturnValue('Mozilla/5.0')
})

describe('runPublicDiagnosticAction', () => {
  it('빈 URL → error 필드', async () => {
    const { runPublicDiagnosticAction } = await import('@/lib/actions/diagnose')
    const r = await runPublicDiagnosticAction('')
    expect(r.error).toMatch(/비었|너무/)
    expect(r.score).toBe(0)
  })

  it('500자 초과 → error', async () => {
    const { runPublicDiagnosticAction } = await import('@/lib/actions/diagnose')
    const long = 'https://' + 'a'.repeat(500)
    const r = await runPublicDiagnosticAction(long)
    expect(r.error).toBeTruthy()
  })

  it('정상 → scanSite 결과 + compare null (prev 없음)', async () => {
    mockScanSite.mockResolvedValue({ url: 'https://x.com/', fetchedAt: new Date().toISOString(), score: 80, checks: [], pagesScanned: 1, sitemapPresent: false })
    const { runPublicDiagnosticAction } = await import('@/lib/actions/diagnose')
    const r = await runPublicDiagnosticAction('https://x.com')
    expect(r.score).toBe(80)
    expect(r.compare?.prev).toBeNull()
    expect(r.compare?.delta.tone).toBe('new')
    expect(mockSaveRun).toHaveBeenCalledOnce()
  })

  it('정상 + prev 있음 → compare 채워짐', async () => {
    mockScanSite.mockResolvedValue({ url: 'https://x.com/', fetchedAt: new Date().toISOString(), score: 85, checks: [{ id: 'faq_schema', label: 'FAQ', status: 'pass', points: 12 }], pagesScanned: 1, sitemapPresent: false })
    mockGetPrev.mockResolvedValue({
      id: 'old-run', origin: 'https://x.com', score: 60,
      created_at: new Date(Date.now() - 86400000).toISOString(),
      checks: [{ id: 'faq_schema', status: 'fail', points: 0 }],
    })
    const { runPublicDiagnosticAction } = await import('@/lib/actions/diagnose')
    const r = await runPublicDiagnosticAction('https://x.com')
    expect(r.compare?.prev?.score).toBe(60)
    expect(r.compare?.delta.delta).toBe(25)
    expect(r.compare?.delta.tone).toBe('up')
    expect(r.compare?.checkDiffs?.[0].pointDelta).toBe(12)
  })
})

// T-257 — captureLeadAction 제거됨 (dead funnel). 테스트 동시 제거.
