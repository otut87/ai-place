// T-195 — 블로그 생성 파이프라인 (Phase 3).
//
// 흐름:
//  1. (researcher)     — Phase 5 에서 실체 (지금은 skeleton)
//  2. writer           — Sonnet 4.6
//  3. quality-score    — quality-v2
//  4. quality-reviewer — Haiku (patches)
//  5. medical-law-checker (조건부, Haiku)
//  6. writer-rewrite   — Sonnet (max 1회)
//  7. quality-score-final — 재스코어
//  8. similarity-guard — Jaccard 25/35
//
// 이미지 단계 제거 — 텍스트 중심 전략, AI 검색은 이미지 비중 낮음.
// Storage/thumbnail_url 은 migration 042 에서 drop.
//
// 반환:
//  - status: 'success' | 'failed_quality' | 'failed_similarity' | 'failed_timeout'
//  - 전체 draft + pipelineLog + qualityResult + similarity

import type { Place } from '@/lib/types'
import type { AngleKey } from '@/lib/ai/angles'
import type { ExternalPlace } from '@/lib/blog/external-reference'
import { writeBlog, type WriterInput, type WriterOutput, type ResearchPack } from './writer'
import { reviewQuality, type RewritePatch } from './quality-reviewer'
import { checkCompliance, getDisclaimer, type ComplianceIssue } from './medical-law-checker'
import { buildResearchPack } from './researcher'
import { scoreBlogPostV2, type BlogQualityV2Result } from '@/lib/blog/quality-v2'
import { guardBeforeInsert, type SimilarityGuardResult } from '@/lib/blog/similarity-guard'
import { PipelineTelemetry, type PipelineLog } from '@/lib/ai/pipeline-telemetry'

export type PipelineStatus =
  | 'success'
  | 'warn'              // similarity warn / quality warn (편집기 경고 노출)
  | 'failed_quality'    // 재시도 후에도 hardFailures 남음
  | 'failed_similarity' // 0.35+ 차단
  | 'failed_timeout'    // 파이프라인 전체 타임아웃

export interface PipelineInput {
  city: string
  cityName: string
  category: string
  categoryName: string
  sector: string
  postType: 'keyword' | 'compare' | 'guide' | 'detail' | 'general'
  angle: AngleKey
  targetQuery: string
  slug: string                     // 이미지 파일명 + slug 룰 검증 (최종 결정 slug)
  verifiedPlaces: Place[]
  externalReferences: ExternalPlace[]
  researchPack?: ResearchPack | null
  excludeBlogId?: string | null    // edit 시 자신 제외
  /** 전체 파이프라인 타임아웃 (기본 90s). */
  totalTimeoutMs?: number
  /** 테스트 override. */
  apiKey?: string
}

export interface PipelineResult {
  status: PipelineStatus
  draft: WriterOutput | null
  quality: BlogQualityV2Result | null
  qualityIssues: string[]
  rewritePatches: RewritePatch[]
  complianceIssues: ComplianceIssue[]
  similarity: SimilarityGuardResult | null
  pipelineLog: PipelineLog
  reason?: string                  // failed_* 상세
}

