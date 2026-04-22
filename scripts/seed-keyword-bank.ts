// T-194 — 키워드 뱅크 seed 스크립트 (최초 1회).
//
// 실행: npx tsx scripts/seed-keyword-bank.ts [--city=cheonan] [--sector=medical] [--dry-run]
//
// 규모: 83 카테고리 × 6 angle × 25 키워드 = ~12,500 (풀 실행 시)
//       Haiku 건당 ~1~2원, 총 ~14,000원 (플랜).
// 분할: --sector 옵션으로 섹터별 실행 가능. 하루에 1~2 섹터씩 나눠 돌리는 게 안전.
//
// DB 중복(unique) 은 insertKeyword 가 조용히 스킵.

import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.resolve('.env.local') })
dotenv.config({ path: path.resolve('.env') })

import { getCategories } from '@/lib/data'
import { generateKeywordsForSector, ANGLE_KEYS, type AngleKey } from '@/lib/blog/keyword-generator'
import { insertKeyword } from '@/lib/blog/keyword-bank'
import { getAdminClient } from '@/lib/supabase/admin-client'

interface Args {
  city?: string
  cityName?: string
  sector?: string
  category?: string
  dryRun: boolean
  countPerAngle: number
}

function parseArgs(): Args {
  const args: Args = { dryRun: false, countPerAngle: 25 }
  for (const a of process.argv.slice(2)) {
    if (a === '--dry-run') args.dryRun = true
    else if (a.startsWith('--city=')) args.city = a.slice('--city='.length)
    else if (a.startsWith('--city-name=')) args.cityName = a.slice('--city-name='.length)
    else if (a.startsWith('--sector=')) args.sector = a.slice('--sector='.length)
    else if (a.startsWith('--category=')) args.category = a.slice('--category='.length)
    else if (a.startsWith('--count=')) args.countPerAngle = Number(a.slice('--count='.length))
  }
  return args
}

async function main() {
  const args = parseArgs()
  const admin = getAdminClient()
  if (!admin) {
    console.error('admin client 미초기화 — SUPABASE_SERVICE_ROLE_KEY 확인')
    process.exit(1)
  }

  const categories = await getCategories()
  const filtered = categories.filter(c => {
    if (args.sector && c.sector !== args.sector) return false
    if (args.category && c.slug !== args.category) return false
    return true
  })

  console.log(`[seed] 대상 카테고리 ${filtered.length}개, angle ${ANGLE_KEYS.length}, count/angle ${args.countPerAngle}`)
  console.log(`[seed] 예상 총 생성 ~${filtered.length * ANGLE_KEYS.length * args.countPerAngle} 건`)
  if (args.dryRun) console.log('[seed] --dry-run — 실제 호출/삽입 생략')

  let totalInserted = 0
  let totalGenerated = 0
  let totalRejected = 0
  const combos = filtered.length * ANGLE_KEYS.length
  let done = 0
  const startedAt = Date.now()

  for (const cat of filtered) {
    for (const angle of ANGLE_KEYS) {
      done += 1
      const label = `[${done}/${combos}] ${cat.sector}/${cat.slug}/${angle}`

      if (args.dryRun) {
        console.log(`${label} (dry-run)`)
        continue
      }

      // 기존 풀 조회 (유사도 체크용)
      const { data: existingRows } = await admin
        .from('keyword_bank')
        .select('keyword')
        .eq('sector', cat.sector)
        .eq('active', true)
        .limit(500)
      const existingKeywords = ((existingRows ?? []) as Array<{ keyword: string }>).map(r => r.keyword)

      try {
        const gen = await generateKeywordsForSector({
          sector: cat.sector,
          category: cat.slug,
          city: args.city ?? null,
          cityName: args.cityName,
          angle: angle as AngleKey,
          count: args.countPerAngle,
          existingKeywords,
        })
        totalGenerated += gen.keywords.length
        totalRejected += gen.rejected.length

        for (const kw of gen.keywords) {
          const r = await insertKeyword({
            keyword: kw.keyword,
            sector: cat.sector,
            city: args.city ?? null,
            angle,
            priority: kw.priority,
            competition: kw.competition,
            longtails: kw.longtails,
            source: 'llm_generated',
          })
          if (r.inserted) totalInserted += 1
        }

        console.log(`${label} inserted=${gen.keywords.length}/${gen.keywords.length + gen.rejected.length} (rejected=${gen.rejected.length})`)
      } catch (err) {
        console.error(`${label} 실패: ${err instanceof Error ? err.message : err}`)
      }

      // Anthropic API 레이트리밋 보호 — 1초 간격
      await new Promise(r => setTimeout(r, 1000))
    }
  }

  const elapsed = Math.round((Date.now() - startedAt) / 1000)
  console.log(`\n[seed] 완료 — ${elapsed}초`)
  console.log(`  생성 ${totalGenerated} / 거부 ${totalRejected} / DB insert ${totalInserted}`)
}

main().catch(err => {
  console.error('[seed] fatal:', err)
  process.exit(1)
})
