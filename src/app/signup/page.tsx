// T-149 — 공개 회원가입 페이지 (Owner).
import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SignupForm } from './signup-form'
import { composePageTitle } from '@/lib/seo/compose-title'

const TITLE = composePageTitle('회원가입 — AI Place 오너 포털')
const DESC = '내 업체를 AI Place 에 직접 등록하고 AI 검색 노출을 시작하세요. 파일럿 30일 무료.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: '/signup' },
  robots: { index: false, follow: false },     // 회원가입 페이지는 검색 노출 X
}

export default function SignupPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-[#f7f7f7]">
        <section className="mx-auto max-w-md px-6 py-16">
          <h1 className="text-2xl font-bold text-[#222222]">회원가입</h1>
          <p className="mt-2 text-sm text-[#6a6a6a]">
            내 업체를 직접 등록하고 AI 검색 최적화를 시작하세요.
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            파일럿 30일 무료 · 이후 월 9,900원
          </p>

          <div className="mt-8 rounded-2xl border border-[#e7e7e7] bg-white p-6">
            <SignupForm />
          </div>

          <p className="mt-4 text-center text-xs text-[#6a6a6a]">
            이미 계정이 있으신가요? <Link href="/login" className="text-[#008060] underline">로그인</Link>
          </p>
        </section>
      </main>
      <Footer />
    </>
  )
}
