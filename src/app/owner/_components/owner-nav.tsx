'use client'

// /owner 상단 공통 nav — 로고 + 이메일 + 로그아웃 + (모바일 전용) 사이드바 햄버거.
// 탐색은 사이드바 전담 (중복 링크 제거 — 2026-04-22 UX 개선).

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useOwnerSidebar } from './owner-sidebar-context'

interface Props {
  userEmail: string | null
}

export function OwnerNav({ userEmail }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const { open } = useOwnerSidebar()

  async function handleLogout() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setBusy(false)
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="top">
      <div className="wrap inner">
        <button
          type="button"
          className="nav-toggle"
          aria-label="사이드바 열기"
          onClick={open}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <Link className="logo" href="/owner">
          <span className="mark" /> AI Place
        </Link>

        <div className="right">
          {userEmail && (
            <span className="hidden-mobile" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
              {userEmail}
            </span>
          )}
          <button
            type="button"
            className="btn ghost sm"
            onClick={handleLogout}
            disabled={busy}
          >
            {busy ? '로그아웃 중…' : '로그아웃'}
          </button>
        </div>
      </div>
    </nav>
  )
}
