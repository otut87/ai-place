'use server'

// 가입 페이지용 이메일 중복 조회.
// customers.email 기준. fail-open (admin 불가 시 available 반환)해서
// 네트워크 에러로 회원가입이 막히는 일 방지.
//
// 보안 노트: enumeration 가능. SaaS 가입 플로우에서는 일반적 — 필요시 나중에
// 회원가입 속도 제한(캡차/rate-limit) 얹으면 충분.

import { getAdminClient } from '@/lib/supabase/admin-client'

export type EmailAvailability =
  | { status: 'available' }
  | { status: 'taken' }
  | { status: 'invalid' }
  | { status: 'error'; message: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function checkEmailAvailableAction(rawEmail: string): Promise<EmailAvailability> {
  const email = rawEmail.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return { status: 'invalid' }

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
