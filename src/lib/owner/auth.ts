// T-054 — 사장님(Owner) 전용 인증 헬퍼.
// Admin 화이트리스트와 달리, 로그인된 모든 사용자가 본인 소유 업체에만 접근 가능.

import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export interface OwnerUser {
  id: string
  email: string | null
}

export async function getOwnerUser(): Promise<OwnerUser | null> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return { id: user.id, email: user.email ?? null }
}

export async function requireOwnerUser(): Promise<OwnerUser> {
  const user = await getOwnerUser()
  if (!user) redirect('/admin/login?next=/owner')
  return user
}

export async function requireOwnerForAction(): Promise<OwnerUser> {
  const user = await getOwnerUser()
  if (!user) throw new Error('UNAUTHORIZED')
  return user
}
