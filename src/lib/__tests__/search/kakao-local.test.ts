/**
 * kakao-local.ts 테스트 (T-011)
 * Kakao Local Search Keyword API 클라이언트.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  process.env.KAKAO_REST_KEY = 'test-key'
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const SAMPLE_RESPONSE = {
  documents: [
    {
      id: '27502030',
      place_name: '차앤박피부과의원 천안점',
      address_name: '충남 천안시 서북구 불당동 1118',
      road_address_name: '충남 천안시 서북구 불당25로 32',
      phone: '041-523-8889',
      category_name: '의료,건강 > 병원 > 피부과',
      category_group_code: 'HP8',
      x: '127.1199',
      y: '36.8189',
      place_url: 'http://place.map.kakao.com/27502030',
    },
  ],
  meta: { total_count: 1, pageable_count: 1, is_end: true },
}

describe('kakaoLocalSearch', () => {
  it('정상 응답 파싱 — camelCase + 숫자 좌표', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => SAMPLE_RESPONSE,
    })
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    const results = await kakaoLocalSearch('차앤박피부과 천안')
    expect(results).toHaveLength(1)
    expect(results[0]).toMatchObject({
      id: '27502030',
      placeName: '차앤박피부과의원 천안점',
      roadAddressName: '충남 천안시 서북구 불당25로 32',
      addressName: '충남 천안시 서북구 불당동 1118',
      categoryName: '의료,건강 > 병원 > 피부과',
      categoryGroupCode: 'HP8',
      phone: '041-523-8889',
      placeUrl: 'http://place.map.kakao.com/27502030',
    })
    // x = longitude, y = latitude (Kakao convention)
    expect(results[0].longitude).toBeCloseTo(127.1199, 3)
    expect(results[0].latitude).toBeCloseTo(36.8189, 3)
  })

  it('Authorization 헤더 + query string', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [], meta: {} }) })
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    await kakaoLocalSearch('테스트')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('dapi.kakao.com/v2/local/search/keyword.json')
    expect(url).toContain('query=')
    expect(init.headers.Authorization).toBe('KakaoAK test-key')
  })

  it('빈 query → 빈 배열 (네트워크 호출 안 함)', async () => {
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    const results = await kakaoLocalSearch('')
    expect(results).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('KAKAO_REST_KEY 없으면 빈 배열 + warn', async () => {
    delete process.env.KAKAO_REST_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    const results = await kakaoLocalSearch('테스트')
    expect(results).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('HTTP 에러 → 빈 배열 (fetch 예외 X)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    const results = await kakaoLocalSearch('테스트')
    expect(results).toEqual([])
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  it('네트워크 에러 → 빈 배열', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNRESET'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    const results = await kakaoLocalSearch('테스트')
    expect(results).toEqual([])
    errSpy.mockRestore()
  })

  it('size 파라미터 적용 (기본 15, 범위 1-15)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [], meta: {} }) })
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    await kakaoLocalSearch('x', { size: 5 })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('size=5')
  })

  it('size 범위 초과 시 clamp', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ documents: [], meta: {} }) })
    const { kakaoLocalSearch } = await import('@/lib/search/kakao-local')
    await kakaoLocalSearch('x', { size: 50 })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('size=15')
  })
})
