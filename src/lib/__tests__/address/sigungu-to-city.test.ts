import { describe, it, expect } from 'vitest'
import { sigunguToCity, cityFromAddress, SIGUNGU_TO_CITY } from '@/lib/address/sigungu-to-city'

describe('sigunguToCity', () => {
  it('천안 서북구 코드 → cheonan', () => {
    expect(sigunguToCity('44130')).toBe('cheonan')
  })
  it('천안 동남구 코드 → cheonan', () => {
    expect(sigunguToCity('44131')).toBe('cheonan')
  })
  it('알 수 없는 코드 → null', () => {
    expect(sigunguToCity('99999')).toBeNull()
  })
  it('빈 값 → null', () => {
    expect(sigunguToCity('')).toBeNull()
  })
})

describe('cityFromAddress', () => {
  it('"천안시" 포함 주소 → cheonan', () => {
    expect(cityFromAddress('충남 천안시 서북구 불당25로 32')).toBe('cheonan')
  })
  it('천안시 동남구', () => {
    expect(cityFromAddress('충남 천안시 동남구 신방동 464-1')).toBe('cheonan')
  })
  it('아산시 (MVP 미지원) → null', () => {
    expect(cityFromAddress('충남 아산시 탕정면')).toBeNull()
  })
  it('서울 (미지원) → null', () => {
    expect(cityFromAddress('서울 강남구 테헤란로 1')).toBeNull()
  })
  it('빈 값 → null', () => {
    expect(cityFromAddress('')).toBeNull()
    expect(cityFromAddress(null)).toBeNull()
  })
})

describe('SIGUNGU_TO_CITY map', () => {
  it('천안 시군구 코드 2개 정의', () => {
    const cheonanCodes = Object.entries(SIGUNGU_TO_CITY)
      .filter(([, v]) => v === 'cheonan')
      .map(([k]) => k)
    expect(cheonanCodes).toHaveLength(2)
    expect(cheonanCodes).toContain('44130')
    expect(cheonanCodes).toContain('44131')
  })
})
