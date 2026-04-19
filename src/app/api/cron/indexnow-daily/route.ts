// T-134 — IndexNow 일일 제출 크론.
// 전날 업데이트된 places/blog_posts URL 을 IndexNow 엔드포인트에 배치 제출.
// 매일 1회 실행 (vercel.json: "15 2 * * *" — 02:15).

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BASE_URL = 'https://aiplace.kr'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const key = process.env.INDEXNOW_KEY
  if (!key) {
    return NextResponse.json({ ok: false, error: 'INDEXNOW_KEY not configured' }, { status: 200 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const since = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString() // 26시간 (안전 마진)

  const [placesResult, postsResult] = await Promise.all([
    admin.from('places').select('slug, city, category, updated_at').eq('status', 'active').gte('updated_at', since),
    admin.from('blog_posts').select('slug, city, sector, updated_at').eq('status', 'active').gte('updated_at', since),
  ])

  const urls: string[] = [BASE_URL]
  for (const p of (placesResult.data ?? []) as Array<{ slug: string; city: string; category: string }>) {
    urls.push(`${BASE_URL}/${p.city}/${p.category}/${p.slug}`)
  }
  for (const b of (postsResult.data ?? []) as Array<{ slug: string; city: string; sector: string }>) {
    urls.push(`${BASE_URL}/blog/${b.city}/${b.sector}/${b.slug}`)
  }

  if (urls.length === 1) {
    return NextResponse.json({ ok: true, submitted: 0, message: 'no changes in last 26h' })
  }

  const payload = {
    host: 'aiplace.kr',
    key,
    keyLocation: `${BASE_URL}/${key}.txt`,
    urlList: urls.slice(0, 10000), // IndexNow 배치 한계
  }

  try {
    const res = await fetch(INDEXNOW_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return NextResponse.json({
      ok: res.ok,
      submitted: urls.length,
      status: res.status,
      statusText: res.statusText,
    })
  } catch (err) {
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : 'fetch_failed',
      submitted: urls.length,
    }, { status: 500 })
  }
}
