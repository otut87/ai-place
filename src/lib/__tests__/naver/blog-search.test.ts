/**
 * blog-search.ts 테스트 (T-021)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  process.env.NAVER_CLIENT_ID = 'test-id'
  process.env.NAVER_CLIENT_SECRET = 'test-secret'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const SAMPLE = {
  items: [
    {
      title: '<b>닥터에버스</b> 천안점 후기',
      link: 'https://blog.naver.com/abc/123',
      description: '피부과 <b>닥터에버스</b> 다녀왔어요. 친절했어요.',
      bloggername: '뷰티리뷰어',
      bloggerlink: 'https://blog.naver.com/abc',
      postdate: '20260301',
    },
  ],
}

describe('searchBlog', () => {
  it('title/description <b> 제거 + 필드 매핑', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => SAMPLE })
    const { searchBlog } = await import('@/lib/naver/blog-search')
    const results = await searchBlog('닥터에버스 천안')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('닥터에버스 천안점 후기')
    expect(results[0].description).toContain('닥터에버스')
    expect(results[0].description).not.toContain('<b>')
    expect(results[0].postdate).toBe('20260301')
  })

  it('Client 헤더 전송 + blog.json 엔드포인트', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { searchBlog } = await import('@/lib/naver/blog-search')
    await searchBlog('x')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('openapi.naver.com/v1/search/blog.json')
    expect(init.headers['X-Naver-Client-Id']).toBe('test-id')
    expect(init.headers['X-Naver-Client-Secret']).toBe('test-secret')
  })

  it('display 기본 30, 100 초과 clamp', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { searchBlog } = await import('@/lib/naver/blog-search')
    await searchBlog('x')
    expect(mockFetch.mock.calls[0][0]).toContain('display=30')

    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    await searchBlog('x', { display: 300 })
    expect(mockFetch.mock.calls[1][0]).toContain('display=100')
  })

  it('빈 query → 빈 배열, fetch 미호출', async () => {
    const { searchBlog } = await import('@/lib/naver/blog-search')
    expect(await searchBlog('')).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('키 없음 → 빈 배열 + warn', async () => {
    delete process.env.NAVER_CLIENT_ID
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { searchBlog } = await import('@/lib/naver/blog-search')
    const results = await searchBlog('x')
    expect(results).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('HTTP 5xx → 빈 배열', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { searchBlog } = await import('@/lib/naver/blog-search')
    expect(await searchBlog('x')).toEqual([])
    errSpy.mockRestore()
  })

  it('sort=date 옵션', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { searchBlog } = await import('@/lib/naver/blog-search')
    await searchBlog('x', { sort: 'date' })
    expect(mockFetch.mock.calls[0][0]).toContain('sort=date')
  })
})
