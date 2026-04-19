// T-140 — 인용 테스트 유틸 (rate limit / subscription / query 생성).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockFrom.mockReset()
})

describe('checkCitationTestRateLimit', () => {
  it('이력 없음 → 허용', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }),
    }))
    const { checkCitationTestRateLimit } = await import('@/lib/diagnostic/citation-test')
    const r = await checkCitationTestRateLimit('p1')
    expect(r.allowed).toBe(true)
    expect(r.lastRunAt).toBeNull()
  })

  it('7일 이내 실행 → 차단 + 남은 시간', async () => {
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ started_at: recent }] }) }) }) }),
    }))
    const { checkCitationTestRateLimit } = await import('@/lib/diagnostic/citation-test')
    const r = await checkCitationTestRateLimit('p1')
    expect(r.allowed).toBe(false)
    expect(r.remainingHours).toBeGreaterThan(0)
    expect(r.nextAllowedAt).toBeTruthy()
  })

  it('7일 초과 → 허용 (이력은 유지)', async () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => Promise.resolve({ data: [{ started_at: old }] }) }) }) }),
    }))
    const { checkCitationTestRateLimit } = await import('@/lib/diagnostic/citation-test')
    const r = await checkCitationTestRateLimit('p1')
    expect(r.allowed).toBe(true)
    expect(r.lastRunAt).toBe(old)
  })
})

describe('hasActiveSubscription', () => {
  it('customerId null → false', async () => {
    const { hasActiveSubscription } = await import('@/lib/diagnostic/citation-test')
    expect(await hasActiveSubscription(null)).toBe(false)
  })
  it('active 구독 있음 → true', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [{ id: 's1' }] }) }) }) }),
    }))
    const { hasActiveSubscription } = await import('@/lib/diagnostic/citation-test')
    expect(await hasActiveSubscription('c1')).toBe(true)
  })
  it('active 구독 없음 → false', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({ eq: () => ({ eq: () => ({ limit: () => Promise.resolve({ data: [] }) }) }) }),
    }))
    const { hasActiveSubscription } = await import('@/lib/diagnostic/citation-test')
    expect(await hasActiveSubscription('c1')).toBe(false)
  })
})

describe('buildCitationQueries', () => {
  it('3개 쿼리 생성 (모두 도시+업종 포함)', async () => {
    const { buildCitationQueries } = await import('@/lib/diagnostic/citation-test')
    const qs = buildCitationQueries('천안', '피부과')
    expect(qs).toHaveLength(3)
    for (const q of qs) {
      expect(q).toContain('천안')
      expect(q).toContain('피부과')
    }
  })
})
