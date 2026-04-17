/**
 * search/merge.ts 테스트 (T-014)
 */
import { describe, it, expect } from 'vitest'
import { mergeCandidates, type MergedCandidate } from '@/lib/search/merge'
import type { KakaoPlaceResult } from '@/lib/search/kakao-local'
import type { NaverPlaceResult } from '@/lib/search/naver-local'
import type { PlaceSearchResult } from '@/lib/google-places'

const kakao: KakaoPlaceResult = {
  id: 'k1',
  placeName: '차앤박피부과의원 천안점',
  addressName: '충남 천안시 서북구 불당동 1118',
  roadAddressName: '충남 천안시 서북구 불당25로 32',
  phone: '041-523-8889',
  categoryName: '의료,건강 > 병원 > 피부과',
  categoryGroupCode: 'HP8',
  longitude: 127.1199,
  latitude: 36.8189,
  placeUrl: 'http://place.map.kakao.com/k1',
  raw: {},
}

const google: PlaceSearchResult = {
  placeId: 'g1',
  name: 'Chaandpark Dermatology Cheonan',
  address: 'South Korea, 충남 천안시 서북구 불당25로 32',
  rating: 4.5,
  reviewCount: 178,
  latitude: 36.8189,
  longitude: 127.1199,
}

const naver: NaverPlaceResult = {
  title: '차앤박피부과의원 천안점',
  link: 'https://m.place.naver.com/place/n1',
  category: '피부과',
  description: '',
  telephone: null,
  address: '충남 천안시 서북구 불당동 1118',
  roadAddress: '충남 천안시 서북구 불당25로 32',
  longitude: 127.1199,
  latitude: 36.8189,
  raw: {},
}

describe('mergeCandidates', () => {
  it('3개 소스 동일 업체 → 1개 (sources 3)', () => {
    const merged = mergeCandidates({ kakao: [kakao], google: [google], naver: [naver] })
    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toEqual(expect.arrayContaining(['kakao', 'google', 'naver']))
  })

  it('다른 업체 3개 → 3개 유지', () => {
    const k2: KakaoPlaceResult = { ...kakao, id: 'k2', placeName: '전혀다른업체', roadAddressName: '서울 강남구 테헤란로 1', latitude: 37.5, longitude: 127.0 }
    const merged = mergeCandidates({ kakao: [kakao, k2], google: [google], naver: [naver] })
    expect(merged).toHaveLength(2)
  })

  it('병합 — Kakao 이름 + Google 평점 + 3 소스 sameAs', () => {
    const merged = mergeCandidates({ kakao: [kakao], google: [google], naver: [naver] })
    const m = merged[0]
    expect(m.displayName).toBe('차앤박피부과의원 천안점') // Kakao 우선 (한글)
    expect(m.rating).toBe(4.5) // Google 우선
    expect(m.reviewCount).toBe(178)
    expect(m.phone).toBe('041-523-8889')
    expect(m.googlePlaceId).toBe('g1')
    expect(m.kakaoPlaceId).toBe('k1')
    expect(m.naverLink).toBe('https://m.place.naver.com/place/n1')
    expect(m.sameAs).toEqual(expect.arrayContaining([
      'http://place.map.kakao.com/k1',
      'https://m.place.naver.com/place/n1',
    ]))
  })

  it('Kakao 만 있어도 동작', () => {
    const merged = mergeCandidates({ kakao: [kakao] })
    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toEqual(['kakao'])
  })

  it('모두 빈 배열 → 빈 결과', () => {
    expect(mergeCandidates({})).toEqual([])
  })

  it('좌표/주소 누락 방어 — 이름만 있는 Naver 결과', () => {
    const partial: NaverPlaceResult = { ...naver, latitude: 0, longitude: 0, roadAddress: null }
    const merged = mergeCandidates({ naver: [partial] })
    expect(merged).toHaveLength(1)
    expect(merged[0].sources).toEqual(['naver'])
  })
})

describe('MergedCandidate shape', () => {
  it('필수 필드 존재', () => {
    const merged = mergeCandidates({ kakao: [kakao] })
    const m: MergedCandidate = merged[0]
    expect(typeof m.displayName).toBe('string')
    expect(Array.isArray(m.sources)).toBe(true)
    expect(Array.isArray(m.sameAs)).toBe(true)
  })
})
