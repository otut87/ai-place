#!/usr/bin/env tsx
// 블로그 1편당 실제 AI 비용 분석.
// 우선순위: 1) blog_posts.pipeline_log  2) ai_generations 레거시 로그
// 모델 가격은 pipeline-telemetry.ts 의 PRICING (2026-04 기준).
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'
import { estimateStageCostKrw, type PipelineLog, type PipelineStageLog } from '../src/lib/ai/pipeline-telemetry'
import { MONTHLY_BLOG_QUOTA_PER_PLACE } from '../src/lib/billing/types'

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })
const avg = (total: number, n: number) => (n > 0 ? total / n : 0)

async function inspectPipelineLogs(): Promise<number> {
  const admin = getAdminClient()!
  const { data, error } = await admin
    .from('blog_posts')
    .select('id, slug, post_type, created_at, pipeline_log')
    .not('pipeline_log', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error(error); return 0 }

  const rows = (data ?? []) as Array<{ post_type: string | null; pipeline_log: PipelineLog | null }>
  console.log(`[blog_posts] pipeline_log 존재: ${rows.length}건`)
  if (rows.length === 0) return 0

  const byStage = new Map<string, { cost: number; in: number; out: number; count: number }>()
  let totalCost = 0, totalIn = 0, totalOut = 0, totalLatency = 0
  const byType = new Map<string, { count: number; cost: number; latency: number }>()

  for (const r of rows) {
    const log = r.pipeline_log
    if (!log) continue
    totalCost += log.estimatedCostKrw ?? 0
    totalLatency += log.totalLatencyMs ?? 0
    const t = r.post_type ?? 'unknown'
    const prev = byType.get(t) ?? { count: 0, cost: 0, latency: 0 }
    prev.count += 1; prev.cost += log.estimatedCostKrw ?? 0; prev.latency += log.totalLatencyMs ?? 0
    byType.set(t, prev)
    for (const s of log.stages ?? []) {
      totalIn += s.inputTokens ?? 0
      totalOut += s.outputTokens ?? 0
      const k = `${s.stage}${s.model ? ` (${s.model})` : ''}`
      const ps = byStage.get(k) ?? { cost: 0, in: 0, out: 0, count: 0 }
      ps.cost += estimateStageCostKrw(s as PipelineStageLog)
      ps.in += s.inputTokens ?? 0; ps.out += s.outputTokens ?? 0; ps.count += 1
      byStage.set(k, ps)
    }
  }

  const n = rows.length
  console.log(`\n[평균] ₩${fmt(avg(totalCost, n))} / 편  |  ${fmt(avg(totalLatency, n) / 1000)}초  |  in=${fmt(avg(totalIn, n))} out=${fmt(avg(totalOut, n))}`)
  console.log(`\n[post_type 별]`)
  for (const [t, a] of byType) console.log(`  ${t.padEnd(10)} ${a.count}편 ₩${fmt(a.cost / a.count)} / 편 (${fmt(a.latency / a.count / 1000)}초)`)
  console.log(`\n[스테이지별 평균 비용]`)
  for (const [k, s] of Array.from(byStage.entries()).sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(`  ${k.padEnd(48)} ₩${fmt(s.cost / n).padStart(7)}  in=${fmt(s.in / n)} out=${fmt(s.out / n)}`)
  }
  return avg(totalCost, n)
}

