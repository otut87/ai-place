// T-256 — IP 기반 분산 rate limit (Upstash Redis sliding window).
//
// 목적: /check 진단 엔드포인트의 SSRF 호스트 차단(T-254 #2) 만으로 막지 못하는
// "DDoS 증폭 / cost amplification" 벡터 차단. 진단 한 번이 8 concurrent × 49
// sitemap pages = 최대 392 요청을 외부로 발사하므로, 분당 N회로 제한 필요.
//
// 환경변수 (둘 중 하나의 페어 사용):
//   - UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN (Upstash 콘솔 직접 발급)
//   - KV_REST_API_URL / KV_REST_API_TOKEN (Vercel Marketplace Upstash KV 통합 — 자동 주입)
//   미설정 시 graceful no-op (rate limit 없이 통과 — 개발 환경 호환).
//   프로덕션엔 반드시 설정.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number   // Unix ms — 다음 리셋 시각
  limit: number
}

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (redis) return redis
  // T-256 — Vercel Marketplace Upstash KV 통합은 KV_REST_API_* 이름으로 주입.
  // 직접 Upstash 사용은 UPSTASH_REDIS_REST_* 이름. 양쪽 다 지원.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

// /check 공개 진단 — 분당 5회 / IP. SSRF 증폭 + LLM 요청 부하 차단.
const diagnoseLimiter = (() => {
  const r = getRedis()
  if (!r) return null
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(5, '60 s'),
    analytics: true,
    prefix: 'aip:rl:diagnose',
  })
})()

// /signup, /lead capture 등 가벼운 폼 — 분당 10회 / IP.
const formLimiter = (() => {
  const r = getRedis()
  if (!r) return null
  return new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(10, '60 s'),
    analytics: true,
    prefix: 'aip:rl:form',
  })
})()

/**
 * IP 기반 rate limit 체크.
 * Upstash 미설정 시 always success (dev fallback).
 *
 * @param ip 요청자 IP (헤더에서 추출).
 * @param kind 'diagnose' = 분당 5회, 'form' = 분당 10회.
 */
export async function checkRateLimit(
  ip: string,
  kind: 'diagnose' | 'form',
): Promise<RateLimitResult> {
  const limiter = kind === 'diagnose' ? diagnoseLimiter : formLimiter
  if (!limiter) {
    // T-259 (Codex consult #7 후속): production fail-open 제거. UPSTASH/KV env
    // 누락이 silent pass 가 아닌 hard-block 으로 노출되어야 한다 — 30초 안에 발견.
    // dev/test 는 그대로 통과 (개발 환경 호환).
    if (process.env.NODE_ENV === 'production') {
      console.error(`[rate-limit] UPSTASH_REDIS_* / KV_REST_API_* unset in production — blocking (kind=${kind}).`)
      return { success: false, remaining: 0, reset: Date.now() + 60_000, limit: 0 }
    }
    return { success: true, remaining: 999, reset: 0, limit: 999 }
  }
  const r = await limiter.limit(ip)
  return {
    success: r.success,
    remaining: r.remaining,
    reset: r.reset,
    limit: r.limit,
  }
}

/**
 * Next.js Request 헤더에서 클라이언트 IP 추출.
 * Vercel: x-forwarded-for 첫 항목.
 * fallback: x-real-ip 또는 'unknown' (rate limit 비활성).
 */
export function clientIpFromHeaders(get: (name: string) => string | null): string {
  const xff = get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = get('x-real-ip')
  if (real) return real.trim()
  return 'unknown'
}
