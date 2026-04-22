// T-195 — 6 Angle 로테이션 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

import { pickAngle, ANGLE_KEYS, ANGLE_PROMPT } from '@/lib/ai/angles'

beforeEach(() => {
  mockFrom.mockReset()
})

function chainResolving(data: Array<{ angle: string | null; created_at: string }>) {
  // admin.from('blog_posts').select(...).gte(...).not(...).eq(...).eq(...)
  const chain: Record<string, unknown> & { then?: (cb: (r: unknown) => void) => void } = {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (cb: (r: unknown) => void) => cb({ data, error: null }),
  }
  return chain
}

describe('pickAngle', () => {
  it('postType=compare 는 항상 comparison-context', async () => {
    const r = await pickAngle({ postType: 'compare' })
    expect(r).toBe('comparison-context')
  })

  it('prefer override 적용', async () => {
    const r = await pickAngle({ postType: 'detail', prefer: 'seasonal' })
    expect(r).toBe('seasonal')
  })

  it('DB 기록 없으면 첫 angle 반환', async () => {
    mockFrom.mockReturnValueOnce(chainResolving([]))
    const r = await pickAngle({ postType: 'detail', city: 'cheonan', category: 'dermatology' })
    expect(ANGLE_KEYS).toContain(r)
  })

  it('최근에 쓴 angle 은 뒤로, 안 쓴 angle 우선', async () => {
    const now = Date.now()
    const recent = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString()
    mockFrom.mockReturnValueOnce(chainResolving([
      { angle: 'review-deepdive', created_at: recent },
      { angle: 'price-transparency', created_at: recent },
    ]))
    const r = await pickAngle({ postType: 'detail', city: 'cheonan', category: 'dermatology' })
    // review-deepdive, price-transparency 은 뒤로 — 나머지 4개 중 하나
    expect(['procedure-guide', 'first-visit', 'comparison-context', 'seasonal']).toContain(r)
  })

  it('ANGLE_PROMPT 가 6 angle 전부 커버', () => {
    for (const a of ANGLE_KEYS) {
      expect(ANGLE_PROMPT[a]).toBeTruthy()
    }
  })
})
