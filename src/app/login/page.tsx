// T-149 — Owner 로그인 페이지 (admin/login 과 별도, 사장님 전용).
import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { LoginForm } from './login-form'
import { composePageTitle } from '@/lib/seo/compose-title'

const TITLE = composePageTitle('로그인 — AI Place 오너 포털')

export const metadata: Metadata = {
  title: TITLE,
  alternates: { canonical: '/login' },
  robots: { index: false, follow: false },
}

export default function LoginPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#f7f7f7]">
        <section className="mx-auto max-w-md px-6 py-16">
          <h1 className="text-2xl font-bold text-[#222222]">로그인</h1>
          <p className="mt-2 text-sm text-[#6a6a6a]">
            내 업체 대시보드와 진단 도구를 이용하세요.
          </p>

          <div className="mt-8 rounded-2xl border border-[#e7e7e7] bg-white p-6">
            <LoginForm />
          </div>

          <p className="mt-4 text-center text-xs text-[#6a6a6a]">
            아직 계정이 없으신가요? <Link href="/signup" className="text-[#008060] underline">회원가입</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
