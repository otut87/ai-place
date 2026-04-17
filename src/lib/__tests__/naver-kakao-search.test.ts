/**
 * naver-kakao-search.ts 테스트
 * register-place server action 이 sameAs URL 을 조회할 때 사용.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  process.env.NAVER_CLIENT_ID = 'nid'
  process.env.NAVER_CLIENT_SECRET = 'nsecret'
  process.env.KAKAO_REST_KEY = 'kkey'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('searchNaverPlace', () => {
  it('첫 번째 아이템을 네이버 플레이스 검색 URL 형식으로 변환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        items: [{ title: '<b>닥터에버스</b>', link: 'https://x', roadAddress: '충남 천안시 서북구 불당25로 32', address: '충남 천안시 불당동' }],
      }),
    })
    const { searchNaverPlace } = await import('@/lib/naver-kakao-search')
    const res = await searchNaverPlace('닥터에버스')
    expect(res).not.toBeNull()
    expect(res!.title).toBe('닥터에버스')
    expect(res!.link).toContain('m.place.naver.com/place/search/')
    expect(res!.address).toBe('충남 천안시 서북구 불당25로 32')
  })

  it('items 가 비었으면 null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { searchNaverPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchNaverPlace('x')).toBeNull()
  })

  it('env 없으면 null (fetch 호출 안 함)', async () => {
    delete process.env.NAVER_CLIENT_ID
    const { searchNaverPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchNaverPlace('x')).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('HTTP 에러 → null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })
    const { searchNaverPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchNaverPlace('x')).toBeNull()
  })

  it('fetch 예외 → null (throw 안 함)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('network'))
    const { searchNaverPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchNaverPlace('x')).toBeNull()
  })
})

describe('searchKakaoPlace', () => {
  it('첫 번째 document 를 카카오맵 URL 과 함께 반환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        documents: [{ place_name: '닥터에버스', place_url: 'https://place.map.kakao.com/123', road_address_name: '충남 천안시 서북구 불당25로 32' }],
      }),
    })
    const { searchKakaoPlace } = await import('@/lib/naver-kakao-search')
    const res = await searchKakaoPlace('닥터에버스')
    expect(res).not.toBeNull()
    expect(res!.placeName).toBe('닥터에버스')
    expect(res!.placeUrl).toBe('https://place.map.kakao.com/123')
  })

  it('KakaoAK 헤더 전송', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [] }) })
    const { searchKakaoPlace } = await import('@/lib/naver-kakao-search')
    await searchKakaoPlace('x')
    const init = mockFetch.mock.calls[0][1]
    expect(init.headers.Authorization).toBe('KakaoAK kkey')
  })

  it('env 없으면 null', async () => {
    delete process.env.KAKAO_REST_KEY
    const { searchKakaoPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchKakaoPlace('x')).toBeNull()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('documents 비었으면 null', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [] }) })
    const { searchKakaoPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchKakaoPlace('x')).toBeNull()
  })

  it('fetch 예외 → null', async () => {
    mockFetch.mockRejectedValueOnce(new Error('boom'))
    const { searchKakaoPlace } = await import('@/lib/naver-kakao-search')
    expect(await searchKakaoPlace('x')).toBeNull()
  })
})
