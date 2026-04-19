/**
 * Phase 11 — enqueuePlaceRefresh / enqueuePlaceRefreshBySlug
 * 중복 dedup + 신규만 insert 확인.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockFrom.mockReset()
})

function setupSelectIn(existing: Array<{ job_type: string }>) {
  // select → eq → eq → in → in 체인
  const chain = {
    data: existing,
    error: null,
  }
  const chainInTwo = vi.fn().mockResolvedValue(chain)
  const chainInOne = vi.fn().mockReturnValue({ in: chainInTwo })
  const chainEqTwo = vi.fn().mockReturnValue({ in: chainInOne })
  const chainEqOne = vi.fn().mockReturnValue({ eq: chainEqTwo })
  const select = vi.fn().mockReturnValue({ eq: chainEqOne })
  return { select, chainEqOne, chainEqTwo, chainInOne, chainInTwo }
}

describe('enqueuePlaceRefresh', () => {
  it('기존 pending/running 이 없으면 요청한 kind 모두 insert', async () => {
    const { select } = setupSelectIn([])
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation(() => ({ select, insert }))

    const { enqueuePlaceRefresh } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefresh('p1', [
      'place.enrich_google',
      'place.summarize_google_reviews',
    ])
    expect(result.enqueued).toEqual([
      'place.enrich_google',
      'place.summarize_google_reviews',
    ])
    expect(result.skipped).toEqual([])
    expect(insert).toHaveBeenCalledTimes(1)
    const rows = insert.mock.calls[0][0] as Array<{ job_type: string; target_id: string }>
    expect(rows).toHaveLength(2)
    expect(rows[0].target_id).toBe('p1')
  })

  it('기존 pending 잡이 있으면 중복 skip', async () => {
    const { select } = setupSelectIn([{ job_type: 'place.enrich_google' }])
    const insert = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockImplementation(() => ({ select, insert }))

    const { enqueuePlaceRefresh } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefresh('p1', [
      'place.enrich_google',
      'place.summarize_google_reviews',
    ])
    expect(result.enqueued).toEqual(['place.summarize_google_reviews'])
    expect(result.skipped).toEqual(['place.enrich_google'])
  })

  it('모두 중복이면 insert 호출 없음', async () => {
    const { select } = setupSelectIn([
      { job_type: 'place.enrich_google' },
      { job_type: 'place.summarize_google_reviews' },
    ])
    const insert = vi.fn()
    mockFrom.mockImplementation(() => ({ select, insert }))

    const { enqueuePlaceRefresh } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefresh('p1', [
      'place.enrich_google',
      'place.summarize_google_reviews',
    ])
    expect(result.enqueued).toEqual([])
    expect(result.skipped).toHaveLength(2)
    expect(insert).not.toHaveBeenCalled()
  })

  it('admin 클라이언트 없으면 모두 skipped', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)

    const { enqueuePlaceRefresh } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefresh('p1', ['place.enrich_google'])
    expect(result.enqueued).toEqual([])
    expect(result.skipped).toEqual(['place.enrich_google'])
  })
})

describe('enqueuePlaceRefreshBySlug', () => {
  it('slug → id 조회 후 enqueuePlaceRefresh 호출', async () => {
    // 첫 번째 from 호출: id 조회 (select → eq → single)
    const single = vi.fn().mockResolvedValue({ data: { id: 'id-xx' }, error: null })
    const eqSlug = vi.fn().mockReturnValue({ single })
    const selectIdOnly = vi.fn().mockReturnValue({ eq: eqSlug })

    // 두 번째 from 호출: enqueue 내부의 중복 조회
    const { select } = setupSelectIn([])
    const insert = vi.fn().mockResolvedValue({ error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount += 1
      if (callCount === 1) return { select: selectIdOnly }
      return { select, insert }
    })

    const { enqueuePlaceRefreshBySlug } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefreshBySlug('my-slug', ['place.enrich_google'])
    expect(result.enqueued).toEqual(['place.enrich_google'])
  })

  it('slug 매칭 실패 시 모두 skipped', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqSlug = vi.fn().mockReturnValue({ single })
    const selectIdOnly = vi.fn().mockReturnValue({ eq: eqSlug })
    mockFrom.mockImplementation(() => ({ select: selectIdOnly }))

    const { enqueuePlaceRefreshBySlug } = await import('@/lib/admin/pipeline-jobs')
    const result = await enqueuePlaceRefreshBySlug('missing', ['place.enrich_google'])
    expect(result.enqueued).toEqual([])
    expect(result.skipped).toEqual(['place.enrich_google'])
  })
})
