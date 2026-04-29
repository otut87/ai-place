// AI Place — Auth Helpers
// Supabase Auth를 통한 admin 인증. /admin/* 경로 보호용.
//
// T-259: ADMIN_EMAILS 는 src/lib/auth/admin-emails.ts (edge-runtime safe) 의 단일 source.
// middleware 도 동일 모듈에서 import 하므로 두 곳 동기화 필요 없음.

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminEmail } from '@/lib/auth/admin-emails'

/** 현재 세션의 유저를 반환. 미인증 시 null. */
export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/** 인증 필수 + admin role 확인. 미인증/비admin 시 /admin/login으로 리다이렉트. */
export async function requireAuth() {
  const user = await getUser()
  if (!user || !isAdminEmail(user.email)) {
    redirect('/admin/login')
  }
  return user
}

/** Server Action용 인증 체크. redirect 대신 에러를 throw.
 *  middleware가 이미 /admin/* 보호 중이므로 이중 방어용. */
export async function requireAuthForAction() {
  const user = await getUser()
  if (!user || !isAdminEmail(user.email)) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

/** 로그인된 모든 사용자 허용 (admin + owner).
 *  읽기 전용 외부 API 래퍼(네이버 검색, Google Places 보강, 옵션 조회 등)에서 사용. */
export async function requireLoggedInForAction() {
  const user = await getUser()
  if (!user) {
    throw new Error('UNAUTHORIZED')
  }
  return user
}

// signIn/signOut는 클라이언트 SDK에서 직접 처리.
// admin/login/page.tsx, admin/logout-button.tsx 참조.
