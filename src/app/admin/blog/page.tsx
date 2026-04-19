// T-078 — /admin/blog — 월간 블로그 캘린더.

import { requireAuth } from '@/lib/auth'
import { listBlogPostsForMonth, buildCalendarGrid, parseMonthParam } from '@/lib/admin/blog-calendar'
import { AdminLink } from '@/components/admin/admin-link'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const

export default async function AdminBlogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireAuth()
  const raw = await searchParams
  const monthRaw = Array.isArray(raw.m) ? raw.m[0] : raw.m
  const { year, month } = parseMonthParam(monthRaw)

  const posts = await listBlogPostsForMonth(year, month)
  const grid = buildCalendarGrid(year, month, posts)

  const prev = month === 1 ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const next = month === 12 ? { y: year + 1, m: 1 } : { y: year, m: month + 1 }

  return (
    <div className="px-6 py-5">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">블로그 캘린더</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">월별 발행 일정. 빈 날짜에 토픽을 추가해 발행을 예약할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <AdminLink href={`/admin/blog?m=${prev.y}-${String(prev.m).padStart(2, '0')}`} className="rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5">이전</AdminLink>
          <span className="min-w-24 text-center font-medium">{year}년 {month}월</span>
          <AdminLink href={`/admin/blog?m=${next.y}-${String(next.m).padStart(2, '0')}`} className="rounded-md border border-[#e7e7e7] bg-white px-3 py-1.5">다음</AdminLink>
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-[#e7e7e7] bg-white">
        <div className="grid grid-cols-7 border-b border-[#f0f0f0] bg-[#fafafa] text-xs font-medium text-[#6b6b6b]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-3 py-2 text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {grid.map((day) => (
            <div
              key={day.date}
              className={`min-h-24 border-b border-r border-[#f0f0f0] p-2 text-xs ${
                day.inCurrentMonth ? 'bg-white' : 'bg-[#fafafa] text-[#bdbdbd]'
              }`}
            >
              <div className="mb-1 font-medium">{day.dayOfMonth}</div>
              <ul className="space-y-0.5">
                {day.posts.map((p) => (
                  <li key={p.id}>
                    <AdminLink
                      href={`/blog/${p.slug}`}
                      className="block truncate rounded-sm px-1 text-[11px] hover:bg-[#f3f4f6]"
                      title={p.title}
                    >
                      <StatusDot status={p.status} />
                      {p.title}
                    </AdminLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-[#6b6b6b]">
        상태: <StatusDot status="draft" /> 초안 · <StatusDot status="scheduled" /> 예약 · <StatusDot status="active" /> 발행 · <StatusDot status="archived" /> 보관
      </p>
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const color =
    status === 'active' ? 'bg-emerald-500'
    : status === 'scheduled' ? 'bg-sky-500'
    : status === 'archived' ? 'bg-[#bdbdbd]'
    : 'bg-amber-500'
  return <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle ${color}`} />
}
