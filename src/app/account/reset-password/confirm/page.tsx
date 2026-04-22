// 비밀번호 찾기 Step 2 — Supabase recovery 링크에서 도달.
// URL hash 에 access_token 이 실려 있고 Supabase 클라이언트가 자동 세션 설정.
import type { Metadata } from 'next'
import { AuthShell } from '@/components/auth/auth-shell'
import { ConfirmForm } from './confirm-form'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/signup.css'

export const metadata: Metadata = {
  title: composePageTitle('새 비밀번호 설정 — AI Place'),
  alternates: { canonical: '/account/reset-password/confirm' },
  robots: { index: false, follow: false },
}

export default function ConfirmPage() {
  return (
    <AuthShell>
      <h1 className="ttl">
        새 <span className="it">비밀번호</span> 설정
      </h1>
      <p className="subtitle">앞으로 사용할 새 비밀번호를 입력해 주세요.</p>
      <ConfirmForm />
    </AuthShell>
  )
}
