// T-197 — GSC 성과 피드백 크론 (Phase 5).
// Vercel Cron: 매주 월요일 KST 04:00 (UTC 일요일 19:00).
// GSC 환경변수 없으면 no-op — 설정 선택.

import { NextResponse } from 'next/server'
import { syncGSCMetrics } from '@/lib/blog/performance-feedback'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const daysParam = url.searchParams.get('days')
  const days = daysParam ? Math.max(1, Math.min(90, Number(daysParam))) : 30

  const result = await syncGSCMetrics({ days })

  return NextResponse.json({
    ok: true,
    ...result,
  })
}
