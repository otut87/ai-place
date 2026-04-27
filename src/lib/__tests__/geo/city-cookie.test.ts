// T-246 — city 쿠키 헬퍼.
// node 환경에서 document 를 vi.stubGlobal 로 모킹 (jsdom 미사용).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  CITY_COOKIE_NAME,
  CITY_COOKIE_MAX_AGE,
  CITY_ALL,
  isValidCityValue,
  setCityCookieClient,
  readCityCookieClient,
} from '@/lib/geo/city-cookie'

describe('isValidCityValue', () => {
  const slugs = ['cheonan', 'asan']

  it('"all" 은 항상 유효', () => {
    expect(isValidCityValue(CITY_ALL, slugs)).toBe(true)
  })

  it('등록된 city slug 만 유효', () => {
    expect(isValidCityValue('cheonan', slugs)).toBe(true)
    expect(isValidCityValue('asan', slugs)).toBe(true)
    expect(isValidCityValue('seoul', slugs)).toBe(false)
  })

  it('빈 값/null/undefined → false', () => {
    expect(isValidCityValue(null, slugs)).toBe(false)
    expect(isValidCityValue(undefined, slugs)).toBe(false)
    expect(isValidCityValue('', slugs)).toBe(false)
  })
})

describe('client cookie helpers — document mock', () => {
  let cookieJar = ''
  const docMock = {
    get cookie() {
      return cookieJar
    },
    set cookie(v: string) {
      const [pair] = v.split(';')
      const [name] = pair.split('=')
      const remaining = cookieJar
        .split('; ')
        .filter(c => c && !c.startsWith(`${name}=`))
        .join('; ')
      cookieJar = remaining ? `${remaining}; ${pair}` : pair
    },
  }

  beforeEach(() => {
    cookieJar = ''
    vi.stubGlobal('document', docMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('setCityCookieClient → readCityCookieClient 라운드트립', () => {
    setCityCookieClient('cheonan')
    expect(readCityCookieClient()).toBe('cheonan')
  })

  it('값 갱신', () => {
    setCityCookieClient('cheonan')
    setCityCookieClient('asan')
    expect(readCityCookieClient()).toBe('asan')
  })

  it('"all" 도 저장/읽기', () => {
    setCityCookieClient(CITY_ALL)
    expect(readCityCookieClient()).toBe(CITY_ALL)
  })

  it('쿠키 미설정 시 null', () => {
    expect(readCityCookieClient()).toBeNull()
  })

  it('쿠키 jar 에 다른 쿠키와 공존', () => {
    setCityCookieClient('asan')
    cookieJar = `${cookieJar}; foo=bar`
    expect(readCityCookieClient()).toBe('asan')
  })
})

describe('client cookie helpers — SSR 환경 (document 없음)', () => {
  it('setCityCookieClient 는 silent return', () => {
    expect(() => setCityCookieClient('cheonan')).not.toThrow()
  })

  it('readCityCookieClient 는 null', () => {
    expect(readCityCookieClient()).toBeNull()
  })
})

describe('readCityCookieServer', () => {
  it('next/headers cookies() get → value 반환', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({
        get: (name: string) => (name === 'aiplace-city' ? { value: 'cheonan' } : undefined),
      }),
    }))
    const mod = await import('@/lib/geo/city-cookie')
    expect(await mod.readCityCookieServer()).toBe('cheonan')
    vi.doUnmock('next/headers')
  })

  it('쿠키 미설정 → "all" 폴백', async () => {
    vi.doMock('next/headers', () => ({
      cookies: async () => ({ get: () => undefined }),
    }))
    vi.resetModules()
    const mod = await import('@/lib/geo/city-cookie')
    expect(await mod.readCityCookieServer()).toBe('all')
    vi.doUnmock('next/headers')
  })
})

describe('상수', () => {
  it('CITY_COOKIE_MAX_AGE 는 30일 (초)', () => {
    expect(CITY_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30)
  })
  it('쿠키 이름 안정성', () => {
    expect(CITY_COOKIE_NAME).toBe('aiplace-city')
  })
})
