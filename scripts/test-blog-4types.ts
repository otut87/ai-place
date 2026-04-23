#!/usr/bin/env tsx
// E2E 테스트 — 4개 블로그 타입(detail/keyword/compare/guide) 실제 생성.
//
// 사용:  tsx scripts/test-blog-4types.ts
//
// 동작: Mock 후보 업체 3곳 으로 generateBlogDraft 를 4번 호출 (ANTHROPIC_API_KEY 사용).
// 산출: output/blog-test/{type}.md 4개 + {type}.json 메타 + index.md 요약.
// 비용: 타입당 약 ₩100-300, 총 ~₩500-1,500.
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { BlogPostType, Place } from '../src/lib/types'
import { generateBlogDraft, type GenerateBlogDraftResult } from '../src/lib/ai/generate-blog-draft'

// ── 입력 데이터 — 천안 피부과 mock 3곳 ────────────────────────────
const CANDIDATE_PLACES: Place[] = [
  {
    slug: 'cleanhue-clinic',
    name: '클린휴의원',
    city: 'cheonan',
    category: 'dermatology',
    description: '천안 서북구 소재 피부과. 여드름·모공·기미 전문 클리닉 운영.',
    address: '충청남도 천안시 서북구 충절로 324',
    phone: '041-559-7070',
    rating: 4.3,
    reviewCount: 29,
    services: [
      { name: '여드름 치료', description: '전문의 상담 + 레이저 병행', priceRange: '상담 문의' },
      { name: '모공·피지 관리', description: '스킨부스터·리프팅', priceRange: '상담 문의' },
      { name: '기미 치료', description: '레이저 토닝 프로그램', priceRange: '상담 문의' },
    ],
    faqs: [],
    tags: ['피부과', '여드름', '기미', '모공', '천안'],
    recommendedFor: ['여드름으로 고민하는 20-30대', '기미 치료 원하는 분'],
    strengths: ['전문의 2인 상주', '야간 상담 가능', '장비 다양'],
  },
  {
    slug: 'dr-evers-cheonan',
    name: '닥터에버스의원 천안점',
    city: 'cheonan',
    category: 'dermatology',
    description: '야간 진료 가능한 천안 피부과. 리프팅·미백 시술 전문.',
    address: '충청남도 천안시 동남구 만남로 12',
    phone: '041-567-1234',
    rating: 5.0,
    reviewCount: 7,
    services: [
      { name: '리프팅', description: '고주파·초음파 병용', priceRange: '상담 문의' },
      { name: '미백 관리', description: '멜라닌 케어 프로그램', priceRange: '상담 문의' },
    ],
    faqs: [],
    tags: ['피부과', '리프팅', '미백', '야간진료'],
    recommendedFor: ['바쁜 직장인', '야간 시술 원하는 분'],
    strengths: ['주 7일 야간 진료', '최신 장비'],
  },
  {
    slug: 'shinebeam-cheonan',
    name: '샤인빔클리닉 천안점',
    city: 'cheonan',
    category: 'dermatology',
    description: '스킨부스터·쥬베룩 중심의 천안 피부과.',
    address: '충청남도 천안시 서북구 불당동 1456',
    phone: '041-582-2222',
    rating: 4.0,
    reviewCount: 2,
    services: [
      { name: '스킨부스터', description: '보습·탄력 복합 시술', priceRange: '상담 문의' },
    ],
    faqs: [],
    tags: ['피부과', '스킨부스터', '쥬베룩'],
    recommendedFor: ['피부 탄력 개선 원하는 분'],
    strengths: ['스킨부스터 특화'],
  },
]

const SELECTION_REASONING = `천안 서북구·동남구 피부과 중 평점 4.0 이상 3곳 선정.
- 클린휴의원: 리뷰 29건 · 평점 4.3 — 여드름·모공 전문.
- 닥터에버스의원 천안점: 리뷰 7건 · 평점 5.0 — 야간 진료.
- 샤인빔클리닉 천안점: 리뷰 2건 · 평점 4.0 — 스킨부스터 특화.`

const POST_TYPES: BlogPostType[] = ['detail', 'keyword', 'compare', 'guide']

// ── Pricing (2026-04 Sonnet) ────────────────────────────────────
const SONNET_IN_PER_MTOK_USD = 3
const SONNET_OUT_PER_MTOK_USD = 15
const USD_TO_KRW = 1400

function estimateCostKrw(inTok: number, outTok: number): number {
  return ((inTok * SONNET_IN_PER_MTOK_USD) + (outTok * SONNET_OUT_PER_MTOK_USD)) / 1_000_000 * USD_TO_KRW
}

