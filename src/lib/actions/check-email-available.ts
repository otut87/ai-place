'use server'

// 가입 페이지용 이메일 중복 조회.
// customers.email 기준. fail-open (admin 불가 시 available 반환)해서
// 네트워크 에러로 회원가입이 막히는 일 방지.
//
// 보안 노트:
// - T-259 S6: enumeration 차단을 위해 IP 기반 rate-limit (form kind, 분당 10회) 적용.
//   초과 시 error 반환 — 가입 흐름이 막히지만 enumeration 도구도 막힘.

import { headers } from 'next/headers'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { checkRateLimit, clientIpFromHeaders } from '@/lib/security/rate-limit'

export type EmailAvailability =
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }
  | { status: 'rate_limited'; retryAfterSec: number }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function checkEmailAvailableAction(rawEmail: string): Promise<EmailAvailability> {
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { status: 'invalid' }

  // T-259 S6 — IP 기반 rate-limit. 가입 흐름의 정상 사용은 분당 10회로 충분.
  const h = await headers()
  const ip = clientIpFromHeaders(name => h.get(name))
  const rl = await checkRateLimit(ip, 'form')
  if (!rl.success) {
    const seconds = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000))
    return { status: 'rate_limited', retryAfterSec: seconds }
  }

  const admin = getAdminClient()
  if (!admin) return { status: 'available' } // fail-open

  const { data, error } = await admin
    .from('customers')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    return { status: 'error', message: '조회 실패' }
  }
  return { status: data ? 'taken' : 'available' }
}
