import { Search, Bell } from 'lucide-react'
import { LogoutButton } from '@/app/admin/logout-button'
import { getPendingReviewCount } from '@/lib/admin/review-counts'
import { getBillingFailureCount } from '@/lib/admin/review-counts'

// T-061 — 어드민 상단 글로벌 바.
// ⌘K 검색 자리(T-083 에서 cmdk 연결), 검수·결제 뱃지, 알림·프로필.

export async function Topbar({ userEmail }: { userEmail: string | null }) {
  const [pending, billingFailed] = await Promise.all([
    getPendingReviewCount(),
    getBillingFailureCount(),
  ])

  return (
    <header className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-[#e5e7eb] bg-white px-4">
      <div className="flex items-center gap-2">
        {/* T-083 에서 cmdk 로 교체될 placeholder */}
        <button
          type="button"
          className="flex h-8 min-w-56 items-center gap-2 rounded-md border border-[#e5e7eb] bg-[#f7f7f7] px-2 text-xs text-[#6a6a6a]"
          aria-label="업체 검색 (⌘K 준비 중)"
          disabled
        >
          <Search className="h-3.5 w-3.5" />
          <span>업체 검색 (⌘K 예정)</span>
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Badge count={pending} label="검수 대기" href="/admin/review" tone="purple" />
        <Badge count={billingFailed} label="결제 실패" href="/admin/billing/failures" tone="red" />
        <button type="button" className="rounded p-1 text-[#6a6a6a] hover:bg-[#f3f4f6]" aria-label="알림">
          <Bell className="h-4 w-4" />
        </button>
        {userEmail && <span className="text-xs text-[#6a6a6a]">{userEmail}</span>}
        <LogoutButton />
      </div>
    </header>
  )
}

function Badge({ count, label, href, tone }: { count: number; label: string; href: string; tone: 'purple' | 'red' }) {
  if (count <= 0) return null
  const cls =
    tone === 'purple'
      ? 'bg-[#ede9fe] text-[#4c1d95]'
      : 'bg-[#fee2e2] text-[#991b1b]'
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${cls}`}
      title={label}
    >
      <span className="font-medium">{label}</span>
      <span className="rounded-full bg-white/70 px-1.5">{count}</span>
    </a>
  )
}
