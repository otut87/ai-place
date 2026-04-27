// T-246 — IP 도시명 → city slug 매핑.

import { describe, it, expect } from 'vitest'
import { ipCityToSlug, readIpCityFromHeaders } from '@/lib/geo/ip-to-city'

describe('ipCityToSlug', () => {
  it('Cheonan / cheonan-si / 천안시 → cheonan', () => {
    expect(ipCityToSlug('Cheonan')).toBe('cheonan')
    expect(ipCityToSlug('cheonan-si')).toBe('cheonan')
    expect(ipCityToSlug('Cheonan-si')).toBe('cheonan')
    expect(ipCityToSlug('천안')).toBe('cheonan')
    expect(ipCityToSlug('천안시')).toBe('cheonan')
  })

  it('Asan / asan-si / 아산시 → asan', () => {
    expect(ipCityToSlug('Asan')).toBe('asan')
    expect(ipCityToSlug('asan-si')).toBe('asan')
    expect(ipCityToSlug('아산')).toBe('asan')
    expect(ipCityToSlug('아산시')).toBe('asan')
  })

  it('URL-encoded "Cheonan%20si" 도 디코딩 후 매칭', () => {
    expect(ipCityToSlug('Cheonan%20si')).toBe('cheonan')
  })

  it('서울·대전·기타 도시는 null (커버리지 외)', () => {
    expect(ipCityToSlug('Seoul')).toBeNull()
    expect(ipCityToSlug('Daejeon')).toBeNull()
    expect(ipCityToSlug('Tokyo')).toBeNull()
  })

  it('빈 값 / null / undefined → null', () => {
    expect(ipCityToSlug(null)).toBeNull()
    expect(ipCityToSlug(undefined)).toBeNull()
    expect(ipCityToSlug('')).toBeNull()
  })

  it('잘못된 URL-encode 시퀀스도 try/catch 폴백으로 비정상 throw 안 함', () => {
    expect(ipCityToSlug('%E0%A4%A')).toBeNull()
  })
})

describe('readIpCityFromHeaders', () => {
  it('vercel 헤더 우선', () => {
    const get = (name: string) => {
      if (name === 'x-vercel-ip-city') return 'Cheonan'
      if (name === 'cf-ipcity') return 'Asan'
      return null
    }
    expect(readIpCityFromHeaders(get)).toBe('Cheonan')
  })

  it('vercel 없으면 cloudflare', () => {
    const get = (name: string) => (name === 'cf-ipcity' ? 'Asan' : null)
    expect(readIpCityFromHeaders(get)).toBe('Asan')
  })

  it('cf 도 없으면 x-ip-city 폴백', () => {
    const get = (name: string) => (name === 'x-ip-city' ? 'Cheonan' : null)
    expect(readIpCityFromHeaders(get)).toBe('Cheonan')
  })

  it('어떤 헤더도 없으면 null', () => {
    expect(readIpCityFromHeaders(() => null)).toBeNull()
  })
})
