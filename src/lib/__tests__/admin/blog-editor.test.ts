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
})
