// T-149 — 공개 회원가입 페이지 (Owner).
// 2026-04-22: Claude Design 2단 레이아웃 (OAuth·추천코드·다국어 제거).
// 좌측 promo 는 /login 과 공유 (AuthPromo), sticky 로 고정.
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getOwnerUser } from '@/lib/owner/auth'
import { SignupForm } from './signup-form'
import { AuthPromo } from '@/components/auth/auth-promo'
import { composePageTitle } from '@/lib/seo/compose-title'
import '@/styles/aip.css'
import '@/styles/signup.css'

export const dynamic = 'force-dynamic'

const TITLE = composePageTitle('회원가입 — AI Place 오너 포털')
const DESC = '내 업체를 AI Place 에 직접 등록하고 AI 검색 노출을 시작하세요. 파일럿 30일 무료 · 이후 월 9,900원.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/signup' },
  robots: { index: false, follow: false },
}

export default async function SignupPage() {
  const user = await getOwnerUser()
  if (user) redirect('/owner')

  return (
    <div className="auth-root">
      <div className="split">
        <AuthPromo />

        <section className="form-side">
          <div className="form-wrap">
            <div className="tab-row">
              <Link href="/login">로그인</Link>
              <Link className="active" href="/signup">
                회원가입
              </Link>
            </div>

            <h1 className="ttl">
              사장님, <span className="it">환영합니다</span>
            </h1>
            <p className="subtitle">
              계정을 만들고 업체를 등록하면 AI 검색 노출을 시작합니다.{' '}
              <b>파일럿 30일 무료</b> · 이후 월 9,900원.
            </p>

            <SignupForm />
          </div>
        </section>
      </div>
    </div>
  )
}
