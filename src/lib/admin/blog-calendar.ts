// T-078 — 블로그 캘린더 데이터 모델 + 월간 그리드 헬퍼.

import { getAdminClient } from '@/lib/supabase/admin-client'

export type BlogStatus = 'draft' | 'scheduled' | 'active' | 'archived'

export interface BlogCalendarPost {
  id: string
  slug: string
  title: string
  status: BlogStatus | string
  published_at: string | null
  created_at: string
  category: string | null
  post_type: string
}

/**
 * 해당 월(YYYY-MM) 의 게시물 목록 로드.
 * 기준: published_at 이 있으면 그 날짜, 없으면 created_at.
 */
export async function listBlogPostsForMonth(year: number, month1to12: number): Promise<BlogCalendarPost[]> {
  const admin = getAdminClient()
  if (!admin) return []

  const start = new Date(Date.UTC(year, month1to12 - 1, 1)).toISOString()
  const end = new Date(Date.UTC(year, month1to12, 1)).toISOString()

  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, title, status, published_at, created_at, category, post_type')
    .or(`and(published_at.gte.${start},published_at.lt.${end}),and(published_at.is.null,created_at.gte.${start},created_at.lt.${end})`)
    .order('published_at', { ascending: true, nullsFirst: false })
    .limit(200)

  if (error || !data) return []
  return data as BlogCalendarPost[]
}

export interface CalendarDay {
  date: string          // 'YYYY-MM-DD'
  dayOfMonth: number
  inCurrentMonth: boolean
  posts: BlogCalendarPost[]
}

/**
 * 월별 달력 그리드 — 월요일 시작, 6주(42일) 고정 반환.
 */
export function buildCalendarGrid(
  year: number,
  month1to12: number,
  posts: BlogCalendarPost[],
): CalendarDay[] {
  const firstOfMonth = new Date(Date.UTC(year, month1to12 - 1, 1))
  const firstDayOfWeek = firstOfMonth.getUTCDay()       // 0=Sun
  const mondayOffset = (firstDayOfWeek + 6) % 7         // 월요일 기준 오프셋
  const gridStart = new Date(firstOfMonth)
  gridStart.setUTCDate(gridStart.getUTCDate() - mondayOffset)

  // 날짜 → 포스트 맵 (published_at 기준, 없으면 created_at)
  const byDate = new Map<string, BlogCalendarPost[]>()
  for (const p of posts) {
    const iso = (p.published_at ?? p.created_at).slice(0, 10)
    const list = byDate.get(iso) ?? []
    list.push(p)
    byDate.set(iso, list)
  }

  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart)
    d.setUTCDate(d.getUTCDate() + i)
    const iso = d.toISOString().slice(0, 10)
    days.push({
      date: iso,
      dayOfMonth: d.getUTCDate(),
      inCurrentMonth: d.getUTCFullYear() === year && d.getUTCMonth() === month1to12 - 1,
      posts: byDate.get(iso) ?? [],
    })
  }
  return days
}

export function parseMonthParam(raw: string | undefined, now: Date = new Date()): { year: number; month: number } {
  if (raw) {
    const m = /^(\d{4})-(\d{1,2})$/.exec(raw)
    if (m) {
      const y = Number.parseInt(m[1], 10)
      const mm = Number.parseInt(m[2], 10)
      if (Number.isFinite(y) && mm >= 1 && mm <= 12) return { year: y, month: mm }
    }
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 }
}
