// T-194 — keyword-bank (RPC + insert) 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRpc = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}))

import {
  pickTargetQuery,
  insertKeyword,
  markKeywordUsed,
  getAvailableKeywords,
} from '@/lib/blog/keyword-bank'

beforeEach(() => {
  mockRpc.mockReset()
  mockFrom.mockReset()
})

describe('pickTargetQuery', () => {
  it('RPC 호출 결과 → KeywordRow', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{
        id: 'kw-1',
        keyword: '천안 피부과 여드름',
        longtails: ['여드름 케어'],
        priority: 3,
        angle: 'review-deepdive',
        post_type: 'detail',
      }],
      error: null,
    })

    const r = await pickTargetQuery({
      sector: 'medical',
      city: 'cheonan',
      angle: 'review-deepdive',
      postType: 'detail',
    })

    expect(r?.keyword).toBe('천안 피부과 여드름')
    expect(r?.longtails).toEqual(['여드름 케어'])
    expect(mockRpc).toHaveBeenCalledWith('pick_target_query', expect.objectContaining({
      p_sector: 'medical',
      p_city: 'cheonan',
      p_angle: 'review-deepdive',
      p_post_type: 'detail',
    }))
  })

  it('RPC 빈 배열 → null (풀 소진)', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    const r = await pickTargetQuery({ sector: 'medical' })
    expect(r).toBeNull()
  })

  it('RPC 에러는 throw', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'db down' } })
    await expect(pickTargetQuery({ sector: 'medical' })).rejects.toThrow(/db down/)
  })

  it('optional 파라미터 미지정 시 null 로 RPC 전달', async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null })
    await pickTargetQuery({ sector: 'medical' })
    expect(mockRpc).toHaveBeenCalledWith('pick_target_query', {
      p_sector: 'medical',
      p_city: null,
      p_angle: null,
      p_post_type: null,
    })
  })
})

describe('insertKeyword', () => {
  it('성공 시 inserted=true', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: null })
    mockFrom.mockReturnValueOnce({ insert })

    const r = await insertKeyword({
      keyword: '천안 피부과',
      sector: 'medical',
      angle: 'review-deepdive',
      longtails: [],
    })
    expect(r.inserted).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('keyword_bank')
  })

  it('unique_violation(23505) 은 조용히 스킵', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate' } })
    mockFrom.mockReturnValueOnce({ insert })
    const r = await insertKeyword({ keyword: 'dup', sector: 'medical' })
    expect(r.inserted).toBe(false)
    expect(r.error).toBeUndefined()
  })

  it('기타 에러는 error 메시지 반환', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: { code: 'XX', message: 'boom' } })
    mockFrom.mockReturnValueOnce({ insert })
    const r = await insertKeyword({ keyword: 'x', sector: 'medical' })
    expect(r.inserted).toBe(false)
    expect(r.error).toContain('boom')
  })
})

describe('markKeywordUsed', () => {
  it('keyword_bank_usage 에 insert', async () => {
    const insert = vi.fn().mockResolvedValueOnce({ error: null })
    mockFrom.mockReturnValueOnce({ insert })
    await markKeywordUsed('kw-1', 'blog-1')
    expect(mockFrom).toHaveBeenCalledWith('keyword_bank_usage')
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      keyword_id: 'kw-1',
      blog_post_id: 'blog-1',
    }))
  })
})

describe('getAvailableKeywords', () => {
  it('sector 필터 + used_count 오름차순 정렬', async () => {
    const order2 = vi.fn().mockResolvedValue({
      data: [{ id: 'a', keyword: 'x', longtails: [], priority: 5, angle: null, post_type: null }],
      error: null,
    })
    const order1 = vi.fn().mockReturnValue({ order: order2 })
    const eq = vi.fn().mockReturnValue({ order: order1 })
    const select = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValueOnce({ select })

    const r = await getAvailableKeywords({ sector: 'medical' })
    expect(r.length).toBe(1)
    expect(eq).toHaveBeenCalledWith('sector', 'medical')
    expect(order1).toHaveBeenCalledWith('used_count', { ascending: true })
  })
})
