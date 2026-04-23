'use client'

// /owner 좌측 사이드바. 모바일 drawer 는 헤더 햄버거가 제어 (OwnerSidebarContext).
// 데스크톱에서는 항상 열린 grid item, 모바일에서는 고정 포지션 drawer.

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useOwnerSidebar } from './owner-sidebar-context'

interface Props {
  userEmail: string | null
}

interface NavItem {
  href: string
  label: string
  icon: 'overview' | 'citation' | 'places' | 'content' | 'billing'
  match: (p: string) => boolean
}

// T-209: 월간 리포트 메뉴 제거 — AI 인용 페이지가 월 프리셋/사용자 지정 기간으로 흡수함.
const SECTIONS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: '둘러보기',
    items: [
      { href: '/owner',            label: '개요',        icon: 'overview',  match: (p) => p === '/owner' },
      { href: '/owner/citations',  label: 'AI 인용',     icon: 'citation',  match: (p) => p.startsWith('/owner/citations') },
      { href: '/owner/content',    label: '콘텐츠',      icon: 'content',   match: (p) => p.startsWith('/owner/content') },
      { href: '/owner/places/new', label: '업체 추가',   icon: 'places',    match: (p) => p.startsWith('/owner/places') },
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
  const { isOpen, close } = useOwnerSidebar()

  // 경로 변경 시 drawer 자동 닫기 (모바일 UX).
  useEffect(() => { close() }, [pathname, close])

  return (
    <>
      <div
        className={`owner-sidebar-backdrop${isOpen ? ' open' : ''}`}
        aria-hidden="true"
        onClick={close}
      />

      <aside className={`side-nav${isOpen ? ' open' : ''}`} aria-label="오너 메뉴">
        {SECTIONS.map((section, sIdx) => (
          <div key={section.title}>
            {sIdx > 0 && <div className="divider" />}
            <h5>{section.title}</h5>
            {section.items.map((item) => {
              const active = item.match(pathname)
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={active ? 'active' : undefined}
                >
                  {ICONS[item.icon]}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}

        {userEmail && <AvatarFoot email={userEmail} />}
      </aside>
    </>
  )
}

function AvatarFoot({ email }: { email: string }) {
  const [name, domain] = email.split('@')
  const initial = (name?.[0] ?? '?').toUpperCase()
  return (
    <div className="who">
      <div className="av">{initial}</div>
      <div className="meta">
        <b>{name}</b>
        <span>@{domain}</span>
      </div>
    </div>
  )
}
