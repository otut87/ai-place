// T-149 — Owner 로그인 페이지. login.html 디자인 충실 재현.
// 좌측 promo 는 sticky 고정 (AuthPromo), 우측 폼만 교체/스크롤.
import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getOwnerUser } from '@/lib/owner/auth'
import { LoginForm } from './login-form'
import { AuthPromo } from '@/components/auth/auth-promo'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/signup.css'

export const dynamic = 'force-dynamic'

const TITLE = composePageTitle('로그인 — AI Place 오너 포털')

export const metadata: Metadata = {
  title: TITLE,
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false },
}

export default async function LoginPage() {
  const user = await getOwnerUser()
  if (user) redirect('/owner')

  return (
    <div className="auth-root">
      <div className="split">
        <AuthPromo />

        <section className="form-side">
          <div className="form-wrap">
            <div className="tab-row">
              <Link className="active" href="/login">
                로그인
              </Link>
              <Link href="/signup">회원가입</Link>
            </div>

            <h1 className="ttl">
              다시 오신 걸 <span className="it">환영합니다</span>
            </h1>
            <p className="subtitle">
              등록한 업체의 AI 인용 이력을 확인하고 프로필을 관리하세요.
            </p>

            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </section>
      </div>
    </div>
  )
}
