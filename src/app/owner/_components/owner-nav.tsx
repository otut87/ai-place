'use client'

// T-201 — /owner 상단 공통 nav (docs/AIPLACE/dashboard.html 구현).
// aip.css 의 nav.top + .logo + .btn 재사용.

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userEmail: string | null
  /** billing pill 라벨 (ex. "파일럿 D-12" · "Basic 구독중"). null 이면 숨김. */
  statusPill?: {
    label: string
    tone: 'ok' | 'warn' | 'muted'
  } | null
  /** 모바일 사이드바 토글 핸들러 (layout 에서 주입). */
  onToggleSidebar?: () => void
}

export function OwnerNav({ userEmail, statusPill, onToggleSidebar }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleLogout() {
    setBusy(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    setBusy(false)
    router.push('/')
    router.refresh()
  }

  const pillClass = statusPill ? `status-pill${statusPill.tone === 'ok' ? '' : ' ' + statusPill.tone}` : ''

  return (
    <nav className="top">
      <div className="wrap inner">
        <Link className="logo" href="/owner">
          <span className="mark" /> AI Place
        </Link>
        <div className="links">
          <Link href="/owner" aria-current="page">대시보드</Link>
          <Link href="/owner">내 업체</Link>
          <Link href="/pricing">플랜</Link>
        </div>
        <div className="right">
          {userEmail && (
            <span style={{ fontSize: 13, color: 'var(--ink-2)' }} className="hidden-mobile">
              {userEmail}
            </span>
          )}
          {statusPill && <span className={pillClass}>{statusPill.label}</span>}
          <button
            type="button"
            className="btn ghost sm btn-ghost-desktop"
            onClick={handleLogout}
            disabled={busy}
          >
            {busy ? '로그아웃 중…' : '로그아웃'}
          </button>
          {onToggleSidebar && (
            <button
              type="button"
              className="nav-toggle"
              aria-label="사이드바 열기"
              onClick={onToggleSidebar}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}
