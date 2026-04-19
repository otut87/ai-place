// T-112 — 도시 → addressRegion 매핑 + 주소 localization 테스트.
import { describe, it, expect } from 'vitest'
import { getCityAddressRegion, extractAddressLocality } from '@/lib/jsonld/address-region'

describe('getCityAddressRegion', () => {
  it('천안 → 충청남도', () => {
    expect(getCityAddressRegion('cheonan')).toBe('충청남도')
  })

  it('아산 → 충청남도', () => {
    expect(getCityAddressRegion('asan')).toBe('충청남도')
  })

  it('서울 → 서울특별시', () => {
    expect(getCityAddressRegion('seoul')).toBe('서울특별시')
  })

  it('부산 → 부산광역시', () => {
    expect(getCityAddressRegion('busan')).toBe('부산광역시')
  })

  it('미등록 city → null', () => {
    expect(getCityAddressRegion('unknown')).toBeNull()
  })
})

describe('extractAddressLocality', () => {
  it('주소 문자열에서 "~시" 추출', () => {
    expect(extractAddressLocality('충청남도 천안시 동남구 충절로 123', 'cheonan')).toBe('천안시')
  })

  it('"~군" 추출', () => {
    expect(extractAddressLocality('전라남도 진도군 진도읍', 'jindo')).toBe('진도군')
  })

  it('"~구" 추출', () => {
    expect(extractAddressLocality('서울특별시 강남구 테헤란로', 'seoul')).toBe('강남구')
  })

  it('매칭 실패 시 fallback 반환', () => {
    expect(extractAddressLocality('No Korean here', 'cheonan')).toBe('cheonan')
  })
})
