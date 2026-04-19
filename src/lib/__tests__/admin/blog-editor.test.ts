import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderMarkdown } from '@/lib/admin/blog-editor'

describe('renderMarkdown', () => {
  it('헤딩 변환', () => {
    expect(renderMarkdown('# 제목')).toContain('<h1>제목</h1>')
    expect(renderMarkdown('### h3')).toContain('<h3>h3</h3>')
  })

  it('볼드/이탤릭', () => {
    expect(renderMarkdown('**강조** *약강조*')).toContain('<strong>강조</strong>')
    expect(renderMarkdown('**강조** *약강조*')).toContain('<em>약강조</em>')
  })

  it('링크 변환', () => {
    const r = renderMarkdown('[텍스트](https://example.com)')
    expect(r).toContain('<a href="https://example.com">텍스트</a>')
  })

  it('인라인 코드', () => {
    expect(renderMarkdown('`inline`')).toContain('<code>inline</code>')
  })

  it('코드블록', () => {
    const r = renderMarkdown('```\nconsole.log(1)\n```')
    expect(r).toContain('<pre><code>')
  })

  it('코드블록 내 HTML 이스케이프', () => {
    const r = renderMarkdown('```\n<script>alert(1)</script>\n```')
    expect(r).toContain('&lt;script&gt;')
    expect(r).not.toContain('<script>alert')
  })

  it('script 태그 제거', () => {
    const r = renderMarkdown('<script>alert(1)</script>\n\n본문')
    expect(r).not.toContain('<script>')
  })

  it('on* 속성 제거', () => {
    const r = renderMarkdown('<div onclick="alert(1)">x</div>')
    expect(r).not.toContain('onclick')
  })

  it('단락 변환 (연속 빈 줄)', () => {
    const r = renderMarkdown('첫 문단\n\n두번째 문단')
    expect(r).toContain('<p>첫 문단</p>')
    expect(r).toContain('<p>두번째 문단</p>')
  })
})

// DB 함수 스모크
const mockLimit = vi.fn()
const mockMaybeSingle = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({ from: mockFrom })),
}))

beforeEach(() => {
  mockLimit.mockReset()
  mockMaybeSingle.mockReset()
  mockFrom.mockReset()

  mockLimit.mockResolvedValue({
    data: [
      { id: '1', slug: 's', title: 'T', summary: 'S', category: 'dermatology', post_type: 'guide', created_at: '2026-04-20T00:00:00Z', status: 'draft' },
    ],
    error: null,
  })
  mockMaybeSingle.mockResolvedValue({ data: null, error: null })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({ limit: mockLimit })),
        order: vi.fn(() => ({ limit: mockLimit })),
        limit: mockLimit,
        maybeSingle: mockMaybeSingle,
      })),
    })),
  }))
})

describe('listDraftTopics', () => {
  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { listDraftTopics } = await import('@/lib/admin/blog-editor')
    expect(await listDraftTopics()).toEqual([])
  })

  it('draft 반환', async () => {
    const { listDraftTopics } = await import('@/lib/admin/blog-editor')
    const r = await listDraftTopics(50)
    expect(r).toHaveLength(1)
    expect(r[0].status).toBe('draft')
  })
})

describe('loadBlogPostForEdit', () => {
  it('admin null → null', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { loadBlogPostForEdit } = await import('@/lib/admin/blog-editor')
    expect(await loadBlogPostForEdit('x')).toBeNull()
  })

  it('없는 slug → null', async () => {
    const { loadBlogPostForEdit } = await import('@/lib/admin/blog-editor')
    expect(await loadBlogPostForEdit('missing')).toBeNull()
  })
})

