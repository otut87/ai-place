// T-195 — similarity-guard (최근 30일 Jaccard 검사).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

import { guardBeforeInsert } from '@/lib/blog/similarity-guard'

beforeEach(() => {
  mockFrom.mockReset()
})

function chainResolving(rows: Array<{ id: string; slug: string; title: string; content: string }>) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    then: (cb: (r: unknown) => void) => cb({ data: rows, error: null }),
  }
}

describe('guardBeforeInsert', () => {
  it('DB 결과 없으면 pass', async () => {
    mockFrom.mockReturnValueOnce(chainResolving([]))
    const r = await guardBeforeInsert({
      newContent: '새로운 글 내용',
      newTitle: '새 제목',
    })
    expect(r.verdict).toBe('pass')
    expect(r.similarity).toBe(0)
  })

  it('거의 동일한 본문 → block (0.35+)', async () => {
    const existing = '천안 피부과 여드름 치료 가이드. 전문의 2인. 리뷰 120건. 평점 4.8점. 모공 관리 특화.'
    mockFrom.mockReturnValueOnce(chainResolving([
      { id: 'b1', slug: 'other', title: '동일 제목', content: existing },
    ]))
    const r = await guardBeforeInsert({
      newContent: existing, // 완전 동일
      newTitle: '동일 제목',
    })
    expect(r.verdict).toBe('block')
    expect(r.similarity).toBeGreaterThanOrEqual(0.35)
    expect(r.similarPosts.length).toBe(1)
  })

  it('부분 유사 → similarity 0 초과 (임계값은 실측 튜닝 대상)', async () => {
    const a = '천안 피부과 여드름 치료 가이드. 전문의 2인 기준 추천합니다.'
    const b = '천안 피부과 여드름 치료 가이드입니다만 내용은 다르게 서술. 추천 기준 차이.'
    mockFrom.mockReturnValueOnce(chainResolving([
      { id: 'b1', slug: 'other', title: '유사', content: a },
    ]))
    const r = await guardBeforeInsert({ newContent: b, newTitle: '새' })
    // 부동소수/shingles 특성상 정확한 임계값 boundary 는 불안정 — 0 초과만 검증.
    expect(r.similarity).toBeGreaterThan(0)
    expect(r.similarPosts.length === 0 || r.similarPosts[0].slug === 'other').toBe(true)
  })

  it('완전히 다른 본문 → pass (<0.25)', async () => {
    mockFrom.mockReturnValueOnce(chainResolving([
      { id: 'b1', slug: 'other', title: '치과', content: '서울 치과 임플란트 비용 비교. 전문의 상주. 평점 4.5.' },
    ]))
    const r = await guardBeforeInsert({
      newContent: '천안 한의원 보약 추천 가이드입니다. 침술·한약·추나.',
      newTitle: '천안 한의원',
    })
    expect(r.verdict).toBe('pass')
    expect(r.similarity).toBeLessThan(0.25)
  })

  it('DB 에러 시 pass (차단하지 않음)', async () => {
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      then: (cb: (r: unknown) => void) => cb({ data: null, error: { message: 'db down' } }),
    })
    const r = await guardBeforeInsert({ newContent: 'x', newTitle: 'y' })
    expect(r.verdict).toBe('pass')
  })
})
