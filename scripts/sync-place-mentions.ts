#!/usr/bin/env tsx
/**
 * scripts/sync-place-mentions.ts — Sprint D-1 / T-200.
 *
 * places / blog_posts → place_mentions 동기화.
 * CI · Vercel postdeploy · 수동 실행 어느 쪽이든 멱등하게 돌아간다.
 *
 * 단계:
 *   1) places WHERE status='active'           → page_type='detail'  fan-out
 *   2) blog_posts WHERE status='active'       → page_type='blog'    fan-out
 *        - places_mentioned UUID[] 가 채워져 있으면 그대로 사용
 *        - 비어 있으면 related_place_slugs → place_id 조회로 백필 후 fan-out
 *   3) (옵션 --content-scan) 본문 content 에서 업체명 substring 스캔으로 추가 매핑
 *
 * Usage:
 *   npx tsx scripts/sync-place-mentions.ts [--dry-run] [--verbose] [--content-scan]
 */

import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config({ path: path.resolve('.env') })

import { getAdminClient } from '@/lib/supabase/admin-client'
import {
  upsertPlaceMentions,
  buildDetailPath,
  buildBlogPath,
  type MentionRow,
} from '@/lib/owner/place-mentions'

interface Args {
  dryRun: boolean
  verbose: boolean
  contentScan: boolean
}

function parseArgs(): Args {
  const a = process.argv.slice(2)
  return {
    dryRun: a.includes('--dry-run'),
    verbose: a.includes('--verbose'),
    contentScan: a.includes('--content-scan'),
  }
}

interface PlaceRow {
  id: string
  slug: string
  city: string
  category: string
  name: string
  status: string
}

interface BlogRow {
  id: string
  slug: string
  city: string
  sector: string
  status: string
  places_mentioned: string[] | null
  related_place_slugs: string[] | null
  content: string
}

async function fetchActivePlaces(): Promise<PlaceRow[]> {
  const admin = getAdminClient()
  if (!admin) throw new Error('admin client 초기화 실패')
  const { data, error } = await admin
    .from('places')
    .select('id, slug, city, category, name, status')
    .eq('status', 'active')
  if (error) throw new Error(`places 조회 실패: ${error.message}`)
  return (data ?? []) as PlaceRow[]
}

async function fetchActiveBlogPosts(): Promise<BlogRow[]> {
  const admin = getAdminClient()
  if (!admin) throw new Error('admin client 초기화 실패')
  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, city, sector, status, places_mentioned, related_place_slugs, content')
    .eq('status', 'active')
  if (error) throw new Error(`blog_posts 조회 실패: ${error.message}`)
  return (data ?? []) as BlogRow[]
}

async function backfillBlogPlacesMentioned(
  blog: BlogRow,
  slugToId: Map<string, string>,
  args: Args,
): Promise<string[]> {
  const existing = blog.places_mentioned ?? []
  if (existing.length > 0) return existing

  const slugs = blog.related_place_slugs ?? []
  const ids: string[] = []
  for (const s of slugs) {
    const pid = slugToId.get(s)
    if (pid) ids.push(pid)
  }

  if (args.contentScan) {
    for (const [slug, id] of slugToId.entries()) {
      if (ids.includes(id)) continue
      if (blog.content.includes(slug)) ids.push(id)
    }
  }

  if (ids.length === 0) return []

  if (!args.dryRun) {
    const admin = getAdminClient()!
    const { error } = await admin
      .from('blog_posts')
      .update({ places_mentioned: ids })
      .eq('id', blog.id)
    if (error) {
      console.error(`[sync] blog ${blog.slug} places_mentioned 백필 실패: ${error.message}`)
    } else if (args.verbose) {
      console.log(`[sync] blog ${blog.slug} places_mentioned 백필: ${ids.length}건`)
    }
  }

  return ids
}

async function main() {
  const args = parseArgs()
  console.log(`[sync-place-mentions] start — dryRun=${args.dryRun} verbose=${args.verbose} contentScan=${args.contentScan}`)

  const places = await fetchActivePlaces()
  console.log(`  places active: ${places.length}`)

  // ── 1) places → detail ──────────────────────────────────────────
  const detailRows: MentionRow[] = places.map((p) => ({
    placeId: p.id,
    pagePath: buildDetailPath(p.city, p.category, p.slug),
    pageType: 'detail',
  }))

  if (args.verbose) {
    for (const r of detailRows) console.log(`    + detail ${r.pagePath}`)
  }

  if (args.dryRun) {
    console.log(`  [dry-run] detail fan-out: ${detailRows.length}건 예정`)
  } else {
    const result = await upsertPlaceMentions(detailRows)
    console.log(`  detail fan-out upsert: ${result.inserted}/${result.total}`)
  }

  // ── 2) blog_posts → blog ───────────────────────────────────────
  const blogs = await fetchActiveBlogPosts()
  console.log(`  blog_posts active: ${blogs.length}`)

  const slugToId = new Map<string, string>()
  for (const p of places) slugToId.set(p.slug, p.id)

  const blogRows: MentionRow[] = []
  let backfilled = 0
  for (const b of blogs) {
    const ids = await backfillBlogPlacesMentioned(b, slugToId, args)
    if ((b.places_mentioned ?? []).length === 0 && ids.length > 0) backfilled += 1
    const path = buildBlogPath(b.city, b.sector, b.slug)
    for (const pid of ids) {
      blogRows.push({ placeId: pid, pagePath: path, pageType: 'blog' })
    }
    if (args.verbose && ids.length > 0) {
      console.log(`    + blog ${path} ← ${ids.length} place(s)`)
    }
  }

  console.log(`  blog_posts backfilled: ${backfilled}`)

  if (args.dryRun) {
    console.log(`  [dry-run] blog fan-out: ${blogRows.length}건 예정`)
  } else {
    const result = await upsertPlaceMentions(blogRows)
    console.log(`  blog fan-out upsert: ${result.inserted}/${result.total}`)
  }

  console.log('[sync-place-mentions] done')
}

main().catch((err) => {
  console.error('[sync-place-mentions] FAIL:', err instanceof Error ? err.message : err)
  process.exitCode = 1
})
