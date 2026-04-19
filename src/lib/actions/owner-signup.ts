'use server'

// T-149 — Owner 셀프 회원가입 + 자동 customers row 생성.
import { createClient as createServerClient } from '@/lib/supabase/server'
import { getAdminClient } from '@/lib/supabase/admin-client'

export interface SignupInput {
  email: string
  password: string
  name?: string
  phone?: string
  termsAgreed: boolean
}

export type SignupOutcome =
  | { success: true; userId: string; customerId: string; requiresVerification: boolean }
  | { success: false; error: string }

export async function ownerSignupAction(input: SignupInput): Promise<SignupOutcome> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: '올바른 이메일 주소를 입력해 주세요' }
  }
  if (!input.password || input.password.length < 8) {
    return { success: false, error: '비밀번호는 최소 8자 이상이어야 합니다' }
  }
  if (!input.termsAgreed) {
    return { success: false, error: '이용약관에 동의해 주세요' }
  }

  const supabase = await createServerClient()

  // 1) Supabase Auth 가입
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: 'https://aiplace.kr/owner',
    },
  })
  if (authError || !authData.user) {
    return { success: false, error: authError?.message ?? '회원가입 실패' }
  }

  const userId = authData.user.id

  // 2) customers row 생성 (이미 있으면 연결만)
  const admin = getAdminClient()
  if (!admin) {
    return { success: false, error: 'admin_unavailable' }
  }

  const { data: existing } = await admin
    .from('customers')
    .select('id, user_id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    const row = existing as { id: string; user_id: string | null }
    if (!row.user_id) {
      await admin.from('customers').update({ user_id: userId }).eq('id', row.id)
    }
    return {
      success: true,
      userId,
      customerId: row.id,
      requiresVerification: !authData.session,
    }
  }

  // T-171: 파일럿 30일 자동 적용
  const trialStart = new Date()
  const trialEnd = new Date(trialStart.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { data: newCustomer, error: custError } = await admin
    .from('customers')
    .insert({
      email,
      name: input.name?.trim() || null,
      phone: input.phone?.trim() || null,
      user_id: userId,
      trial_started_at: trialStart.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
    })
    .select('id')
    .single()
  if (custError || !newCustomer) {
    return { success: false, error: custError?.message ?? 'customer 생성 실패' }
  }

  return {
    success: true,
    userId,
    customerId: (newCustomer as { id: string }).id,
    requiresVerification: !authData.session,
  }
}
