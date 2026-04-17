/**
 * naver-local.ts 테스트 (T-013)
 * https://openapi.naver.com/v1/search/local.json
 *
 * 참고: mapx, mapy 는 KATECH(EPSG:5179 또는 WGS84 변형) 정수형. 문서 표기 상
 * 긴 정수 (예: 1271204000) 로 들어오므로 1e7 로 나눠 degree 변환.
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
  lastBuildDate: 'Mon, 01 Jan 2026 00:00:00 +0900',
  total: 1,
  start: 1,
  display: 1,
  items: [
    {
      title: '<b>차앤박</b>피부과의원 천안점',
      link: 'https://pf.kakao.com/_abc',
      category: '피부과',
      description: '피부과 전문',
      telephone: '',
      address: '충남 천안시 서북구 불당동 1118',
      roadAddress: '충남 천안시 서북구 불당25로 32',
      mapx: '1271199000',
      mapy: '368189000',
    },
  ],
}

describe('naverLocalSearch', () => {
  it('title <b> 태그 제거 + 주소/좌표 변환', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => SAMPLE })
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    const results = await naverLocalSearch('차앤박피부과 천안')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('차앤박피부과의원 천안점')
    expect(results[0].roadAddress).toBe('충남 천안시 서북구 불당25로 32')
    // mapx/mapy: 1e7 scaling → degree
    expect(results[0].longitude).toBeCloseTo(127.1199, 3)
    expect(results[0].latitude).toBeCloseTo(36.8189, 3)
  })

  it('Client-Id / Client-Secret 헤더 전송', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    await naverLocalSearch('x')
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toContain('openapi.naver.com/v1/search/local.json')
    expect(init.headers['X-Naver-Client-Id']).toBe('test-id')
    expect(init.headers['X-Naver-Client-Secret']).toBe('test-secret')
  })

  it('display 기본 5, 범위 초과 시 clamp', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ items: [] }) })
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    await naverLocalSearch('x', { display: 20 })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('display=5')
  })

  it('빈 query → 빈 배열', async () => {
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    expect(await naverLocalSearch('')).toEqual([])
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('Client 키 없음 → 빈 배열 + warn', async () => {
    delete process.env.NAVER_CLIENT_ID
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    const results = await naverLocalSearch('x')
    expect(results).toEqual([])
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('HTTP 에러 → 빈 배열', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    const results = await naverLocalSearch('x')
    expect(results).toEqual([])
    errSpy.mockRestore()
  })

  it('HTML entity (&amp;) 디코드', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ items: [{ ...SAMPLE.items[0], title: 'A&amp;B 피부과' }] }),
    })
    const { naverLocalSearch } = await import('@/lib/search/naver-local')
    const results = await naverLocalSearch('x')
    expect(results[0].title).toBe('A&B 피부과')
  })
})
