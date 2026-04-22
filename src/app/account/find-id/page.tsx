// 아이디(이메일) 찾기 — 휴대폰 번호 인증 후 마스킹된 이메일 반환.
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getOwnerUser } from '@/lib/owner/auth'
import { AuthShell } from '@/components/auth/auth-shell'
import { FindIdForm } from './find-id-form'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/signup.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: composePageTitle('아이디 찾기 — AI Place'),
  alternates: { canonical: '/account/find-id' },
  robots: { index: false, follow: false },
}

export default async function FindIdPage() {
  const user = await getOwnerUser()
  if (user) redirect('/owner')

  return (
    <AuthShell backHref="/login" backLabel="로그인으로">
      <h1 className="ttl">
        아이디(이메일) <span className="it">찾기</span>
      </h1>
      <p className="subtitle">
        가입 시 등록한 휴대폰 번호로 이메일을 찾아드립니다. 보안을 위해 일부만 표시됩니다.
      </p>
      <FindIdForm />
    </AuthShell>
  )
}
