// T-196 — 일일 블로그 토픽 플래너 크론 (Phase 4).
//
// 실행: 매일 KST 00:05 (UTC 15:05 전날).
// 동작: planDailyTopics 로 10편 결정 → blog_topic_queue INSERT.
// 그 후 pipeline-consume 크론이 15분마다 scheduled_for <= now() 인 토픽을 pop.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { planDailyTopics } from '@/lib/blog/topic-planner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function kstDateToday(): string {
  // 서버 UTC 에서 KST 오늘 날짜 계산.
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

  // ?date=YYYY-MM-DD override 지원 (관리자 수동 재계획용)
  const url = new URL(req.url)
  const plannedDate = url.searchParams.get('date') || kstDateToday()

  // 중복 방지 — 같은 날짜 이미 계획됐으면 건너뜀 (관리자 수동 재계획 시 ?force=1).
  const force = url.searchParams.get('force') === '1'
  if (!force) {
    const { data: existing } = await admin
      .from('blog_topic_queue')
      .select('id', { count: 'exact', head: true })
      .eq('planned_date', plannedDate)
    // head:true + count 는 data 없음, 대신 위 쿼리는 배열 — 방어적 처리.
    const { count: existingCount } = await admin
      .from('blog_topic_queue')
      .select('id', { count: 'exact', head: true })
      .eq('planned_date', plannedDate)
    void existing
    if ((existingCount ?? 0) > 0) {
      return NextResponse.json({
        ok: true, skipped: true, plannedDate,
        message: `${plannedDate} 이미 ${existingCount}개 큐 존재 — force=1 로 재계획 가능`,
      })
    }
  }

  const plan = await planDailyTopics({ plannedDate })

  if (plan.rows.length === 0) {
    return NextResponse.json({
      ok: false, plannedDate, inserted: 0,
      skipped: plan.skipped,
      message: '계획 가능한 토픽 0개 — 업체/키워드 풀 확인 필요',
    }, { status: 500 })
  }

  // bulk INSERT
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
    cityCategoryUsage: plan.cityCategoryUsage,
    skipped: plan.skipped,
  })
}
