import Link from "next/link"
import { InquiryButton } from "./inquiry-modal"

export function Header() {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#c1c1c1]/50">
      <div className="mx-auto max-w-[1200px] px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-[#222222] tracking-tight">
          AI Place
        </Link>

        {/* CTA */}
        <InquiryButton className="hidden sm:inline-flex h-10 px-5 items-center rounded-lg bg-[#008060] text-white text-sm font-medium hover:bg-[#006b4f] transition-colors">
          업체 등록
        </InquiryButton>

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
