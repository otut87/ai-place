// AI Place — Admin allowlist (edge-runtime safe).
//
// 이 파일은 절대로 next/navigation, server-only Supabase 클라이언트, 또는
// next/headers 를 import 하지 않는다. middleware (edge runtime) 와
// auth.ts (node runtime) 양쪽에서 같은 source 로 사용되어야 한다.
//
// 변경 시 두 곳 모두 영향: middleware allowlist (T-259), auth.ts requireAuth/requireAuthForAction.

export const ADMIN_EMAILS: readonly string[] = [
  'methoddesign7@gmail.com',
  'support@dedo.kr',
  'support@aiplace.kr',
] as const

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email)
}
