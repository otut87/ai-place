/**
 * search/dedup.ts 테스트 (T-014)
 * 같은 업체 여부 판정: roadAddress 정규화 우선, 좌표+이름 유사도 폴백.
 */
import { describe, it, expect } from 'vitest'
import {
  stringSimilarity,
  isSameBusiness,
  normalizeAddressForMatch,
} from '@/lib/search/dedup'

describe('stringSimilarity (Dice coefficient)', () => {
  it('동일 문자열 → 1', () => {
    expect(stringSimilarity('차앤박피부과', '차앤박피부과')).toBe(1)
  })

  it('완전히 다르면 0 근처', () => {
    expect(stringSimilarity('abc', 'xyz')).toBeLessThan(0.2)
  })

  it('부분 일치 → 0~1 중간값', () => {
    const sim = stringSimilarity('차앤박피부과의원', '차앤박피부과')
    expect(sim).toBeGreaterThan(0.6)
    expect(sim).toBeLessThan(1)
  })

  it('지점명 포함 케이스', () => {
    const sim = stringSimilarity('차앤박피부과의원 천안점', '차앤박피부과의원')
    expect(sim).toBeGreaterThan(0.5)
  })

  it('빈 문자열 안전 처리', () => {
    expect(stringSimilarity('', '')).toBe(0)
    expect(stringSimilarity('a', '')).toBe(0)
  })
})

describe('normalizeAddressForMatch', () => {
  it('도/광역시 약어 통일 + 공백 축약 + 건물명 제거', () => {
    const a = normalizeAddressForMatch('충청남도 천안시 서북구 불당25로 32 연세나무스퀘어 2층')
    const b = normalizeAddressForMatch('충남 천안시 서북구 불당25로 32')
    expect(a).toBe(b)
  })

  it('대소문자/공백 무관', () => {
    expect(normalizeAddressForMatch('충남  천안시  서북구  불당25로  32'))
      .toBe(normalizeAddressForMatch('충남 천안시 서북구 불당25로 32'))
  })

  it('빈 값 → 빈 문자열', () => {
    expect(normalizeAddressForMatch('')).toBe('')
    expect(normalizeAddressForMatch(undefined)).toBe('')
  })
})

describe('isSameBusiness', () => {
  const base = {
    name: '차앤박피부과 천안점',
    roadAddress: '충남 천안시 서북구 불당25로 32',
    latitude: 36.8189,
    longitude: 127.1199,
  }

  it('동일 roadAddress → same', () => {
    expect(isSameBusiness(base, { ...base })).toBe(true)
  })

  it('roadAddress 표기만 다른 같은 주소 → same', () => {
    expect(isSameBusiness(base, {
      ...base,
      roadAddress: '충청남도 천안시 서북구 불당25로 32 연세나무스퀘어 2층',
    })).toBe(true)
  })

  it('좌표 50m 이내 + 이름 유사 → same', () => {
    expect(isSameBusiness(base, {
      name: '차앤박피부과의원',
      roadAddress: '충남 천안시 서북구 불당25로 30', // 주소 약간 다름
      latitude: 36.81895,
      longitude: 127.11995,
    })).toBe(true)
  })

  it('좌표 50m 이내 but 이름 전혀 다름 → different', () => {
    expect(isSameBusiness(base, {
      name: '전혀다른업체XYZ',
      roadAddress: '충남 천안시 서북구 불당25로 32',
      latitude: 36.8189,
      longitude: 127.1199,
    })).toBe(false)
  })

  it('좌표 1km 이상 떨어짐 → different (주소 다를 때)', () => {
    expect(isSameBusiness(base, {
      name: '차앤박피부과 천안점',
      roadAddress: '서울 강남구 테헤란로 1',
      latitude: 37.5,
      longitude: 127.0,
    })).toBe(false)
  })

  it('좌표 없이 주소만 일치 → same (방어적 매칭)', () => {
    expect(isSameBusiness(
      { name: 'A', roadAddress: '충남 천안시 서북구 불당25로 32' },
      { name: 'B', roadAddress: '충남 천안시 서북구 불당25로 32' },
    )).toBe(true)
  })

  it('둘 다 정보 불충분 → false', () => {
    expect(isSameBusiness({ name: 'A' }, { name: 'B' })).toBe(false)
  })
})
