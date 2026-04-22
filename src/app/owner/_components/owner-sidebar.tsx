'use client'

// Sprint D-1 / T-200 — /owner 전용 사이드바 (Client).
// 모바일 drawer 토글 + 현재 경로 active 표시 + 로그아웃.

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userEmail: string | null
}

const LINKS: Array<{ href: string; icon: string; label: string; match: (p: string) => boolean }> = [
  { href: '/owner',          icon: '📊', label: '홈',         match: (p) => p === '/owner' },
  { href: '/owner/places/new', icon: '🏪', label: '업체 추가',  match: (p) => p.startsWith('/owner/places') },
  { href: '/owner/billing',  icon: '💳', label: '결제',       match: (p) => p.startsWith('/owner/billing') },
]

export function OwnerSidebar({ userEmail }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const title = LINKS.find((l) => l.match(pathname ?? ''))?.label ?? '오너 포털'

  return (
    <>
      <header className="owner-topbar">
        <button
          type="button"
          className="toggle"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="title">{title}</div>
        <div style={{ width: 40 }} />
      </header>

      <div
        className={`owner-sidebar-backdrop${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside className={`owner-sidebar${open ? ' open' : ''}`} aria-label="오너 메뉴">
        <Link href="/owner" className="brand" onClick={() => setOpen(false)}>
          <span className="mark" />
          <span>
            <span className="name">AI Place</span>
            <span className="role">오너 포털</span>
          </span>
        </Link>

        <nav>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={l.match(pathname ?? '') ? 'active' : undefined}
            >
              <span className="ic" aria-hidden>{l.icon}</span>
              <span>{l.label}</span>
            </Link>
          ))}
        </nav>

        <div className="footer">
          <span className="email">{userEmail ?? '로그인 정보 없음'}</span>
          <button type="button" onClick={handleLogout}>
            <span className="ic" aria-hidden>🚪</span>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  )
}
