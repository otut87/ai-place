'use client'

// 홈 전용 네비. Supabase 세션 상태에 따라 로그인/업체등록 ↔ 내 업체/로그아웃 토글 (AUDIT I-1).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const LINKS = [
  { href: '/directory', label: '디렉토리' },
  { href: '/blog', label: '가이드' },
  { href: '/pricing', label: '가격' },
  { href: '/about/methodology', label: '소개' },
]

export function HomeNav() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState<string | null | undefined>(undefined)

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
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  const isLoading = email === undefined
  const isLoggedIn = !!email

  return (
    <>
      <nav className="top">
        <div className="wrap inner">
          <Link className="logo" href="/">
            <span className="mark" /> AI Place
          </Link>
          <div className="links">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="right">
            {isLoading ? (
              // 세션 조회 중 깜빡임 방지용 플레이스홀더
              <div style={{ width: 180, height: 36 }} aria-hidden="true" />
            ) : isLoggedIn ? (
              <>
                <Link className="btn ghost sm btn-ghost-desktop" href="/owner">
                  내 업체
                </Link>
                <button type="button" className="btn primary sm" onClick={handleLogout}>
                  로그아웃
                </button>
              </>
            ) : (
              <>
                <Link className="btn ghost sm btn-ghost-desktop" href="/login">
                  로그인
                </Link>
                <Link className="btn primary sm" href="/owner/places/new">
                  업체 등록 →
                </Link>
              </>
            )}
            <button
              type="button"
              className="nav-toggle"
              aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${open ? ' open' : ''}`} role="dialog" aria-hidden={!open}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        {isLoggedIn ? (
          <>
            <Link href="/owner" onClick={() => setOpen(false)}>
              내 업체
            </Link>
            <button type="button" className="btn primary" onClick={handleLogout}>
              로그아웃
            </button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={() => setOpen(false)}>
              로그인
            </Link>
            <Link className="btn primary" href="/owner/places/new" onClick={() => setOpen(false)}>
              업체 등록 →
            </Link>
          </>
        )}
      </div>
    </>
  )
}