describe('suggestInternalLinks', () => {
  it('category null → []', async () => {
    const { suggestInternalLinks } = await import('@/lib/admin/blog-editor')
    expect(await suggestInternalLinks(null, '')).toEqual([])
  })

  it('admin null → []', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { suggestInternalLinks } = await import('@/lib/admin/blog-editor')
    expect(await suggestInternalLinks('dermatology', '')).toEqual([])
  })

  it('place/blog 후보 병합 + content 에 이미 등장한 slug 는 제외한다', async () => {
    // 두 개의 from 호출 (places, blog_posts) 각각 limit 반환이 다르도록 구성
    const placesLimit = vi.fn().mockResolvedValue({
      data: [
        { slug: 'dr-evers', name: '닥터에버스의원', city: 'cheonan' },
        { slug: 'cleanhue', name: '클린휴의원', city: 'cheonan' },
      ],
    })
    const blogsLimit = vi.fn().mockResolvedValue({
      data: [
        { slug: 'acne-guide', title: '여드름 가이드' },
        { slug: 'scar-guide', title: '흉터 가이드' },
      ],
    })

    let call = 0
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: call++ === 0 ? placesLimit : blogsLimit })),
        })),
      })),
    }))

    const { suggestInternalLinks } = await import('@/lib/admin/blog-editor')
    // content 에 'cleanhue' + 'scar-guide' 포함 → 제외 대상
    const out = await suggestInternalLinks('dermatology', 'cleanhue 참고. scar-guide 도.')
    const slugs = out.map(o => o.slug)
    expect(slugs).toContain('dr-evers')
    expect(slugs).toContain('acne-guide')
    expect(slugs).not.toContain('cleanhue')
    expect(slugs).not.toContain('scar-guide')

    const place = out.find(o => o.slug === 'dr-evers')!
    expect(place.kind).toBe('place')
    expect(place.url).toBe('/cheonan/dermatology/dr-evers')

    const blog = out.find(o => o.slug === 'acne-guide')!
    expect(blog.kind).toBe('blog')
    expect(blog.url).toBe('/blog/acne-guide')
  })

  it('limit 에 의해 합계가 제한된다', async () => {
    const placesLimit = vi.fn().mockResolvedValue({
      data: Array.from({ length: 8 }, (_, i) => ({ slug: `p${i}`, name: `P${i}`, city: 'cheonan' })),
    })
    const blogsLimit = vi.fn().mockResolvedValue({
      data: Array.from({ length: 8 }, (_, i) => ({ slug: `b${i}`, title: `B${i}` })),
    })
    let call = 0
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: call++ === 0 ? placesLimit : blogsLimit })),
        })),
      })),
    }))
    const { suggestInternalLinks } = await import('@/lib/admin/blog-editor')
    const out = await suggestInternalLinks('dermatology', '', 5)
    expect(out.length).toBeLessThanOrEqual(5)
  })

  it('places/blogs 데이터가 null 이면 빈 배열을 반환한다', async () => {
    const nullLimit = vi.fn().mockResolvedValue({ data: null })
    mockFrom.mockImplementation(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ limit: nullLimit })),
        })),
      })),
    }))
    const { suggestInternalLinks } = await import('@/lib/admin/blog-editor')
    expect(await suggestInternalLinks('dermatology', '')).toEqual([])
  })
})

describe('renderMarkdown (추가 커버리지)', () => {
  it('h2/h4/h5/h6 도 렌더된다', () => {
    expect(renderMarkdown('## h2')).toContain('<h2>h2</h2>')
    expect(renderMarkdown('#### h4')).toContain('<h4>h4</h4>')
    expect(renderMarkdown('##### h5')).toContain('<h5>h5</h5>')
    expect(renderMarkdown('###### h6')).toContain('<h6>h6</h6>')
  })

  it('코드블록 안의 & < > 는 엔티티로 이스케이프', () => {
    const r = renderMarkdown('```\nA & <B>\n```')
    expect(r).toContain('&amp;')
    expect(r).toContain('&lt;B&gt;')
  })

  it('줄바꿈 하나는 <br/> 로', () => {
    const r = renderMarkdown('1행\n2행')
    expect(r).toContain('1행<br/>2행')
  })
})

describe('loadBlogPostForEdit (데이터 반환)', () => {
  it('slug 일치 → 레코드 반환', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'x',
        slug: 'y',
        title: 'T',
        summary: 'S',
        content: 'body',
        category: 'dermatology',
        status: 'draft',
        post_type: 'guide',
        target_query: null,
        tags: ['a'],
      },
      error: null,
    })
    const { loadBlogPostForEdit } = await import('@/lib/admin/blog-editor')
    const r = await loadBlogPostForEdit('y')
    expect(r?.slug).toBe('y')
    expect(r?.tags).toEqual(['a'])
  })
})
