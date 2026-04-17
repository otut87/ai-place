/**
 * search/unified.ts 테스트 (T-014)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/search/kakao-local', () => ({ kakaoLocalSearch: vi.fn() }))
vi.mock('@/lib/search/naver-local', () => ({ naverLocalSearch: vi.fn() }))
vi.mock('@/lib/google-places', async () => {
  const actual = await vi.importActual<typeof import('@/lib/google-places')>('@/lib/google-places')
  return { ...actual, searchPlaceByText: vi.fn() }
})

import { kakaoLocalSearch } from '@/lib/search/kakao-local'
import { naverLocalSearch } from '@/lib/search/naver-local'
import * as gp from '@/lib/google-places'
import { unifiedSearch } from '@/lib/search/unified'

const mockKakao = kakaoLocalSearch as unknown as ReturnType<typeof vi.fn>
const mockNaver = naverLocalSearch as unknown as ReturnType<typeof vi.fn>
const mockGoogle = gp.searchPlaceByText as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockKakao.mockReset()
  mockNaver.mockReset()
  mockGoogle.mockReset()
})

describe('unifiedSearch', () => {
  it('3 소스 병렬 호출 후 Dedup/Merge', async () => {
    mockKakao.mockResolvedValue([{
      id: 'k1', placeName: '차앤박피부과 천안점',
      addressName: '충남 천안시 서북구 불당동 1118',
      roadAddressName: '충남 천안시 서북구 불당25로 32',
      phone: '041-523-8889',
      categoryName: '의료,건강 > 병원 > 피부과',
      categoryGroupCode: 'HP8',
      longitude: 127.1199, latitude: 36.8189,
      placeUrl: 'http://place.map.kakao.com/k1',
      raw: {},
    }])
    mockGoogle.mockResolvedValue([{
      placeId: 'g1', name: '차앤박피부과',
      address: '충남 천안시 서북구 불당25로 32',
      rating: 4.5, reviewCount: 178,
      latitude: 36.8189, longitude: 127.1199,
    }])
    mockNaver.mockResolvedValue([{
      title: '차앤박피부과의원 천안점',
      link: 'https://m.place.naver.com/n1',
      category: '피부과', description: '', telephone: null,
      address: '충남 천안시 서북구 불당동 1118',
      roadAddress: '충남 천안시 서북구 불당25로 32',
      longitude: 127.1199, latitude: 36.8189, raw: {},
    }])

    const results = await unifiedSearch('차앤박피부과 천안')
    expect(results).toHaveLength(1)
    expect(results[0].sources).toEqual(expect.arrayContaining(['kakao', 'google', 'naver']))
    expect(results[0].rating).toBe(4.5)
  })

  it('개별 소스 실패해도 나머지로 진행', async () => {
    mockKakao.mockResolvedValue([])
    mockGoogle.mockRejectedValue(new Error('api down'))
    mockNaver.mockResolvedValue([{
      title: '차앤박피부과', link: 'x', category: '피부과',
      description: '', telephone: null, address: '주소', roadAddress: '주소',
      latitude: 36.8, longitude: 127.0, raw: {},
    }])

    const results = await unifiedSearch('테스트')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].sources).toEqual(['naver'])
  })

  it('빈 query → 빈 결과, 3 소스 호출 안 함', async () => {
    const results = await unifiedSearch('')
    expect(results).toEqual([])
    expect(mockKakao).not.toHaveBeenCalled()
    expect(mockNaver).not.toHaveBeenCalled()
    expect(mockGoogle).not.toHaveBeenCalled()
  })
})