// ── 메인 ─────────────────────────────────────────────────────────
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY 가 .env.local 에 필요합니다.')
    process.exit(1)
  }

  const outDir = resolve(process.cwd(), 'output', 'blog-test')
  await mkdir(outDir, { recursive: true })

  console.log('═══════════════════════════════════════════════════════════')
  console.log('  📝 블로그 4타입 E2E 테스트')
  console.log('  후보 업체: 3곳 (천안 피부과 · mock 실명)')
  console.log(`  출력 폴더: ${outDir}`)
  console.log('═══════════════════════════════════════════════════════════\n')

  const results: Array<{
    postType: BlogPostType
    ok: boolean
    qualityScore?: number
    sevenBlockPassed?: boolean
    tokensIn?: number
    tokensOut?: number
    costKrw?: number
    filePath?: string
    error?: string
  }> = []

  let totalCostKrw = 0

  // 순차 실행 — rate limit 안전 + 진행 상황 보기 좋음.
  for (const postType of POST_TYPES) {
    console.log(`▶ [${postType}] 생성 중…`)
    const started = Date.now()
    try {
      const draft: GenerateBlogDraftResult = await generateBlogDraft({
        city: 'cheonan',
        cityName: '천안시',
        category: 'dermatology',
        categoryName: '피부과',
        sector: 'medical',
        postType,
        candidatePlaces: CANDIDATE_PLACES,
        selectionReasoning: SELECTION_REASONING,
      })
      const elapsed = ((Date.now() - started) / 1000).toFixed(1)
      const costKrw = estimateCostKrw(draft.tokensUsed.input, draft.tokensUsed.output)
      totalCostKrw += costKrw

      const mdPath = resolve(outDir, `${postType}.md`)
      const jsonPath = resolve(outDir, `${postType}.json`)

      const markdown = [
        `# ${draft.title}`,
        '',
        `> ${draft.summary}`,
        '',
        `**postType**: ${postType} · **qualityScore**: ${draft.qualityScore} / 100 · **sevenBlockPassed**: ${draft.sevenBlockPassed ? '✅' : '❌'}`,
        `**tags**: ${draft.tags.join(', ')}`,
        '',
        '---',
        '',
        draft.content,
        '',
        '---',
        '',
        '## FAQ (JSON-LD 추출용)',
        '',
        ...draft.faqs.map((f) => `**Q. ${f.question}**\n\nA. ${f.answer}\n`),
      ].join('\n')

      await writeFile(mdPath, markdown, 'utf8')
      await writeFile(jsonPath, JSON.stringify({
        postType,
        title: draft.title,
        summary: draft.summary,
        tags: draft.tags,
        faqs: draft.faqs,
        qualityScore: draft.qualityScore,
        sevenBlockPassed: draft.sevenBlockPassed,
        tokensUsed: draft.tokensUsed,
        costKrw: Math.round(costKrw * 10) / 10,
        elapsedSec: Number(elapsed),
        contentLength: draft.content.length,
      }, null, 2), 'utf8')

      results.push({
        postType,
        ok: true,
        qualityScore: draft.qualityScore,
        sevenBlockPassed: draft.sevenBlockPassed,
        tokensIn: draft.tokensUsed.input,
        tokensOut: draft.tokensUsed.output,
        costKrw,
        filePath: mdPath,
      })

      console.log(`   ✅ ${elapsed}초 · 품질 ${draft.qualityScore}/100 · 7블록 ${draft.sevenBlockPassed ? '통과' : '실패'} · ₩${Math.round(costKrw)}`)
      console.log(`   📄 ${mdPath}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      results.push({ postType, ok: false, error: msg })
      console.log(`   ❌ 실패: ${msg}`)
    }
    console.log()
  }

  // ── 요약 index.md ───────────────────────────────────────────────
  const indexLines: string[] = [
    '# 블로그 4타입 E2E 테스트 결과',
    '',
    `**생성 시각**: ${new Date().toISOString()}`,
    `**후보 업체**: ${CANDIDATE_PLACES.map((p) => p.name).join(' / ')}`,
    '',
    '| 타입 | 상태 | 품질 | 7블록 | 토큰(in/out) | 비용 | 파일 |',
    '|---|---|---|---|---|---|---|',
  ]
  for (const r of results) {
    if (r.ok) {
      indexLines.push(
        `| **${r.postType}** | ✅ | ${r.qualityScore}/100 | ${r.sevenBlockPassed ? '✅' : '❌'} | ${r.tokensIn}/${r.tokensOut} | ₩${Math.round(r.costKrw ?? 0)} | [${r.postType}.md](./${r.postType}.md) |`,
      )
    } else {
      indexLines.push(`| **${r.postType}** | ❌ | — | — | — | — | 실패: ${r.error} |`)
    }
  }
  indexLines.push('', `**총 비용**: ₩${Math.round(totalCostKrw)}`, '')
  const indexPath = resolve(outDir, 'index.md')
  await writeFile(indexPath, indexLines.join('\n'), 'utf8')

  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  📊 완료 — 총 비용 ₩${Math.round(totalCostKrw)}`)
  console.log(`  📄 요약: ${indexPath}`)
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(1)
})
