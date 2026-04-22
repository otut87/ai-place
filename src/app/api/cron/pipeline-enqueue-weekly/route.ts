// T-187 — 주 1회 전체 업체 refresh enqueue 크론.
// Vercel Cron 매주 일요일 KST 03:00 (UTC 토요일 18:00) 호출.
//
// 설계:
// - 등록된 모든 place 순회 → `place.enrich_google` + `place.summarize_google_reviews` enqueue
// - enqueuePlaceRefresh 가 dedup 해주므로 이미 pending/running 잡은 skip
// - 실제 실행은 5분 consumer(/api/cron/pipeline-consume)가 FIFO 로 소화
//
// 방문 기반 lazy enqueue(src/app/[city]/[category]/[slug]/page.tsx)를 대체하는 목적.
// SaaS 월 9,900원 상품에서 "AI 추천 결과 리포트 월간 제공" 약속 충족.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { enqueuePlaceRefresh } from '@/lib/admin/pipeline-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  // Google Place ID 있는 업체만 대상 (enrich/summarize 둘 다 google_place_id 필수)
  const { data, error } = await admin
    .from('places')
    .select('id, slug, google_place_id')
    .not('google_place_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: `fetch_failed: ${error.message}` }, { status: 500 })
  }

  const rows = (data ?? []) as Array<{ id: string; slug: string; google_place_id: string | null }>
  const total = rows.length

  let enqueuedTotal = 0
  let skippedTotal = 0
  const failures: Array<{ placeId: string; error: string }> = []

  for (const row of rows) {
    try {
      const r = await enqueuePlaceRefresh(row.id, [
        'place.enrich_google',
        'place.summarize_google_reviews',
      ])
      enqueuedTotal += r.enqueued.length
      skippedTotal += r.skipped.length
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      failures.push({ placeId: row.id, error: msg })
    }
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    totalPlaces: total,
    enqueued: enqueuedTotal,
    skipped: skippedTotal,
    failed: failures.length,
    failures: failures.slice(0, 5),
  })
}
