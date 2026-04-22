'use client'

// T-201 — /owner 좌측 사이드바 (docs/AIPLACE/dashboard.html 의 side-nav 구현).
// 섹션: 둘러보기 (개요/AI 인용/업체 관리/추천 키워드/콘텐츠 관리) · 설정 (결제 플랜).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  userEmail: string | null
}

interface NavItem {
  href: string
  label: string
  icon: 'overview' | 'citation' | 'places' | 'keywords' | 'content' | 'billing'
  match: (p: string) => boolean
  comingSoon?: boolean
  badge?: string
}

const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '둘러보기',
    items: [
      { href: '/owner',           label: '개요',        icon: 'overview',  match: (p) => p === '/owner' },
      { href: '/owner#citation',  label: 'AI 인용',     icon: 'citation',  match: () => false, comingSoon: true },
      { href: '/owner/places/new',label: '업체 추가',   icon: 'places',    match: (p) => p.startsWith('/owner/places') },
      { href: '/owner#keywords',  label: '추천 키워드', icon: 'keywords',  match: () => false, comingSoon: true },
      { href: '/owner#content',   label: '콘텐츠 관리', icon: 'content',   match: () => false, comingSoon: true },
    ],
  },
  {
    title: '설정',
    items: [
      { href: '/owner/billing',   label: '결제·플랜',   icon: 'billing',   match: (p) => p.startsWith('/owner/billing') },
    ],
  },
]

const ICONS: Record<NavItem['icon'], React.ReactElement> = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3" y="3" width="7" height="9" />
      <rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" />
      <rect x="3" y="16" width="7" height="5" />
    </svg>
  ),
  citation: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  places: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  keywords: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  content: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="1" y="4" width="22" height="16" rx="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  ),
}

export function OwnerSidebar({ userEmail }: Props) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [open, setOpen] = useState(false)

  // 페이지 이동 시 drawer 닫기 (모바일).
  useEffect(() => { setOpen(false) }, [pathname])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    setOpen(false)
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <header className="owner-topbar">
        <button
          type="button"
          className="toggle"
          aria-label="사이드바 열기"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="title">오너 포털</div>
        <div style={{ width: 40 }} />
      </header>

      <div
        className={`owner-sidebar-backdrop${open ? ' open' : ''}`}
        aria-hidden="true"
        onClick={() => setOpen(false)}
      />

      <aside className={`side-nav${open ? ' open' : ''}`} aria-label="오너 메뉴">
        {SECTIONS.map((section, sIdx) => (
          <div key={section.title}>
            {sIdx > 0 && <div className="divider" />}
            <h5>{section.title}</h5>
            {section.items.map((item) => {
              const active = item.match(pathname)
              const cls = active ? 'active' : undefined
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cls}
                  aria-disabled={item.comingSoon}
                  title={item.comingSoon ? '곧 지원 예정' : undefined}
                >
                  {ICONS[item.icon]}
                  <span>{item.label}</span>
                  {item.comingSoon && <span className="badge">soon</span>}
                  {item.badge && <span className="badge">{item.badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}

        <div className="user-foot">
          <span className="email">{userEmail ?? '로그인 정보 없음'}</span>
          <button type="button" onClick={handleLogout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>로그아웃</span>
          </button>
        </div>
      </aside>
    </>
  )
}
