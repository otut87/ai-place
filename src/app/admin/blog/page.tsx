// T-078 — /admin/blog — 월간 블로그 캘린더.

import { requireAuth } from '@/lib/auth'
import { listBlogPostsForMonth, buildCalendarGrid, parseMonthParam } from '@/lib/admin/blog-calendar'
import { listDraftTopics } from '@/lib/admin/blog-editor'
import { AdminLink } from '@/components/admin/admin-link'
import { cachedCities, cachedCategories, cachedSectors } from '@/lib/admin/cached-data'
import { CreateTopicButton } from './create-topic-button'

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

  const [posts, drafts, cities, sectors, categories] = await Promise.all([
    listBlogPostsForMonth(year, month),
    listDraftTopics(20),
    cachedCities(),
    cachedSectors(),
    cachedCategories(),
  ])
  const grid = buildCalendarGrid(year, month, posts)
  const cityOpts = cities.map(c => ({ value: c.slug, label: c.name }))
  const sectorOpts = sectors.map(s => ({ value: s.slug, label: s.name }))
  const categoryOpts = categories.map(c => ({ value: c.slug, label: c.name, sector: c.sector }))

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
          <CreateTopicButton cities={cityOpts} sectors={sectorOpts} categories={categoryOpts} />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
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
                className={`group min-h-24 border-b border-r border-[#f0f0f0] p-2 text-xs ${
                  day.inCurrentMonth ? 'bg-white' : 'bg-[#fafafa] text-[#bdbdbd]'
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">{day.dayOfMonth}</span>
                  {day.inCurrentMonth && (
                    <span className="opacity-0 group-hover:opacity-100">
                      <CreateTopicButton
                        cities={cityOpts}
                        sectors={sectorOpts}
                        categories={categoryOpts}
                        initialDate={day.date}
                        compact
                      />
                    </span>
                  )}
                </div>
                <ul className="space-y-0.5">
                  {day.posts.map((p) => (
                    <li key={p.id}>
                      <AdminLink
                        href={`/admin/blog/${p.slug}/edit`}
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

        {/* 토픽 큐 (초안) */}
        <aside className="rounded-xl border border-[#e7e7e7] bg-white">
          <div className="border-b border-[#f0f0f0] px-4 py-2 text-xs font-semibold text-[#191919]">
            토픽 큐 ({drafts.length})
          </div>
          {drafts.length === 0 ? (
            <p className="p-4 text-xs text-[#9a9a9a]">초안이 없습니다.</p>
          ) : (
            <ul className="max-h-[500px] overflow-y-auto p-2">
              {drafts.map(d => (
                <li key={d.id}>
                  <AdminLink
                    href={`/admin/blog/${d.slug}/edit`}
                    className="block rounded-md px-2 py-1.5 text-xs hover:bg-[#fafafa]"
                  >
                    <div className="font-medium text-[#191919]">{d.title}</div>
                    <div className="mt-0.5 text-[10px] text-[#6b6b6b]">{d.category ?? '—'} · {d.post_type}</div>
                  </AdminLink>
                </li>
              ))}
            </ul>
          )}
        </aside>
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
