#!/usr/bin/env tsx
// 블로그 파이프라인 스테이지별 실측 (DB 저장 X, 이미지 skip).
// 1) Writer 를 직접 호출해 실제 토큰/비용 측정.
// 2) 나머지 스테이지는 기존 ai_generations 레거시 로그의 모델별 평균에 확률 가중 합산.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'
import { getCities, getCategories, getAllPlaces } from '../src/lib/data.supabase'
import { writeBlog, type WriterInput } from '../src/lib/ai/agents/writer'
import { fetchExternalReferences } from '../src/lib/blog/external-reference'
import { buildResearchPack } from '../src/lib/ai/agents/researcher'
import { estimateStageCostKrw, type PipelineStageLog } from '../src/lib/ai/pipeline-telemetry'
import { MONTHLY_BLOG_QUOTA_PER_PLACE } from '../src/lib/billing/types'
import type { Place } from '../src/lib/types'

const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 1 })

async function main() {
  const admin = getAdminClient()!

  // ── 1. 오늘 큐의 토픽 조회
  const { data: qRows } = await admin
    .from('blog_topic_queue')
    .select('*')
    .eq('planned_date', '2026-04-23')
    .limit(1)
  if (!qRows?.length) { console.log('오늘 큐 없음'); return }
  const topic = qRows[0] as {
    post_type: 'detail' | 'compare' | 'guide' | 'keyword'
    angle: string
    sector: string
    city: string
    category: string | null
    target_query: string
    place_id: string | null
  }
  console.log(`🎯 토픽: ${topic.post_type} · angle=${topic.angle} · "${topic.target_query}" · sector=${topic.sector}\n`)

  // ── 2. Context
  const [cities, categories, allPlaces] = await Promise.all([getCities(), getCategories(), getAllPlaces()])
  const cityObj = cities.find(c => c.slug === topic.city)!
  const categoryObj = categories.find(c => c.slug === topic.category)

  let verifiedPlaces: Place[] = []
  if (topic.place_id) {
    const { data: placeSlug } = await admin.from('places').select('slug').eq('id', topic.place_id).single()
    if (placeSlug) {
      const found = allPlaces.find(p => p.slug === (placeSlug as { slug: string }).slug)
      if (found) verifiedPlaces = [found]
    }
  }
  const externalRefs = await fetchExternalReferences({
    sector: topic.sector,
    category: topic.category ?? undefined,
    cityName: cityObj.name,
    internalActiveCount: verifiedPlaces.length,
    minReferenceCount: 5,
    excludeNames: verifiedPlaces.map(p => p.name),
  })
  const researchPack = verifiedPlaces.length > 0 ? buildResearchPack(verifiedPlaces) : null

  console.log(`  verifiedPlaces=${verifiedPlaces.length}  externalRefs=${externalRefs.places.length}\n`)

  // ── 3. Writer 실측 1회
  console.log('⏳ Writer (Sonnet 4.6) 실행 중...')
  const writerInput: WriterInput = {
    city: topic.city, cityName: cityObj.name,
    category: topic.category ?? 'general',
    categoryName: categoryObj?.name ?? '전체',
    sector: topic.sector,
    postType: topic.post_type,
    angle: topic.angle as 'review-deepdive' | 'comparison-context' | 'procedure-guide' | 'first-visit',
    targetQuery: topic.target_query,
    verifiedPlaces, externalReferences: externalRefs.places, researchPack,
  }
  const t0 = Date.now()
  let writerOut
  try {
    writerOut = await writeBlog(writerInput)
  } catch (err) {
    console.error('writer 실패:', err)
    process.exit(1)
  }
  const writerLatency = Date.now() - t0
  const writerCost = estimateStageCostKrw({
    stage: 'writer', model: 'claude-sonnet-4-6',
    inputTokens: writerOut.tokensUsed.input,
    outputTokens: writerOut.tokensUsed.output,
    latencyMs: writerLatency,
  } as PipelineStageLog)

  console.log(`  ✅ ${(writerLatency / 1000).toFixed(1)}초  in=${fmt(writerOut.tokensUsed.input)} out=${fmt(writerOut.tokensUsed.output)}  ₩${fmt(writerCost)}`)
  console.log(`  title: ${writerOut.title.slice(0, 50)}...`)
  console.log(`  content: ${writerOut.content.length}자  /  tags: ${writerOut.tags.length}  /  faqs: ${writerOut.faqs.length}\n`)

  // ── 4. 나머지 스테이지: ai_generations 기반 평균 + 확률 가중
  // Haiku 499콜 평균 in=1582.8 / out=2369.8 → per-call ₩15
  // (이건 실제 블로그 파이프라인 haiku 호출보다 output 이 많음. 블로그 reviewer/medical 은 보통 짧음.)
  // 보수적으로 블로그 reviewer = 평균의 60%, medical = 50% 로 잡음.
  const HAIKU_AVG_CALL_KRW = 15 * 0.6   // 약 ₩9
  const MED_CHECK_KRW = 15 * 0.5        // 약 ₩7.5
  const IMAGE_KRW = 0.006 * 1400        // gpt-image-2 low, ₩8.4

  // 확률 가중 (pipeline 흐름 기준):
  //   quality-reviewer: hardFailures>0 일 때만. 경험상 ~50%.
  //   medical-law-checker: sector ∈ {medical, legal, tax} 일 때만. 우리 현재 주 카테고리 피부과(medical) → 100% 가정.
  //   writer-rewrite: rewritePatch 있을 때. 경험상 ~50%.
  const probReviewer = 0.5
  const probRewrite = 0.5
  const probMedical = 1.0   // 피부과 중심 사업 기준

  const reviewerKrw = probReviewer * HAIKU_AVG_CALL_KRW
  const rewriteKrw = probRewrite * writerCost   // rewrite 는 writer 재호출과 거의 동일 비용
  const medicalKrw = probMedical * MED_CHECK_KRW

  const totalPerPost = writerCost + reviewerKrw + medicalKrw + rewriteKrw + IMAGE_KRW

  console.log(`═══════════════════════════════════════════════════`)
  console.log(`📊 블로그 1편 원가 구성`)
  console.log(`═══════════════════════════════════════════════════`)
  console.log(`  writer           (실측 1회)                                    ₩${fmt(writerCost).padStart(7)}`)
  console.log(`  quality-reviewer (Haiku, ${(probReviewer * 100).toFixed(0)}% 확률 실행)              ₩${fmt(reviewerKrw).padStart(7)}`)
  console.log(`  medical-checker  (Haiku, ${(probMedical * 100).toFixed(0)}% — 피부과 주력)           ₩${fmt(medicalKrw).padStart(7)}`)
  console.log(`  writer-rewrite   (Sonnet, ${(probRewrite * 100).toFixed(0)}% 확률, writer 동가)      ₩${fmt(rewriteKrw).padStart(7)}`)
  console.log(`  image-thumbnail  (gpt-image-2 low 1024)                        ₩${fmt(IMAGE_KRW).padStart(7)}`)
  console.log(`  ───────────────────────────────────────────────────────────────────────`)
  console.log(`  합계 (기대값):                                                 ₩${fmt(totalPerPost).padStart(7)}\n`)

  // ── 5. 단위 경제학
  console.log(`═══════════════════════════════════════════════════`)
  console.log(`💼 단위 경제학 — 월 ${MONTHLY_BLOG_QUOTA_PER_PLACE}편 × 업체 수`)
  console.log(`═══════════════════════════════════════════════════`)
  const monthlyPerPlace = totalPerPost * MONTHLY_BLOG_QUOTA_PER_PLACE
  const monthlyPerPlaceConservative = monthlyPerPlace * 1.4   // 주변 크론 보정
  console.log(`  월 업체당 블로그 원가:          ₩${fmt(monthlyPerPlace)}`)
  console.log(`  + 주변 크론 (1.4배 보정):       ₩${fmt(monthlyPerPlaceConservative)}`)
  console.log(`  구독 매출 ₩33,000 vs 실원가:    마진 ₩${fmt(33_000 - monthlyPerPlaceConservative)} (${((33_000 - monthlyPerPlaceConservative) / 33_000 * 100).toFixed(1)}%)\n`)

  console.log(`  ┌────────┬──────────────┬──────────────┬──────────────┐`)
  console.log(`  │ 업체수 │ MRR          │ 실원가       │ Gross        │`)
  console.log(`  ├────────┼──────────────┼──────────────┼──────────────┤`)
  for (const n of [1, 5, 10, 20, 50, 100]) {
    const mrr = 33_000 * n
    const cost = monthlyPerPlaceConservative * n
    console.log(`  │ ${String(n).padStart(6)} │ ₩${fmt(mrr).padStart(11)} │ ₩${fmt(cost).padStart(11)} │ ₩${fmt(mrr - cost).padStart(11)} │`)
  }
  console.log(`  └────────┴──────────────┴──────────────┴──────────────┘`)

  console.log(`\n📌 측정 전제:`)
  console.log(`   - 환율: $1 = ₩1,400 (pipeline-telemetry.ts USD_TO_KRW)`)
  console.log(`   - Sonnet 4.6: $3/$15 per 1M tokens (in/out)`)
  console.log(`   - Haiku 4.5:  $0.8/$4 per 1M tokens`)
  console.log(`   - gpt-image-2 low 1024×1024: $0.006/장`)
  console.log(`   - VAT 별도, Vercel/Supabase/도메인 등 인프라 제외`)
}

main().catch(e => { console.error('ERROR:', e); process.exit(1) })
