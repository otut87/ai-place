import Link from "next/link"
import { HeaderAuthButtons } from "./header-auth-buttons"

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#c1c1c1]/50">
      <div className="mx-auto max-w-[1200px] px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-[#222222] tracking-tight">
          AI Place
        </Link>

        {/* CTA */}
        <div className="hidden sm:flex items-center gap-2">
          <Link
            href="/check"
            className="h-10 px-4 inline-flex items-center rounded-lg border border-[#008060] text-[#008060] text-sm font-medium hover:bg-emerald-50 transition-colors"
          >
            AI 진단
          </Link>
          <HeaderAuthButtons />
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden p-2 rounded-lg hover:bg-[#f2f2f2] transition-colors"
          aria-label="메뉴 열기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222222" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>
    </header>
  )
}
