// T-256 — rate-limit util 테스트.
// Upstash 모킹 어렵고 핵심 로직은 (a) IP 추출, (b) env 미설정 dev fallback.
// limiter 자체 동작은 @upstash/ratelimit 의 단위 테스트가 보장.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const ORIGINAL_URL = process.env.UPSTASH_REDIS_REST_URL
const ORIGINAL_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

afterEach(() => {
  if (ORIGINAL_URL === undefined) delete process.env.UPSTASH_REDIS_REST_URL
  else process.env.UPSTASH_REDIS_REST_URL = ORIGINAL_URL
  if (ORIGINAL_TOKEN === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN
  else process.env.UPSTASH_REDIS_REST_TOKEN = ORIGINAL_TOKEN
  vi.unstubAllEnvs()
  vi.resetModules()
})

beforeEach(() => {
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  delete process.env.KV_REST_API_URL
  delete process.env.KV_REST_API_TOKEN
  vi.resetModules()
})

describe('clientIpFromHeaders', () => {
  it('x-forwarded-for 첫 항목 추출', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    const get = (name: string) => name === 'x-forwarded-for' ? '203.0.113.1, 10.0.0.1, 192.168.0.1' : null
    expect(clientIpFromHeaders(get)).toBe('203.0.113.1')
  })

  it('x-forwarded-for 단일 IP', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    const get = (name: string) => name === 'x-forwarded-for' ? '203.0.113.5' : null
    expect(clientIpFromHeaders(get)).toBe('203.0.113.5')
  })

  it('x-forwarded-for 없으면 x-real-ip fallback', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    const get = (name: string) => name === 'x-real-ip' ? '198.51.100.7' : null
    expect(clientIpFromHeaders(get)).toBe('198.51.100.7')
  })

  it('헤더 모두 누락 → unknown', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    expect(clientIpFromHeaders(() => null)).toBe('unknown')
  })

  it('x-forwarded-for 빈 문자열 → x-real-ip fallback', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    const get = (name: string) => {
      if (name === 'x-forwarded-for') return ''
      if (name === 'x-real-ip') return '203.0.113.99'
      return null
    }
    expect(clientIpFromHeaders(get)).toBe('203.0.113.99')
  })

  it('x-forwarded-for whitespace 만 → x-real-ip fallback', async () => {
    const { clientIpFromHeaders } = await import('@/lib/security/rate-limit')
    const get = (name: string) => {
      if (name === 'x-forwarded-for') return '   '
      if (name === 'x-real-ip') return '203.0.113.99'
      return null
    }
    // 첫 split 결과가 trim 후 빈 문자열 → fallback. 현재 구현은 빈 문자열을 truthy 체크로 거름.
    expect(clientIpFromHeaders(get)).toBe('203.0.113.99')
  })
})

describe('checkRateLimit — Upstash 설정됨 (mocked)', () => {
  it('Vercel Marketplace KV_REST_API_* 이름으로도 동작', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.fake.upstash.io')
    vi.stubEnv('KV_REST_API_TOKEN', 'fake-kv-token')

    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: true, remaining: 9, reset: Date.now() + 60_000, limit: 10 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.20', 'form')
    expect(r.success).toBe(true)
    expect(r.limit).toBe(10)
  })

  it('limit 통과 → success=true + remaining/limit/reset 반영', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')

    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: true, remaining: 4, reset: Date.now() + 60_000, limit: 5 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.10', 'diagnose')
    expect(r.success).toBe(true)
    expect(r.limit).toBe(5)
    expect(r.remaining).toBe(4)
  })

  it('limit 초과 → success=false', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')

    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: false, remaining: 0, reset: Date.now() + 30_000, limit: 5 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.99', 'form')
    expect(r.success).toBe(false)
    expect(r.remaining).toBe(0)
  })
})

describe('checkRateLimit — dev fallback (Upstash env 미설정)', () => {
  it('UPSTASH_* 미설정 → success=true (no-op)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.1', 'diagnose')
    expect(r.success).toBe(true)
    expect(r.remaining).toBe(999)
    expect(r.limit).toBe(999)
  })

  it('UPSTASH_* 미설정 → success=true (form kind)', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.2', 'form')
    expect(r.success).toBe(true)
    expect(r.limit).toBe(999)
  })

  it('프로덕션 환경 + UPSTASH_* 미설정 → success=false 로 hard-fail (T-259)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('203.0.113.3', 'diagnose')
    // T-259: 이전엔 fail-open(true) 였음. Codex consult #7 후속으로 production
    // 미설정을 hard-fail 로 변경 — 운영 실수가 즉시 503 으로 노출되어야 함.
    expect(r.success).toBe(false)
    expect(r.limit).toBe(0)
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })
})

describe('checkRateLimit — T-259 S2 신규 kind (ai_generate / external_search)', () => {
  it('ai_generate kind 라우팅 — limit=5 (분당 5회)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')

    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: true, remaining: 4, reset: Date.now() + 60_000, limit: 5 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('user-id-abc', 'ai_generate')
    expect(r.success).toBe(true)
    expect(r.limit).toBe(5)
    expect(r.remaining).toBe(4)
  })

  it('external_search kind 라우팅 — limit=30 (분당 30회)', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')

    const observedLimits: number[] = []
    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; observedLimits.push(n); return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: true, remaining: 29, reset: Date.now() + 60_000, limit: 30 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('user-id-xyz', 'external_search')
    expect(r.success).toBe(true)
    expect(r.limit).toBe(30)
    // limiter 4종(diagnose=5, form=10, ai_generate=5, external_search=30) 모두 모듈 평가 시점에 등록.
    expect(observedLimits).toContain(30)
    expect(observedLimits).toContain(5)
    expect(observedLimits).toContain(10)
  })

  it('ai_generate 초과 시 success=false', async () => {
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://fake.upstash.io')
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'fake-token')

    vi.doMock('@upstash/redis', () => ({
      Redis: class { constructor(_opts: unknown) { void _opts } },
    }))
    vi.doMock('@upstash/ratelimit', () => ({
      Ratelimit: class {
        static slidingWindow(n: number, _w: string) { void _w; return { limit: n } as unknown }
        constructor(_opts: unknown) { void _opts }
        async limit(_key: string) {
          void _key
          return { success: false, remaining: 0, reset: Date.now() + 45_000, limit: 5 }
        }
      },
    }))

    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('user-id-abuser', 'ai_generate')
    expect(r.success).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('production + UPSTASH 미설정 → ai_generate 도 hard-fail', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { checkRateLimit } = await import('@/lib/security/rate-limit')
    const r = await checkRateLimit('user-id-abc', 'ai_generate')
    expect(r.success).toBe(false)
    expect(r.limit).toBe(0)
    errSpy.mockRestore()
  })
})
