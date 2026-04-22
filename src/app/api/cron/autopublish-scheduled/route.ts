// T-133 — 예약된 블로그 글 자동 발행 크론.
// 매 시간 실행 (vercel.json: "0 * * * *").
// 조건: status='draft' AND published_at IS NOT NULL AND published_at <= now()
// → canAutopublish 정책 통과 시 status='active' 전환 + revalidate.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { canAutopublish, type CategoryPolicy } from '@/lib/admin/autopublish'
import { fanOutBlogPost, buildBlogPath } from '@/lib/owner/place-mentions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ScheduledRow {
  id: string
  slug: string
  city: string
  sector: string
  category: string | null
  created_at: string
  published_at: string
  places_mentioned: string[] | null
}

async function loadPolicies(admin: ReturnType<typeof getAdminClient>): Promise<Map<string, CategoryPolicy>> {
  const map = new Map<string, CategoryPolicy>()
  if (!admin) return map
  const { data } = await admin.from('autopublish_policy').select('category_slug, autopublish_enabled, review_delay_hours')
  for (const row of (data ?? []) as Array<{ category_slug: string; autopublish_enabled: boolean; review_delay_hours: number }>) {
    map.set(row.category_slug, {
      slug: row.category_slug,
      autopublishEnabled: row.autopublish_enabled,
      reviewDelayHours: row.review_delay_hours,
    })
  }
  return map
}

const DEFAULT_POLICY: CategoryPolicy = {
  slug: '*',
  autopublishEnabled: true,
  reviewDelayHours: 0, // 예약 시점이 이미 지났으면 즉시 발행 허용
}

export async function GET(req: Request) {
  const secret = process.env.VERCEL_CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()
  if (!admin) return NextResponse.json({ error: 'admin_unavailable' }, { status: 500 })

  const nowIso = new Date().toISOString()
  const { data: rows, error } = await admin
    .from('blog_posts')
    .select('id, slug, city, sector, category, created_at, published_at, places_mentioned')
    .eq('status', 'draft')
    .not('published_at', 'is', null)
    .lte('published_at', nowIso)
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const scheduled = (rows ?? []) as ScheduledRow[]
  if (scheduled.length === 0) {
    return NextResponse.json({ ok: true, published: 0, message: 'no scheduled posts ready' })
  }

  const policies = await loadPolicies(admin)
  const published: string[] = []
  const skipped: Array<{ slug: string; reason: string }> = []

  for (const row of scheduled) {
    const policy = (row.category ? policies.get(row.category) : undefined) ?? DEFAULT_POLICY
    const createdAt = new Date(row.created_at)
    if (!canAutopublish(policy, createdAt)) {
      skipped.push({ slug: row.slug, reason: `autopublish blocked by policy (delay ${policy.reviewDelayHours}h not met)` })
      continue
    }
    const { error: updErr } = await admin
      .from('blog_posts')
      .update({ status: 'active', updated_at: nowIso })
      .eq('id', row.id)
      .eq('status', 'draft') // 경합 방지
    if (updErr) {
      skipped.push({ slug: row.slug, reason: `update failed: ${updErr.message}` })
      continue
    }
    published.push(row.slug)

    // T-200: active 전환 시 place_mentions fan-out. Best-effort — 실패해도 발행은 유지.
    const placeIds = row.places_mentioned ?? []
    if (placeIds.length > 0) {
      try {
        await fanOutBlogPost({
          placeIds,
          pagePath: buildBlogPath(row.city, row.sector, row.slug),
        })
      } catch (err) {
        console.error(`[autopublish] fanOutBlogPost 실패 slug=${row.slug}:`, err)
      }
    }

    revalidatePath(`/blog/${row.city}/${row.sector}/${row.slug}`)
  }

  if (published.length > 0) {
    revalidatePath('/blog')
    revalidatePath('/admin/blog')
  }

  return NextResponse.json({
    ok: true,
    published: published.length,
    skipped: skipped.length,
    publishedSlugs: published,
    skippedDetails: skipped,
  })
}
