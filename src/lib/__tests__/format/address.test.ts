/**
 * format/address.ts 테스트 (T-010)
 */
import { describe, it, expect } from 'vitest'
import { normalizeAddress } from '@/lib/format/address'

describe('normalizeAddress', () => {
  it('"충청남도" → "충남"', () => {
    expect(normalizeAddress('충청남도 천안시 서북구 불당동 123'))
      .toBe('충남 천안시 서북구 불당동 123')
  })

  it('"서울특별시" → "서울"', () => {
    expect(normalizeAddress('서울특별시 강남구 테헤란로 1'))
      .toBe('서울 강남구 테헤란로 1')
  })

  it('"경기도" → "경기"', () => {
    expect(normalizeAddress('경기도 성남시 분당구'))
      .toBe('경기 성남시 분당구')
  })

  it('단축된 주소는 유지', () => {
    expect(normalizeAddress('충남 천안시 동남구 신방동 464-1번지'))
      .toBe('충남 천안시 동남구 신방동 464-1번지')
  })

  it('여분 공백 축약', () => {
    expect(normalizeAddress('충남   천안시   서북구'))
      .toBe('충남 천안시 서북구')
  })

  it('빈 값 → 빈 문자열', () => {
    expect(normalizeAddress('')).toBe('')
    expect(normalizeAddress(undefined)).toBe('')
  })

  it('광역시 약어 ("인천광역시" → "인천")', () => {
    expect(normalizeAddress('인천광역시 연수구')).toBe('인천 연수구')
  })
})
