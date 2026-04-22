import { describe, it, expect, vi, beforeEach } from 'vitest'

interface State {
  mentions: Array<{ page_path: string; page_type: string; place_id: string; created_at: string }>
  blogs: Array<{
    slug: string; title: string | null; summary: string | null; content: string | null
    tags: string[] | null; status: string | null; published_at: string | null
    thumbnail_url: string | null; city: string | null; sector: string | null
    post_type: string | null; created_at: string | null
  }>
  mentionsError: { message: string } | null
  blogsError: { message: string } | null
}

const state: State = {
  mentions: [],
  blogs: [],
  mentionsError: null,
  blogsError: null,
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'place_mentions') {
        return {
          select: () => ({
            in: () => ({
              neq: async () => state.mentionsError
                ? { data: null, error: state.mentionsError }
                : { data: state.mentions, error: null },
            }),
          }),
        }
      }
      if (table === 'blog_posts') {
        return {
          select: () => ({
            in: async () => state.blogsError
              ? { data: null, error: state.blogsError }
              : { data: state.blogs, error: null },
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

beforeEach(() => {
  state.mentions = []
  state.blogs = []
  state.mentionsError = null
  state.blogsError = null
})

describe('loadOwnerContent', () => {
  it('placeIds 빈 → items/counts 0', async () => {
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent([])
    expect(r.items).toEqual([])
    expect(r.counts).toEqual({ detail: 0, compare: 0, guide: 0, keyword: 0 })
  })

  it('admin null → items/counts 0', async () => {
    const mod = await import('@/lib/supabase/admin-client')
    vi.mocked(mod.getAdminClient).mockReturnValueOnce(null as never)
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toEqual([])
  })

  it('place_mentions 에러 → items/counts 0', async () => {
    state.mentionsError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toEqual([])
    spy.mockRestore()
  })

  it('seed compare/guide/keyword 매핑 (post_type 조회 없이 탭 분류)', async () => {
    state.mentions = [
      { page_path: '/compare/cheonan/derm/x', page_type: 'compare', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
      { page_path: '/guide/cheonan/derm', page_type: 'guide', place_id: 'p-1', created_at: '2026-04-21T00:00:00Z' },
      { page_path: '/cheonan/derm/k/kw-1', page_type: 'keyword', place_id: 'p-1', created_at: '2026-04-22T00:00:00Z' },
    ]
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toHaveLength(3)
    expect(r.counts.compare).toBe(1)
    expect(r.counts.guide).toBe(1)
    expect(r.counts.keyword).toBe(1)
    // 최신 sortKey(keyword — 2026-04-22) 가 맨 앞
    expect(r.items[0].contentType).toBe('keyword')
  })

  it('blog 매핑 — post_type 기반 탭 분류 + 메타 보강', async () => {
    state.mentions = [
      { page_path: '/blog/cheonan/medical/p-detail', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
      { page_path: '/blog/cheonan/medical/p-compare', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-21T00:00:00Z' },
      { page_path: '/blog/cheonan/medical/p-general', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-22T00:00:00Z' },
    ]
    state.blogs = [
      {
        slug: 'p-detail', title: '업체 심층', summary: 'summary',
        content: '본문...', tags: ['tag1', 'tag2'], status: 'active',
        published_at: '2026-04-20T00:00:00Z', thumbnail_url: 'http://img/1.jpg',
        city: 'cheonan', sector: 'medical', post_type: 'detail',
        created_at: '2026-04-20T00:00:00Z',
      },
      {
        slug: 'p-compare', title: '비교', summary: null,
        content: 'XYZ', tags: null, status: 'active',
        published_at: '2026-04-21T00:00:00Z', thumbnail_url: null,
        city: 'cheonan', sector: 'medical', post_type: 'compare',
        created_at: '2026-04-21T00:00:00Z',
      },
      {
        slug: 'p-general', title: '일반', summary: null,
        content: null, tags: null, status: 'draft',
        published_at: null, thumbnail_url: null,
        city: 'cheonan', sector: 'medical', post_type: 'general',
        created_at: '2026-04-22T00:00:00Z',
      },
    ]
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toHaveLength(3)
    expect(r.counts.detail).toBe(1)
    expect(r.counts.compare).toBe(1)
    // general 은 탭에 포함 안 됨 (counts 미반영)
    expect(r.counts.guide).toBe(0)
    expect(r.counts.keyword).toBe(0)

    const byPath = new Map(r.items.map((i) => [i.path, i]))
    const d = byPath.get('/blog/cheonan/medical/p-detail')!
    expect(d.contentType).toBe('detail')
    expect(d.title).toBe('업체 심층')
    expect(d.summary).toBe('summary')
    expect(d.tags).toEqual(['tag1', 'tag2'])
    expect(d.charCount).toBe('본문...'.length)
    expect(d.city).toBe('cheonan')
    expect(d.sector).toBe('medical')
    expect(d.postType).toBe('detail')
    expect(d.thumbnailUrl).toBe('http://img/1.jpg')

    const g = byPath.get('/blog/cheonan/medical/p-general')!
    expect(g.contentType).toBeNull() // general → '전체' 탭에만
    expect(g.charCount).toBe(0)       // content null → 0
  })

  it('같은 path 에 여러 place 매핑 → placeIds 병합', async () => {
    state.mentions = [
      { page_path: '/blog/x', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
      { page_path: '/blog/x', page_type: 'blog', place_id: 'p-2', created_at: '2026-04-20T00:00:00Z' },
    ]
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1', 'p-2'])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].placeIds).toEqual(['p-1', 'p-2'])
  })

  it('blog_posts 조회 에러 → 보강 없이 items 반환', async () => {
    state.mentions = [
      { page_path: '/blog/cheonan/medical/x', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
    ]
    state.blogsError = { message: 'fail' }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].title).toBeNull()
    spy.mockRestore()
  })

  it('slug 매칭 실패 → blog 항목은 contentType null 유지', async () => {
    state.mentions = [
      { page_path: '/blog/cheonan/medical/x', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
    ]
    state.blogs = []  // 조회 결과 없음
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].contentType).toBeNull()
  })

  it('published_at 이 있으면 sortKey 로 사용 → 최신 순 정렬', async () => {
    state.mentions = [
      { page_path: '/blog/a/b/old', page_type: 'blog', place_id: 'p-1', created_at: '2026-01-01T00:00:00Z' },
      { page_path: '/blog/a/b/new', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-01T00:00:00Z' },
    ]
    state.blogs = [
      {
        slug: 'old', title: '오래된', summary: null, content: null, tags: null,
        status: 'active', published_at: '2026-04-22T00:00:00Z', thumbnail_url: null,
        city: 'a', sector: 'b', post_type: 'compare', created_at: '2026-01-01T00:00:00Z',
      },
      {
        slug: 'new', title: '최근', summary: null, content: null, tags: null,
        status: 'active', published_at: '2026-04-01T00:00:00Z', thumbnail_url: null,
        city: 'a', sector: 'b', post_type: 'guide', created_at: '2026-04-01T00:00:00Z',
      },
    ]
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    // published_at 이 더 최근인 'old' 가 앞에
    expect(r.items[0].path).toContain('/old')
  })

  it('city/sector 누락된 blog row 는 보강 스킵', async () => {
    state.mentions = [
      { page_path: '/blog/x/y/broken', page_type: 'blog', place_id: 'p-1', created_at: '2026-04-20T00:00:00Z' },
    ]
    state.blogs = [
      {
        slug: 'broken', title: 'Broken', summary: null, content: null, tags: null,
        status: null, published_at: null, thumbnail_url: null,
        city: null, sector: null, post_type: null, created_at: null,
      },
    ]
    const { loadOwnerContent } = await import('@/lib/owner/content-mentions')
    const r = await loadOwnerContent(['p-1'])
    expect(r.items).toHaveLength(1)
    expect(r.items[0].title).toBeNull()   // 보강 스킵되어 null 유지
  })

  it('CONTENT_TAB_KEYS export 확인', async () => {
    const { CONTENT_TAB_KEYS } = await import('@/lib/owner/content-mentions')
    expect(CONTENT_TAB_KEYS).toEqual(['detail', 'compare', 'guide', 'keyword'])
  })
})
