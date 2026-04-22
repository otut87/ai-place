// T-205 — 일일 블로그 토픽 플래너 (단일 요금제 · 업체별 월 5편 할당).
//
// 실행: 매일 KST 00:05 (UTC 15:05 전날).
// 동작:
//   1) planMonthlyBlogs 가 "오늘 할당된 구독 업체" 만큼 rows 반환
//   2) blog_topic_queue INSERT (이미 같은 날 행 있으면 skip — force=1 재계획)
//   3) pipeline-consume 크론이 15분마다 scheduled_for <= now() 토픽 pop
//
// 이전 T-196 (공용풀 하루 10편 고정) 폐기 — 구독 업체 없으면 0편 발행.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { planMonthlyBlogs } from '@/lib/blog/monthly-blog-planner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstDateToday(): string {
  const now = Date.now()
  const kstMs = now + 9 * 60 * 60 * 1000
  const d = new Date(kstMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const url = new URL(req.url)
  const plannedDate = url.searchParams.get('date') || kstDateToday()
  const force = url.searchParams.get('force') === '1'

  if (!force) {
    const { count: existingCount } = await admin
      .from('blog_topic_queue')
      .select('id', { count: 'exact', head: true })
      .eq('planned_date', plannedDate)
    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({
        ok: true, skipped: true, plannedDate,
        message: `${plannedDate} 이미 ${existingCount}개 큐 존재 — force=1 로 재계획 가능`,
      })
    }
  }

  const plan = await planMonthlyBlogs({ plannedDate })

  if (plan.rows.length === 0) {
    // T-205: 구독 업체가 없거나 오늘 할당일이 아닐 수 있음 — 정상 흐름.
    return NextResponse.json({
      ok: true,
      plannedDate,
      inserted: 0,
      skipped: plan.skipped,
      usageByPlace: plan.usageByPlace,
      message: '오늘 할당된 업체 없음 (구독 없음 혹은 분산일 외).',
    })
  }

  const { error } = await admin.from('blog_topic_queue').insert(plan.rows)
  if (error) {
    return NextResponse.json({
      ok: false, plannedDate, error: error.message,
    }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    plannedDate,
    inserted: plan.rows.length,
    distribution: plan.rows.reduce((acc, r) => {
      acc[r.post_type] = (acc[r.post_type] ?? 0) + 1
      return acc
    }, {} as Record<string, number>),
    usageByPlace: plan.usageByPlace,
    skipped: plan.skipped,
  })
}
