// T-254 — verifyCronAuth 테스트.
// 핵심: VERCEL_CRON_SECRET 미설정 시 fail-closed (이전 버그는 fail-open 우회였음).

import { describe, it, expect, afterEach } from 'vitest'
import { verifyCronAuth } from '@/lib/cron/auth'

const ORIGINAL = process.env.VERCEL_CRON_SECRET

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.VERCEL_CRON_SECRET
  else process.env.VERCEL_CRON_SECRET = ORIGINAL
})

function makeReq(authHeader: string | null): Request {
  const headers = new Headers()
  if (authHeader !== null) headers.set('authorization', authHeader)
  return new Request('https://example.com/api/cron/anything', { headers })
}

describe('verifyCronAuth', () => {
  it('VERCEL_CRON_SECRET 미설정 → 503 (fail-closed)', async () => {
    delete process.env.VERCEL_CRON_SECRET
    const res = verifyCronAuth(makeReq('Bearer anything'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(503)
    const body = await res!.json()
    expect(body.error).toBe('cron_secret_unset')
  })

  it('VERCEL_CRON_SECRET 빈 문자열 → 503 (falsy = fail-closed)', async () => {
    process.env.VERCEL_CRON_SECRET = ''
    const res = verifyCronAuth(makeReq('Bearer something'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(503)
  })

  it('Authorization 헤더 누락 → 401', async () => {
    process.env.VERCEL_CRON_SECRET = 'topsecret'
    const res = verifyCronAuth(makeReq(null))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
    const body = await res!.json()
    expect(body.error).toBe('unauthorized')
  })

  it('잘못된 Bearer 토큰 → 401', async () => {
    process.env.VERCEL_CRON_SECRET = 'topsecret'
    const res = verifyCronAuth(makeReq('Bearer wrong'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('Bearer prefix 없이 raw token → 401', async () => {
    process.env.VERCEL_CRON_SECRET = 'topsecret'
    const res = verifyCronAuth(makeReq('topsecret'))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  it('올바른 Bearer + 일치 secret → null (통과)', async () => {
    process.env.VERCEL_CRON_SECRET = 'topsecret'
    const res = verifyCronAuth(makeReq('Bearer topsecret'))
    expect(res).toBeNull()
  })
})
