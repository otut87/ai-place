// T-157/T-158 — Rate limit + 환각 가드 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

const MS_DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  mockFrom.mockReset()
})

function mockRows(rows: Array<{ created_at: string }>) {
  mockFrom.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          gte: () => ({
            order: () => Promise.resolve({ data: rows }),
          }),
        }),
      }),
    }),
  }))
}

describe('checkAiRateLimit', () => {
  it('이력 없음 → allowed', async () => {
    mockRows([])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(0)
  })

  it('최근 실행 2일 전 → weekly 차단', async () => {
    mockRows([{ created_at: new Date(Date.now() - 2 * MS_DAY).toISOString() }])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(false)
    expect(s.reason).toBe('weekly')
    expect(s.remainingHours).toBeGreaterThan(0)
  })

  it('최근 8일 전 + 총 2회 → allowed', async () => {
    mockRows([
      { created_at: new Date(Date.now() - 8 * MS_DAY).toISOString() },
      { created_at: new Date(Date.now() - 20 * MS_DAY).toISOString() },
    ])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(2)
  })

  it('이번 달 5회 사용 → monthly 차단', async () => {
    mockRows(Array.from({ length: 5 }, (_, i) => ({ created_at: new Date(Date.now() - (i + 1) * 2 * MS_DAY).toISOString() })))
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(false)
    expect(s.reason).toBe('monthly')
    expect(s.monthlyUsed).toBe(5)
  })

  it('T-218: 30일 rolling — 31일 이전 이력 5개는 window 밖이라 DB 가 gte 필터로 이미 제외 → allowed', async () => {
    // DB 쿼리가 windowStart 보다 오래된 row 는 반환하지 않는다. mock 도 같은 행동 — 빈 배열 리턴.
    mockRows([])
    const { checkAiRateLimit } = await import('@/lib/ai/owner-generate')
    const s = await checkAiRateLimit('p1')
    expect(s.allowed).toBe(true)
    expect(s.monthlyUsed).toBe(0)
  })
})

describe('generateOwnerDraft', () => {
  it('API 키 없음 → 실패', async () => {
    const prev = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    const { generateOwnerDraft } = await import('@/lib/ai/owner-generate')
    const r = await generateOwnerDraft({ name: 'X', city: 'cheonan', category: 'medical' })
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toMatch(/ANTHROPIC/)
    if (prev) process.env.ANTHROPIC_API_KEY = prev
  })
})