async function inspectAiGenerations(): Promise<{ perCall: number; byModel: Map<string, { count: number; cost: number; in: number; out: number }> }> {
  const admin = getAdminClient()!
  // ai_generations 컬럼이 정확히 뭔지 모르므로 와일드카드
  const { data, error } = await admin
    .from('ai_generations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) { console.log(`\n[ai_generations] 접근 실패: ${error.message}`); return { perCall: 0, byModel: new Map() } }

  const rows = (data ?? []) as Array<Record<string, unknown>>
  console.log(`\n\n═══════════════════════════════════════════════════`)
  console.log(`[ai_generations] 최근 500건 조회: ${rows.length}건`)
  if (rows.length === 0) return { perCall: 0, byModel: new Map() }

  // 샘플 1건 구조 파악
  console.log(`샘플 컬럼: ${Object.keys(rows[0]).join(', ')}`)

  const byModel = new Map<string, { count: number; cost: number; in: number; out: number }>()
  let totalCost = 0
  for (const r of rows) {
    const model = (r.model as string) ?? 'unknown'
    const inTok = Number((r.input_tokens ?? r.inputTokens ?? r.prompt_tokens) ?? 0)
    const outTok = Number((r.output_tokens ?? r.outputTokens ?? r.completion_tokens) ?? 0)
    const costUsd = Number((r.cost_usd ?? r.cost ?? r.total_cost) ?? NaN)
    const costKrw = Number.isFinite(costUsd) ? costUsd * 1400 : estimateStageCostKrw({ stage: 'writer', model, inputTokens: inTok, outputTokens: outTok, latencyMs: 0 } as PipelineStageLog)
    totalCost += costKrw
    const prev = byModel.get(model) ?? { count: 0, cost: 0, in: 0, out: 0 }
    prev.count += 1; prev.cost += costKrw; prev.in += inTok; prev.out += outTok
    byModel.set(model, prev)
  }
  console.log(`\n[모델별 집계] 총 ${rows.length}콜  ₩${fmt(totalCost)} (avg ₩${fmt(avg(totalCost, rows.length))}/콜)`)
  for (const [m, s] of Array.from(byModel.entries()).sort((a, b) => b[1].cost - a[1].cost)) {
    console.log(`  ${m.padEnd(35)} ${s.count}콜  ₩${fmt(s.cost).padStart(8)} (avg ₩${fmt(s.cost / s.count)}, in=${fmt(s.in / s.count)} out=${fmt(s.out / s.count)})`)
  }
  return { perCall: avg(totalCost, rows.length), byModel }
}

// 실제 기록이 없을 때 writer/reviewer 프롬프트 크기 + 기댓값으로 이론 비용 추정.
async function theoreticalEstimate(): Promise<number> {
  console.log(`\n\n═══════════════════════════════════════════════════`)
  console.log(`[이론 추정] 기록이 없으므로 파이프라인 구조 기반 예측`)
  console.log(`═══════════════════════════════════════════════════`)
  // 가정 (writer.ts / quality-reviewer.ts 실측 전까지 보수적):
  //   writer:           input 6_000 tok, output 3_500 tok (본문 2_500자 + faqs)
  //   quality-reviewer: 50% 확률 실행, input 2_000, output 800
  //   medical-law:      20% 확률 (medical/legal/tax), input 1_500, output 400
  //   writer-rewrite:   50% 확률, input 6_500 output 3_500
  //   image-thumbnail:  거의 항상 실행 (perImage $0.006)
  const PRICING = {
    sonnet: { in: 3, out: 15 },    // per 1M
    haiku:  { in: 0.8, out: 4 },
  }
  const usdToKrw = 1400
  const writer = ((6_000 * PRICING.sonnet.in) + (3_500 * PRICING.sonnet.out)) / 1_000_000 * usdToKrw
  const reviewer = 0.5 * ((2_000 * PRICING.haiku.in) + (800 * PRICING.haiku.out)) / 1_000_000 * usdToKrw
  const medical = 0.2 * ((1_500 * PRICING.haiku.in) + (400 * PRICING.haiku.out)) / 1_000_000 * usdToKrw
  const rewrite = 0.5 * ((6_500 * PRICING.sonnet.in) + (3_500 * PRICING.sonnet.out)) / 1_000_000 * usdToKrw
  const image = 0.006 * usdToKrw
  const total = writer + reviewer + medical + rewrite + image
  console.log(`  writer           (Sonnet, in 6k/out 3.5k):        ₩${fmt(writer)}`)
  console.log(`  quality-reviewer (Haiku, 50% 확률):                ₩${fmt(reviewer)}`)
  console.log(`  medical-checker  (Haiku, 20% 확률):                ₩${fmt(medical)}`)
  console.log(`  writer-rewrite   (Sonnet, 50% 확률):               ₩${fmt(rewrite)}`)
  console.log(`  image-thumbnail  (gpt-image-2 low):                ₩${fmt(image)}`)
  console.log(`  ────────────────────────────────────────────────────`)
  console.log(`  합계 (이론): ₩${fmt(total)} / 편  (실측 1~3편 후 재검증 권장)`)
  return total
}

function unitEconomics(avgKrwPerPost: number) {
  console.log(`\n\n═══════════════════════════════════════════════════`)
  console.log(`💼 단위 경제학 — 월 ${MONTHLY_BLOG_QUOTA_PER_PLACE}편 × 업체 수`)
  console.log(`═══════════════════════════════════════════════════`)
  const monthlyPerPlace = avgKrwPerPost * MONTHLY_BLOG_QUOTA_PER_PLACE
  console.log(`  블로그 원가:      월 업체당 ₩${fmt(monthlyPerPlace)}`)
  console.log(`  구독 매출:        월 업체당 ₩33,000 (VAT 별도)`)
  console.log(`  블로그만 반영 마진: ₩${fmt(33_000 - monthlyPerPlace)}  (${((33_000 - monthlyPerPlace) / 33_000 * 100).toFixed(1)}%)`)
  console.log(`  주의:  월보고서/키워드리필/perf-feedback/재시도 등 주변 크론 비용은 별도.`)
  console.log(`        보수적으로 블로그 원가의 1.3~1.5배로 상정 권장.\n`)
  console.log(`  ┌────────┬──────────────┬─────────────┬──────────────┐`)
  console.log(`  │ 업체수 │ MRR          │ 블로그 원가 │ Gross 마진   │`)
  console.log(`  ├────────┼──────────────┼─────────────┼──────────────┤`)
  for (const n of [1, 5, 10, 20, 50, 100]) {
    const mrr = 33_000 * n
    const cost = monthlyPerPlace * n
    console.log(`  │ ${String(n).padStart(6)} │ ₩${fmt(mrr).padStart(11)} │ ₩${fmt(cost).padStart(10)} │ ₩${fmt(mrr - cost).padStart(11)} │`)
  }
  console.log(`  └────────┴──────────────┴─────────────┴──────────────┘`)
}

async function main() {
  const admin = getAdminClient()
  if (!admin) { console.error('admin unavailable'); process.exit(1) }

  console.log('═══════════════════════════════════════════════════')
  console.log('📊 AI Place 블로그 1편당 비용 분석')
  console.log(`═══════════════════════════════════════════════════\n`)

  const pipelineAvg = await inspectPipelineLogs()
  const aiGen = await inspectAiGenerations()
  const theoretical = (pipelineAvg === 0 && aiGen.byModel.size === 0) ? await theoreticalEstimate() : 0

  // 비용 확정 우선순위: pipeline_log > ai_generations total / call count > 이론
  let perPost = pipelineAvg
  if (!perPost) {
    // ai_generations 는 콜 단위. 블로그 1편 ≈ writer(2회 확률 평균 1.5) + reviewer + medical + image
    // 여기선 모델별 통계만 보여주고, 기록 있으면 writer 콜 1건 기준 × 1.5 로 근사.
    const sonnetStat = aiGen.byModel.get('claude-sonnet-4-6')
    if (sonnetStat && sonnetStat.count > 0) {
      perPost = (sonnetStat.cost / sonnetStat.count) * 1.5 + 0.006 * 1400
    }
  }
  if (!perPost) perPost = theoretical

  if (perPost) unitEconomics(perPost)
  else console.log('\n평균 값을 구할 수 없어 단위 경제학 skip.')
}

main().catch(e => { console.error(e); process.exit(1) })
