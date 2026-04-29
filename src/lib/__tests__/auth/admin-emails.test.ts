// T-259 — admin allowlist edge-runtime safe 모듈.
// pure const + isAdminEmail() 만 검증. middleware (edge) 와 auth.ts (node) 양쪽
// 동일 source 가 되어야 self-admin-lockout 회피.

import { describe, it, expect } from 'vitest'
import { ADMIN_EMAILS, isAdminEmail } from '@/lib/auth/admin-emails'

describe('isAdminEmail', () => {
  it('null/undefined/empty → false', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })

  it('whitelist 정확 매칭만 통과 (case-sensitive)', () => {
    expect(isAdminEmail('methoddesign7@gmail.com')).toBe(true)
    expect(isAdminEmail('support@dedo.kr')).toBe(true)
    expect(isAdminEmail('support@aiplace.kr')).toBe(true)
    // 도메인이 같아도 로컬 파트가 다르면 불가
    expect(isAdminEmail('admin@aiplace.kr')).toBe(false)
    expect(isAdminEmail('foo@dedo.kr')).toBe(false)
    // 케이스 불일치는 차단 (normalize 안 함 — Supabase 가 lower-case 만 저장)
    expect(isAdminEmail('METHODDESIGN7@gmail.com')).toBe(false)
  })

  it('Q5 LOCKED — dedo + aiplace 둘 다 admin (운영/공개 분리)', () => {
    expect(ADMIN_EMAILS).toContain('support@dedo.kr')
    expect(ADMIN_EMAILS).toContain('support@aiplace.kr')
    // R1 grep 후에도 admin-emails.ts 의 dedo 는 제거되면 안 됨 (admin lockout 위험)
    expect(ADMIN_EMAILS.length).toBeGreaterThanOrEqual(3)
  })
})
