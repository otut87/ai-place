'use client'

import { useState } from 'react'
import Link from 'next/link'

const LINKS = [
  { href: '/directory', label: '디렉토리' },
  { href: '/blog', label: '가이드' },
  { href: '/pricing', label: '가격' },
  { href: '/about/methodology', label: '소개' },
]

export function PreviewNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav className="top">
        <div className="wrap inner">
          <Link className="logo" href="/home-v2">
            <span className="mark" /> AI Place
          </Link>
          <div className="links">
            {LINKS.map(l => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
          <div className="right">
            <Link className="btn ghost sm btn-ghost-desktop" href="/admin/login">
              로그인
            </Link>
            <Link className="btn primary sm" href="/owner/places/new">
              업체 등록 →
            </Link>
            <button
              type="button"
              className="nav-toggle"
              aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
              aria-expanded={open}
              onClick={() => setOpen(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </nav>

      <div className={`mobile-menu${open ? ' open' : ''}`} role="dialog" aria-hidden={!open}>
        {LINKS.map(l => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}>
            {l.label}
          </Link>
        ))}
        <Link href="/admin/login" onClick={() => setOpen(false)}>로그인</Link>
        <Link className="btn primary" href="/owner/places/new" onClick={() => setOpen(false)}>
          업체 등록 →
        </Link>
      </div>
    </>
  )
}
