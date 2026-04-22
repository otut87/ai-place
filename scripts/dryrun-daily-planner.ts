// T-196 — daily planner 드라이런 (DB INSERT 없이 계획 결과만 출력).
//
// 실행: npx tsx scripts/dryrun-daily-planner.ts [--date=YYYY-MM-DD]
//
// 동작:
//  1) keyword_bank 풀 크기·sector 분포 출력
//  2) active places 수 출력
//  3) planDailyTopics 호출 — 10편 계획을 만들되 INSERT 하지 않음
//  4) 계획 rows 를 표 형식으로 출력 (post_type / angle / city / category / keyword / 시각)

import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config({ path: path.resolve('.env') })

import { getAdminClient } from '@/lib/supabase/admin-client'
import { planDailyTopics } from '@/lib/blog/topic-planner'

function kstDateToday(): string {
  const now = Date.now()
  const kstMs = now + 9 * 60 * 60 * 1000
  const d = new Date(kstMs)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function kstFromUtc(iso: string): string {
  const d = new Date(iso)
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000
  const k = new Date(kstMs)
  return `${String(k.getUTCHours()).padStart(2, '0')}:${String(k.getUTCMinutes()).padStart(2, '0')}`
}

async function main() {
  const admin = getAdminClient()
  if (!admin) {
    console.error('admin client 미초기화 — SUPABASE_SERVICE_ROLE_KEY 확인')
    process.exit(1)
  }

  const dateArg = process.argv.find(a => a.startsWith('--date='))?.slice('--date='.length)
  const plannedDate = dateArg ?? kstDateToday()

  // ─── 1. Pre-flight ────────────────────────────────────
  console.log(`\n=== daily-planner 드라이런 (${plannedDate}) ===\n`)

  const { count: kwCount } = await admin
    .from('keyword_bank')
    .select('id', { count: 'exact', head: true })
  console.log(`keyword_bank: ${kwCount ?? 0} 건`)

  const { data: kwBySector } = await admin
    .from('keyword_bank')
    .select('sector')
  const sectorCounts: Record<string, number> = {}
  for (const r of (kwBySector ?? []) as Array<{ sector: string }>) {
    sectorCounts[r.sector] = (sectorCounts[r.sector] ?? 0) + 1
  }
  console.log(`  sector 분포:`, sectorCounts)

  const { count: placeCount } = await admin
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active')
  console.log(`active places: ${placeCount ?? 0} 곳`)

  const { count: existingQueue } = await admin
    .from('blog_topic_queue')
    .select('id', { count: 'exact', head: true })
    .eq('planned_date', plannedDate)
  console.log(`기존 ${plannedDate} 큐: ${existingQueue ?? 0} 건`)

  // ─── 2. planDailyTopics 호출 (read-only) ─────────────
  console.log(`\n--- 계획 생성 중... ---\n`)
  const plan = await planDailyTopics({ plannedDate })

  if (plan.rows.length === 0) {
    console.error('❌ 계획 가능한 토픽 0개')
    console.error(`  skipped: ${JSON.stringify(plan.skipped)}`)
    process.exit(1)
  }

  // ─── 3. 결과 출력 ────────────────────────────────────
  console.log(`✅ 계획 완료 — ${plan.rows.length} 편`)
  console.log(`  분포: ${Object.entries(plan.rows.reduce((acc, r) => {
    acc[r.post_type] = (acc[r.post_type] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)).map(([k, v]) => `${k}:${v}`).join(' / ')}`)

  console.log(`  city+category 사용 횟수:`)
  for (const [k, v] of Object.entries(plan.cityCategoryUsage)) {
    console.log(`    ${k}: ${v}`)
  }

  if (plan.skipped.length > 0) {
    console.log(`\n  ⚠ skipped ${plan.skipped.length} 건:`)
    for (const s of plan.skipped) console.log(`    [${s.postType}] ${s.reason}`)
  }

  console.log(`\n┌─────┬─────────┬────────────────────┬──────────┬──────────────┬──────────────────────┬────────┐`)
  console.log(`│  #  │ type    │ angle              │ city     │ category     │ target_query         │ KST    │`)
  console.log(`├─────┼─────────┼────────────────────┼──────────┼──────────────┼──────────────────────┼────────┤`)
  plan.rows.forEach((r, i) => {
    const idx = String(i + 1).padEnd(3)
    const type = (r.post_type).padEnd(7)
    const angle = (r.angle ?? '-').padEnd(18)
    const city = (r.city ?? '-').padEnd(8)
    const cat = (r.category ?? '-').padEnd(12)
    const tq = (r.target_query ?? '-').slice(0, 20).padEnd(20)
    const kst = kstFromUtc(r.scheduled_for)
    console.log(`│ ${idx} │ ${type} │ ${angle} │ ${city} │ ${cat} │ ${tq} │ ${kst}  │`)
  })
  console.log(`└─────┴─────────┴────────────────────┴──────────┴──────────────┴──────────────────────┴────────┘`)

  console.log(`\n※ 이 스크립트는 INSERT 하지 않습니다. 실제 실행은:`)
  console.log(`   curl 'http://localhost:3000/api/cron/blog-daily-planner?date=${plannedDate}' \\`)
  console.log(`     -H "Authorization: Bearer \${VERCEL_CRON_SECRET}"`)
}

main().catch(err => {
  console.error('fatal:', err)
  process.exit(1)
})
