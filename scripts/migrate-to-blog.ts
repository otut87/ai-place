#!/usr/bin/env tsx
/**
 * scripts/migrate-to-blog.ts (T-010e)
 *
 * 기존 12개 페이지(8 keyword + 3 compare + 1 guide)를 blog_posts 테이블로 이관.
 *
 * Usage:
 *   npm run migrate:blog:dry       # dry-run
 *   npm run migrate:blog           # 실제 insert (slug 중복은 skip)
 *   npm run migrate:blog:force     # upsert (덮어쓰기)
 *
 * 사전조건: 011_blog_posts_extend.sql 마이그레이션이 Supabase 에 적용되어 있어야 함
 * 환경변수 (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   → @next/env loadEnvConfig 가 자동 로드 (Next 와 동일 우선순위)
 */
// @next/env 를 가장 먼저 로드해야 process.env 가 채워짐 (다른 import 보다 먼저)
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import {
  getAllKeywordPages,
  getAllComparisonTopics,
  getAllGuidePages,
  getKeywordPage,
  getComparisonPage,
  getSectorForCategory,
} from '../src/lib/data'
import {
  keywordPageToInsert,
  comparisonPageToInsert,
  guidePageToInsert,
  type BlogInsertPayload,
} from '../src/lib/blog/migrate'
import { getAdminClient } from '../src/lib/supabase/admin-client'

interface CliArgs {
  dryRun: boolean
  force: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  }
}

async function collectPayloads(): Promise<BlogInsertPayload[]> {
  const payloads: BlogInsertPayload[] = []

  // KeywordPage 8개
  const kwSummaries = await getAllKeywordPages()
  for (const k of kwSummaries) {
    const full = await getKeywordPage(k.city, k.category, k.slug)
    if (!full) continue
    const sector = await getSectorForCategory(full.category)
    payloads.push(keywordPageToInsert(full, sector?.slug ?? 'general'))
  }

  // ComparisonPage 3개
  const compTopics = await getAllComparisonTopics()
  for (const t of compTopics) {
    const full = await getComparisonPage(t.city, t.category, t.slug)
    if (!full) continue
    const sector = await getSectorForCategory(full.topic.category)
    payloads.push(comparisonPageToInsert(full, sector?.slug ?? 'general'))
  }

  // GuidePage 1개
  const guides = await getAllGuidePages()
  for (const g of guides) {
    const sector = await getSectorForCategory(g.category)
    payloads.push(guidePageToInsert(g, sector?.slug ?? 'general'))
  }

  return payloads
}

function printSummary(payloads: BlogInsertPayload[]): void {
  console.log(`\n=== 마이그레이션 대상: ${payloads.length} 개 ===`)
  const byType: Record<string, number> = {}
  for (const p of payloads) {
    byType[p.post_type] = (byType[p.post_type] ?? 0) + 1
  }
  console.log('  타입별:', byType)
  console.log('  슬러그 목록:')
  for (const p of payloads) {
    console.log(`    [${p.post_type}] ${p.slug}  (${p.title})`)
  }
}

async function runInsert(payloads: BlogInsertPayload[], force: boolean): Promise<void> {
  const supabase = getAdminClient()
  if (!supabase) {
    console.error('❌ Admin client 생성 실패. NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 확인.')
    process.exit(1)
  }

  let inserted = 0
  let skipped = 0
  let updated = 0

  for (const payload of payloads) {
    try {
      if (force) {
        // upsert by slug
        const { error } = await supabase
          .from('blog_posts')
          .upsert(payload, { onConflict: 'slug' })
        if (error) {
          console.error(`  ❌ ${payload.slug}: ${error.message}`)
          continue
        }
        updated++
        console.log(`  ↻ upsert: ${payload.slug}`)
      } else {
        // insert only — 동일 slug 있으면 skip
        const { data: existing } = await supabase
          .from('blog_posts')
          .select('slug')
          .eq('slug', payload.slug)
          .maybeSingle()
        if (existing) {
          skipped++
          console.log(`  ⏭ skip (exists): ${payload.slug}`)
          continue
        }
        const { error } = await supabase.from('blog_posts').insert(payload)
        if (error) {
          console.error(`  ❌ ${payload.slug}: ${error.message}`)
          continue
        }
        inserted++
        console.log(`  ✓ insert: ${payload.slug}`)
      }
    } catch (err) {
      console.error(`  ❌ ${payload.slug}:`, err)
    }
  }

  console.log(`\n=== 결과 ===`)
  console.log(`  ✓ inserted: ${inserted}`)
  console.log(`  ↻ updated:  ${updated}`)
  console.log(`  ⏭ skipped:  ${skipped}`)
}

async function main(): Promise<void> {
  const args = parseArgs()
  console.log('🚀 migrate-to-blog 시작')
  console.log(`   mode: ${args.dryRun ? 'DRY-RUN' : args.force ? 'UPSERT' : 'INSERT'}`)

  const payloads = await collectPayloads()
  printSummary(payloads)

  if (args.dryRun) {
    console.log('\n(dry-run — DB 변경 없음)')
    return
  }

  await runInsert(payloads, args.force)
  console.log('\n✅ 완료')
}

main().catch(err => {
  console.error('치명적 오류:', err)
  process.exit(1)
})
