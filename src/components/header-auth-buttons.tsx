'use client'

// 우상단 인증 버튼 — 브라우저 세션에 따라 로그인/업체등록 vs 내 업체/로그아웃 전환.
// Header 전체를 async server 로 만들면 정적 페이지가 dynamic 으로 전환되므로
// 이 부분만 클라이언트 아일랜드로 분리.

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function HeaderAuthButtons() {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setEmail(null)
    router.push('/')
    router.refresh()
  }

  // 세션 조회 중: 깜빡임 방지용 플레이스홀더
  if (email === undefined) {
    return <div className="h-10 w-40" aria-hidden="true" />
  }

  if (email) {
    return (
      <>
        <Link
          href="/owner"
          className="h-10 px-4 inline-flex items-center rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors"
        >
          내 업체
        </Link>
        <button
          onClick={handleLogout}
          className="h-10 px-3 inline-flex items-center text-sm font-medium text-[#222222] hover:text-[#008060] transition-colors"
        >
          로그아웃
        </button>
      </>
    )
  }

  return (
    <>
      <Link
        href="/login"
        className="h-10 px-3 inline-flex items-center text-sm font-medium text-[#222222] hover:text-[#008060] transition-colors"
      >
        로그인
      </Link>
      <Link
        href="/signup"
        className="h-10 px-5 inline-flex items-center rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors"
      >
        업체 등록
      </Link>
    </>
  )
}
