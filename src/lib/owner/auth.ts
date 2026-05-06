// T-054 — 사장님(Owner) 전용 인증 헬퍼.
// Admin 화이트리스트와 달리, 로그인된 모든 사용자가 본인 소유 업체에만 접근 가능.
//
// Phase 1 / A1 (2026-05-06): React cache() 로 같은 request 내 다중 호출이 1회의
// Supabase Auth round-trip 으로 통합됨. middleware → owner layout → owner page
// 3중 호출 방어. 패턴 출처: Next.js 16 공식 authentication 가이드 (DAL).

import { cache } from 'react'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface OwnerUser {
  id: string
  email: string | null
}

export const getOwnerUser = cache(async (): Promise<OwnerUser | null> => {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
})

export async function requireOwnerUser(nextPath = '/owner'): Promise<OwnerUser> {
  const user = await getOwnerUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  return user
}

export async function requireOwnerForAction(): Promise<OwnerUser> {
  const user = await getOwnerUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}
