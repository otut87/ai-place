// AI Place — Auth Helpers
// Supabase Auth를 통한 admin 인증. /admin/* 경로 보호용.

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/** 현재 세션의 유저를 반환. 미인증 시 null. */
export async function getUser() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Admin 허용 이메일 목록
const ADMIN_EMAILS = [
  'methoddesign7@gmail.com',
  'support@dedo.kr',
]

/** 인증 필수 + admin role 확인. 미인증/비admin 시 /admin/login으로 리다이렉트. */
export async function requireAuth() {
  const user = await getUser()
  if (!user || !ADMIN_EMAILS.includes(user.email ?? '')) {
    redirect('/admin/login')
  }
  return user
}

// signIn/signOut는 클라이언트 SDK에서 직접 처리.
// admin/login/page.tsx, admin/logout-button.tsx 참조.