const DEFAULT_TIMEOUT_MS = 90_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout ${ms}ms`)), ms)
    p.then(r => { clearTimeout(timer); resolve(r) }).catch(e => { clearTimeout(timer); reject(e) })
  })
}

function buildQualityInput(input: PipelineInput, draft: WriterOutput) {
  return {
    title: draft.title,
    summary: draft.summary,
    content: draft.content,
    slug: input.slug,
    tags: draft.tags,
    targetQuery: input.targetQuery,
    faqs: draft.faqs,
    categoryOrSector: input.sector,
    cityName: input.cityName,
    allowedPlaceNames: [
      ...input.verifiedPlaces.map(p => p.name),
      ...input.externalReferences.map(e => e.name),
    ],
    forbiddenPlaceNames: [] as string[],
  }
}

export async function runBlogPipeline(input: PipelineInput): Promise<PipelineResult> {
  const telemetry = new PipelineTelemetry()
  const totalTimeout = input.totalTimeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = Date.now()
  const remaining = () => Math.max(1_000, totalTimeout - (Date.now() - startedAt))

  // ─── 0. researcher (deterministic, 외부 API 0) ──────────
  // input.researchPack 이 명시되면 그대로, 아니면 verifiedPlaces 에서 추출.
  let researchPack = input.researchPack ?? null
  if (!researchPack && input.verifiedPlaces.length > 0) {
    const t0 = Date.now()
    researchPack = buildResearchPack(input.verifiedPlaces)
    telemetry.record({
      stage: 'researcher',
      latencyMs: Date.now() - t0,
      status: 'pass',
      result: {
        highlights: researchPack.reviewHighlights.length,
        priceBands: researchPack.priceBands.length,
        specialties: researchPack.specialties?.length ?? 0,
      },
    })
  }

  // ─── 1. writer ────────────────────────────────────────────────
  const writerInput: WriterInput = {
    city: input.city,
    cityName: input.cityName,
    category: input.category,
    categoryName: input.categoryName,
    sector: input.sector,
    postType: input.postType,
    angle: input.angle,
    targetQuery: input.targetQuery,
    verifiedPlaces: input.verifiedPlaces,
    externalReferences: input.externalReferences,
    researchPack,
    apiKey: input.apiKey,
  }

  let draftMaybe: WriterOutput | null
  try {
    draftMaybe = await telemetry.run(
      'writer',
      () => withTimeout(writeBlog(writerInput), remaining(), 'writer'),
      {
        model: 'claude-sonnet-4-6',
        extractTokens: r => r ? { input: r.tokensUsed.input, output: r.tokensUsed.output } : {},
      },
    )
  } catch (err) {
    return buildFailure(telemetry, 'failed_timeout', `writer: ${err instanceof Error ? err.message : err}`)
  }
  if (!draftMaybe) {
    return buildFailure(telemetry, 'failed_quality', 'writer 실패 — draft 없음')
  }
  // draftMaybe 가 non-null 임을 확인했으므로 draft 를 non-nullable 로 좁힘.
  // rewrite 루프에서 재할당되므로 let 유지.
  let draft: WriterOutput = draftMaybe

  // ─── 2. quality-score ────────────────────────────────────────
  let quality = scoreBlogPostV2(buildQualityInput(input, draft))
  telemetry.record({
    stage: 'quality-score',
    latencyMs: 0,
    status: quality.hardFailures.length === 0 ? 'pass' : 'fail',
    result: {
      score: quality.score,
      hardFailures: quality.hardFailures,
      warnings: quality.warnings,
    },
  })

  let rewritePatches: RewritePatch[] = []
  let qualityIssues: string[] = []
  let complianceIssues: ComplianceIssue[] = []

  // ─── 3. quality-reviewer (hardFailures 있을 때만) ──────────
  if (quality.hardFailures.length > 0) {
    const reviewed = await telemetry.run(
      'quality-reviewer',
      () => withTimeout(reviewQuality({
        title: draft.title,
        summary: draft.summary,
        content: draft.content,
        rulesReport: quality.rulesReport,
        hardFailures: quality.hardFailures,
        warnings: quality.warnings,
        apiKey: input.apiKey,
      }), remaining(), 'quality-reviewer'),
      {
        model: 'claude-haiku-4-5-20251001',
        extractTokens: r => r ? { input: r.tokensUsed.input, output: r.tokensUsed.output } : {},
      },
    )
    if (reviewed) {
      rewritePatches = reviewed.rewritePatches
      qualityIssues = reviewed.issues
    }
  }

  // ─── 4. medical-law-checker (조건부) ─────────────────────
  if (['medical', 'legal', 'tax'].includes(input.sector)) {
    const compliance = await telemetry.run(
      'medical-law-checker',
      () => withTimeout(checkCompliance({
        sector: input.sector,
        content: draft.content,
        faqs: draft.faqs,
        apiKey: input.apiKey,
      }), remaining(), 'medical-law-checker'),
      {
        model: 'claude-haiku-4-5-20251001',
        extractTokens: r => r ? { input: r.tokensUsed.input, output: r.tokensUsed.output } : {},
        extractStatus: r => r && r.issues.some(i => i.severity === 'fail') ? 'warn' : 'pass',
      },
    )
    if (compliance) {
      complianceIssues = compliance.issues
      // 컴플라이언스 이슈를 rewritePatch 로 변환 (writer 가 수정)
      for (const iss of compliance.issues) {
        if (iss.severity === 'fail') {
          rewritePatches.push({
            block: '자주 묻는 질문',
            instruction: `"${iss.phrase}" → "${iss.suggestion}" 으로 교체`,
          })
        }
      }
      // 면책 자동 삽입
      if (compliance.disclaimerNeeded) {
        const disc = getDisclaimer(input.sector)
        if (disc && !draft.content.includes('면책')) {
          draft = { ...draft, content: draft.content + disc }
        }
      }
    }
  }

  // ─── 5. writer rewrite (max 1회) ──────────────────────────
  if (rewritePatches.length > 0) {
    try {
      const rewritten = await telemetry.run(
        'writer-rewrite',
        () => withTimeout(writeBlog({
          ...writerInput,
          previousDraft: draft,
          rewritePatches,
        }), remaining(), 'writer-rewrite'),
        {
          model: 'claude-sonnet-4-6',
          extractTokens: r => r ? { input: r.tokensUsed.input, output: r.tokensUsed.output } : {},
          extractStatus: () => 'pass',
        },
      )
      if (rewritten) draft = rewritten
    } catch {
      // rewrite 실패해도 전체 중단 X — 최초 draft 유지
    }

    // ─── 6. 재스코어 ─────────────────────────────────────
    quality = scoreBlogPostV2(buildQualityInput(input, draft))
    telemetry.record({
      stage: 'quality-score-final',
      latencyMs: 0,
      status: quality.hardFailures.length === 0 ? 'pass' : 'fail',
      result: {
        score: quality.score,
        hardFailures: quality.hardFailures,
      },
    })
  }

  // ─── 7. similarity-guard ─────────────────────────────────
  const similarity = await telemetry.run(
    'similarity-guard',
    () => withTimeout(guardBeforeInsert({
      newContent: draft.content,
      newTitle: draft.title,
      excludeBlogId: input.excludeBlogId ?? null,
    }), remaining(), 'similarity-guard'),
    {
      extractStatus: r =>
        r?.verdict === 'block' ? 'fail' : r?.verdict === 'warn' ? 'warn' : 'pass',
      extractResult: r => r ? {
        similarity: r.similarity,
        verdict: r.verdict,
        similarPosts: r.similarPosts.length,
      } : {},
    },
  )

  // ─── 8. 최종 status 결정 ─────────────────────────────────
  let status: PipelineStatus = 'success'
  let reason: string | undefined

  if (similarity?.verdict === 'block') {
    status = 'failed_similarity'
    reason = `최근 30일 블로그와 유사도 ${similarity.similarity} (0.35 초과)`
  } else if (quality.hardFailures.length > 0) {
    status = 'failed_quality'
    reason = `hardFailures 남음: ${quality.hardFailures.join(', ')}`
  } else if (similarity?.verdict === 'warn' || quality.warnings.length > 0) {
    status = 'warn'
  }

  return {
    status,
    draft,
    quality,
    qualityIssues,
    rewritePatches,
    complianceIssues,
    similarity,
    pipelineLog: telemetry.build(),
    reason,
  }
}

function buildFailure(
  telemetry: PipelineTelemetry,
  status: PipelineStatus,
  reason: string,
): PipelineResult {
  return {
    status,
    draft: null,
    quality: null,
    qualityIssues: [],
    rewritePatches: [],
    complianceIssues: [],
    similarity: null,
    pipelineLog: telemetry.build(),
    reason,
  }
}
