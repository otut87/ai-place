// 비밀번호 찾기 Step 1 — 이메일 입력 → Supabase 재설정 메일 발송.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getOwnerUser } from '@/lib/owner/auth'
import { AuthShell } from '@/components/auth/auth-shell'
import { ResetPasswordForm } from './reset-password-form'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/signup.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('비밀번호 찾기 — AI Place'),
  alternates: { canonical: '/account/reset-password' },
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage() {
  const user = await getOwnerUser()
  if (user) redirect('/owner')

  return (
    <AuthShell backHref="/login" backLabel="로그인으로">
      <h1 className="ttl">
        비밀번호 <span className="it">재설정</span>
      </h1>
      <p className="subtitle">
        가입 이메일을 입력하면 재설정 링크를 보내드립니다. 링크는 <b>1시간</b> 동안 유효합니다.
      </p>
      <ResetPasswordForm />
    </AuthShell>
  )
}
