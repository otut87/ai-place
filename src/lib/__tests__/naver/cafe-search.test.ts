/**
 * cafe-search.ts 테스트 (T-022)
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

describe('searchCafe', () => {
  it('cafearticle.json 엔드포인트 + HTML 태그 제거', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        items: [{
          title: '<b>천안</b> 피부과 추천 부탁드려요',
          link: 'https://cafe.naver.com/abc/123',
          description: '<b>천안</b> 거주 중인데요, 좋은 피부과 추천 받을 수 있을까요?',
          cafename: '맘카페',
          cafeurl: 'https://cafe.naver.com/abc',
        }],
      }),
    })
    const { searchCafe } = await import('@/lib/naver/cafe-search')
    const results = await searchCafe('천안 피부과 추천')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('천안 피부과 추천 부탁드려요')
    expect(results[0].description).not.toContain('<b>')
    expect(mockFetch.mock.calls[0][0]).toContain('openapi.naver.com/v1/search/cafearticle.json')
  })

  it('display 기본 20, clamp', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { searchCafe } = await import('@/lib/naver/cafe-search')
    await searchCafe('x')
    expect(mockFetch.mock.calls[0][0]).toContain('display=20')
  })

  it('빈 query → 빈 배열', async () => {
    const { searchCafe } = await import('@/lib/naver/cafe-search')
    expect(await searchCafe('')).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('키 없음 → 빈 배열 + warn', async () => {
    delete process.env.NAVER_CLIENT_SECRET
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { searchCafe } = await import('@/lib/naver/cafe-search')
    expect(await searchCafe('x')).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

describe('isSpam', () => {
  it('광고성 키워드 3개 이상 → 스팸', async () => {
    const { isSpam } = await import('@/lib/naver/cafe-search')
    expect(isSpam({
      title: '할인쿠폰 이벤트문의',
      description: '카톡상담 환영합니다',
    })).toBe(true)
  })

  it('광고성 키워드 2개 이하 → 통과', async () => {
    const { isSpam } = await import('@/lib/naver/cafe-search')
    expect(isSpam({
      title: '천안 피부과 후기',
      description: '할인쿠폰 있나요',
    })).toBe(false)
  })

  it('URL 3개 이상 도배 → 스팸', async () => {
    const { isSpam } = await import('@/lib/naver/cafe-search')
    expect(isSpam({
      title: '추천',
      description: 'https://a.com https://b.com https://c.com 보세요',
    })).toBe(true)
  })

  it('토토/카지노 등 강한 신호 다중 → 스팸', async () => {
    const { isSpam } = await import('@/lib/naver/cafe-search')
    expect(isSpam({
      title: '토토 바카라 슬롯',
      description: '문의환영',
    })).toBe(true)
  })
})

describe('searchCafe + 스팸 필터', () => {
  it('스팸 글 제외 후 반환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        items: [
          {
            title: '천안 피부과 후기', link: 'https://cafe.naver.com/a',
            description: '정상 글', cafename: '맘카페', cafeurl: 'x',
          },
          {
            title: '토토 바카라 슬롯', link: 'https://cafe.naver.com/b',
            description: '카지노 광고문의 무료상담', cafename: 'x', cafeurl: 'x',
          },
        ],
      }),
    })
    const { searchCafe } = await import('@/lib/naver/cafe-search')
    const results = await searchCafe('천안 피부과')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('천안 피부과 후기')
  })
})
