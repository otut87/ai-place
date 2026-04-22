// T-197 — GSC performance-feedback 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({ from: mockFrom }),
}))

import {
  syncGSCMetrics,
  extractSlugFromPageUrl,
} from '@/lib/blog/performance-feedback'

beforeEach(() => {
  mockFrom.mockReset()
  delete process.env.GSC_ACCESS_TOKEN
  delete process.env.GSC_SITE_URL
})

describe('extractSlugFromPageUrl', () => {
  it('블로그 URL → slug', () => {
    expect(extractSlugFromPageUrl('https://aiplace.kr/blog/cheonan/medical/abc-123')).toBe('abc-123')
  })
  it('쿼리 스트링 무시', () => {
    expect(extractSlugFromPageUrl('https://aiplace.kr/blog/cheonan/medical/xyz?utm=1')).toBe('xyz')
  })
  it('blog 가 아닌 경로 → null', () => {
    expect(extractSlugFromPageUrl('https://aiplace.kr/cheonan/dermatology/a')).toBeNull()
  })
})

describe('syncGSCMetrics', () => {
  it('GSC_ACCESS_TOKEN 없으면 enabled=false 로 no-op', async () => {
    const r = await syncGSCMetrics()
    expect(r.enabled).toBe(false)
    expect(r.blogPostsUpdated).toBe(0)
  })

  it('GSC API 성공 시 blog_posts 갱신 + keyword 집계', async () => {
    process.env.GSC_ACCESS_TOKEN = 'gsc-test'
    process.env.GSC_SITE_URL = 'https://aiplace.kr/'

    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        rows: [
          { keys: ['https://aiplace.kr/blog/cheonan/medical/slug-a'], clicks: 20, impressions: 1000, ctr: 0.02, position: 8.5 },
          { keys: ['https://aiplace.kr/blog/cheonan/beauty/slug-b'], clicks: 5, impressions: 200, ctr: 0.025, position: 12.0 },
        ],
      }),
      text: async () => '',
    })) as unknown as typeof fetch

    // blog_posts update chain
    const bpUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
    const bpSelectChain = {
      not: vi.fn().mockReturnThis(),
      then: (cb: (r: unknown) => void) =>
        cb({ data: [
          { keyword_id: 'kw1', gsc_impressions: 1000, gsc_ctr: 0.03 },
          { keyword_id: 'kw1', gsc_impressions: 800, gsc_ctr: 0.05 },
        ], error: null }),
    }
    // keyword_bank update chain
    const kbUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'blog_posts') {
        // update() 호출을 위한 체인과 select() 체인을 분기
        return {
          update: bpUpdate,
          select: vi.fn().mockReturnValue(bpSelectChain),
        }
      }
      if (table === 'keyword_bank') {
        return { update: kbUpdate }
      }
      return {}
    })

    const r = await syncGSCMetrics({ fetchImpl: fakeFetch })

    expect(r.enabled).toBe(true)
    expect(r.fetchedRows).toBe(2)
    expect(r.blogPostsUpdated).toBe(2)
    expect(r.keywordsUpdated).toBe(1)   // kw1 하나로 집계
  })

  it('GSC API 4xx → enabled=false + errors', async () => {
    process.env.GSC_ACCESS_TOKEN = 'gsc-test'
    const fakeFetch = vi.fn(async () => ({
      ok: false,
      status: 403,
      text: async () => 'forbidden',
    })) as unknown as typeof fetch

    const r = await syncGSCMetrics({ fetchImpl: fakeFetch })
    expect(r.enabled).toBe(false)
    expect(r.errors.length).toBeGreaterThan(0)
  })
})
