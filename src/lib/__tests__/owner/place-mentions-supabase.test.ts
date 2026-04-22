import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase mock — action 별 고정 응답
interface State {
  upsertError: { message: string } | null
  upsertCount: number
  deleteError: { message: string } | null
  deleteCount: number
  selectRows: Array<{ place_id: string; page_type: string }>
  selectError: { message: string } | null
}

const state: State = {
  upsertError: null,
  upsertCount: 0,
  deleteError: null,
  deleteCount: 0,
  selectRows: [],
  selectError: null,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table !== 'place_mentions') throw new Error(`unexpected ${table}`)
      return {
        upsert: async () => state.upsertError
          ? { error: state.upsertError, count: null }
          : { error: null, count: state.upsertCount },
        delete: () => ({
          eq: async () => state.deleteError
            ? { error: state.deleteError, count: null }
            : { error: null, count: state.deleteCount },
        }),
        select: () => ({
          in: async () => state.selectError
            ? { data: null, error: state.selectError }
            : { data: state.selectRows, error: null },
        }),
      }
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  state.upsertError = null
  state.upsertCount = 0
  state.deleteError = null
  state.deleteCount = 0
  state.selectRows = []
  state.selectError = null
})

describe('upsertPlaceMentions', () => {
  it('빈 배열 → 0 반환', async () => {
    const { upsertPlaceMentions } = await import('@/lib/owner/place-mentions')
    const r = await upsertPlaceMentions([])
    expect(r.inserted).toBe(0)
    expect(r.total).toBe(0)
  })

  it('admin null → fail-soft', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { upsertPlaceMentions } = await import('@/lib/owner/place-mentions')
    const r = await upsertPlaceMentions([{ placeId: 'p', pagePath: '/x', pageType: 'blog' }])
    expect(r.inserted).toBe(0)
    expect(r.total).toBe(1)
    spy.mockRestore()
  })

  it('성공 → count 반영', async () => {
    state.upsertCount = 3
    const { upsertPlaceMentions } = await import('@/lib/owner/place-mentions')
    const r = await upsertPlaceMentions([
      { placeId: 'p-1', pagePath: '/a', pageType: 'blog' },
      { placeId: 'p-1', pagePath: '/b', pageType: 'blog' },
      { placeId: 'p-2', pagePath: '/c', pageType: 'compare' },
    ])
    expect(r.inserted).toBe(3)
    expect(r.total).toBe(3)
  })

  it('upsert 에러 → inserted 0', async () => {
    state.upsertError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { upsertPlaceMentions } = await import('@/lib/owner/place-mentions')
    const r = await upsertPlaceMentions([{ placeId: 'p', pagePath: '/x', pageType: 'blog' }])
    expect(r.inserted).toBe(0)
    spy.mockRestore()
  })
})

describe('fanOutBlogPost', () => {
  it('placeIds 각각에 blog pageType 으로 upsert', async () => {
    state.upsertCount = 2
    const { fanOutBlogPost } = await import('@/lib/owner/place-mentions')
    const r = await fanOutBlogPost({
      placeIds: ['p-1', 'p-2'],
      pagePath: '/blog/cheonan/medical/x',
    })
    expect(r.inserted).toBe(2)
    expect(r.total).toBe(2)
  })

  it('빈 placeIds 도 0 반환', async () => {
    const { fanOutBlogPost } = await import('@/lib/owner/place-mentions')
    const r = await fanOutBlogPost({ placeIds: [], pagePath: '/blog/x' })
    expect(r.inserted).toBe(0)
  })
})

describe('removeMentionsForPath', () => {
  it('admin null → 0', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { removeMentionsForPath } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPath('/x')).toBe(0)
  })

  it('정상 삭제 → count 반환', async () => {
    state.deleteCount = 5
    const { removeMentionsForPath } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPath('/blog/x')).toBe(5)
  })

  it('에러 → 0', async () => {
    state.deleteError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { removeMentionsForPath } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPath('/x')).toBe(0)
    spy.mockRestore()
  })
})

describe('removeMentionsForPlace', () => {
  it('admin null → 0', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { removeMentionsForPlace } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPlace('p-1')).toBe(0)
  })

  it('정상 삭제 → count', async () => {
    state.deleteCount = 2
    const { removeMentionsForPlace } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPlace('p-1')).toBe(2)
  })

  it('에러 → 0', async () => {
    state.deleteError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { removeMentionsForPlace } = await import('@/lib/owner/place-mentions')
    expect(await removeMentionsForPlace('p-1')).toBe(0)
    spy.mockRestore()
  })
})

describe('countMentionsByPlace', () => {
  it('빈 placeIds → 빈 map', async () => {
    const { countMentionsByPlace } = await import('@/lib/owner/place-mentions')
    const m = await countMentionsByPlace([])
    expect(m.size).toBe(0)
  })

  it('admin null → 각 place 에 0 초기화 반환', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { countMentionsByPlace } = await import('@/lib/owner/place-mentions')
    const m = await countMentionsByPlace(['p-1', 'p-2'])
    expect(m.size).toBe(2)
    expect(m.get('p-1')?.total).toBe(0)
  })

  it('조회 에러 → 각 place 에 0 초기화 반환', async () => {
    state.selectError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { countMentionsByPlace } = await import('@/lib/owner/place-mentions')
    const m = await countMentionsByPlace(['p-1'])
    expect(m.get('p-1')?.total).toBe(0)
    spy.mockRestore()
  })

  it('byType 집계 + contentMentions 는 place 제외', async () => {
    state.selectRows = [
      { place_id: 'p-1', page_type: 'place' },
      { place_id: 'p-1', page_type: 'blog' },
      { place_id: 'p-1', page_type: 'blog' },
      { place_id: 'p-1', page_type: 'compare' },
      { place_id: 'p-2', page_type: 'blog' },
    ]
    const { countMentionsByPlace } = await import('@/lib/owner/place-mentions')
    const m = await countMentionsByPlace(['p-1', 'p-2'])
    const c1 = m.get('p-1')
    expect(c1?.total).toBe(4)
    expect(c1?.byType.place).toBe(1)
    expect(c1?.byType.blog).toBe(2)
    expect(c1?.byType.compare).toBe(1)
    expect(c1?.contentMentions).toBe(3) // total - place(1) = 3

    const c2 = m.get('p-2')
    expect(c2?.total).toBe(1)
    expect(c2?.contentMentions).toBe(1)
  })

  it('알 수 없는 place_id 는 드롭 (map 에 빈 슬롯만)', async () => {
    state.selectRows = [
      { place_id: 'p-1', page_type: 'blog' },
      { place_id: 'unknown', page_type: 'blog' },
    ]
    const { countMentionsByPlace } = await import('@/lib/owner/place-mentions')
    const m = await countMentionsByPlace(['p-1'])
    expect(m.get('p-1')?.total).toBe(1)
    expect(m.has('unknown')).toBe(false)
  })
})

describe('normalizeBlogPostMentionType', () => {
  it('항상 "blog" 반환', async () => {
    const { normalizeBlogPostMentionType } = await import('@/lib/owner/place-mentions')
    expect(normalizeBlogPostMentionType()).toBe('blog')
  })
})
