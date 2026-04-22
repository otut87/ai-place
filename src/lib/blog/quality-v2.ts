// T-193 — 결정론 품질 엔진 v2.
// 16개 룰(+AI cliché 보너스) 기반 0~100 스코어 + hardFailures 수집.
//
// 파이프라인 흐름 (Phase 3 와 연결):
//   writer → scoreBlogPostV2 → hardFailures 존재 시 writer rewrite 1회 → 재스코어.

import type { FAQ } from '@/lib/types'
import {
  checkTitleLength,
  checkMetaDescLength,
  checkH1Singleton,
  checkImageAltRequired,
  checkSlugAsciiSafe,
  checkDirectAnswerLength,
  checkFAQCount,
  checkTargetQueryUsage,
  checkSevenBlockStructure,
  checkCityMention,
  checkLocalBusinessMention,
  checkInternalLinks,
  checkPlaceNameAllowlist,
  checkBannedPhrases,
  checkNeutralTone,
  checkExternalLinks,
  checkKeywordDensity,
  checkSentenceEnding,
  checkHeadingDepth,
  checkTableOrList,
  checkAICliches,
  type RuleResult,
  type RuleAxis,
} from './quality-rules'

export interface BlogQualityV2Input {
  title: string
  summary: string          // meta description + Direct Answer Block 겸용
  content: string          // Markdown
  slug?: string            // draft 생성 단계에선 미정일 수 있음 → 없으면 slug 룰 스킵
  tags?: string[]          // 대표 키워드 후보
  targetQuery?: string | null
  faqs?: FAQ[]
  categoryOrSector?: string   // banned-phrases / template override 용
  cityName?: string           // GEO city mention 용
  allowedPlaceNames?: string[]   // verified + external 전부 (환각 allowlist)
  forbiddenPlaceNames?: string[] // 환각 후보 (예: 주변 경쟁 업체명)
  minLength?: number         // 본문 최소 길이 (기본 1,800자)
}

export interface BlogQualityV2Result {
  score: number                    // 0~100
  breakdown: {
    seo: { score: number; max: number }
    aeo: { score: number; max: number }
    geo: { score: number; max: number }
    sanitation: { score: number; max: number }
    quality: { score: number; max: number }
  }
  rulesReport: RuleResult[]        // 전체 룰 결과
  hardFailures: string[]           // severity=fail & !pass 룰 id 배열
  warnings: string[]               // severity=warn & !pass 룰 id 배열
  lengthCheck: { length: number; min: number; pass: boolean }
}

// 축별 가중치 — 총 100점 (SEO 20 + AEO 30 + GEO 15 + SAN 20 + QUAL 15).
const AXIS_WEIGHT: Record<RuleAxis, number> = {
  seo: 20,
  aeo: 30,
  geo: 15,
  sanitation: 20,
  quality: 15,
}

export function scoreBlogPostV2(input: BlogQualityV2Input): BlogQualityV2Result {
  const minLength = input.minLength ?? 1800
  const length = input.content.length

  // 대표 키워드 (density 측정용) — tags[0] 또는 targetQuery.
  const primaryKeyword = (input.tags?.[0] ?? input.targetQuery ?? '').trim()

  const rules: RuleResult[] = [
    // SEO (5). slug 미제공 시 해당 룰은 건너뜀 (draft 생성 단계 대응).
    checkTitleLength(input.title),
    checkMetaDescLength(input.summary),
    checkH1Singleton(input.content),
    checkImageAltRequired(input.content),
    ...(input.slug ? [checkSlugAsciiSafe(input.slug)] : []),

    // AEO (4)
    checkDirectAnswerLength(input.summary),
    checkFAQCount(input.faqs ?? []),
    checkTargetQueryUsage(input.content, input.targetQuery),
    checkSevenBlockStructure(input.content, input.categoryOrSector),

    // GEO (3) — cityName 없으면 조용히 패스 처리
    checkCityMention(input.content, input.cityName ?? '', input.cityName ? 5 : 0),
    checkLocalBusinessMention(input.content, input.allowedPlaceNames ?? [], 2),
    checkInternalLinks(input.content, 3),

    // 환각·위생 (4)
    checkPlaceNameAllowlist(
      input.content,
      input.allowedPlaceNames ?? [],
      input.forbiddenPlaceNames ?? [],
    ),
    checkBannedPhrases(input.content, input.categoryOrSector),
    checkNeutralTone(input.content),
    checkExternalLinks(input.content, 0),

    // 품질 (4) + AI cliché 보너스
    checkKeywordDensity(input.content, primaryKeyword),
    checkSentenceEnding(input.content),
    checkHeadingDepth(input.content),
    checkTableOrList(input.content),
    checkAICliches(input.content),
  ]

  // 축별 점수 계산 — 축 내 룰들이 pass 비율 × 축 가중치.
  const breakdown = {
    seo: axisScore(rules, 'seo'),
    aeo: axisScore(rules, 'aeo'),
    geo: axisScore(rules, 'geo'),
    sanitation: axisScore(rules, 'sanitation'),
    quality: axisScore(rules, 'quality'),
  }

  // 길이 페널티 — 본문 1,800자 미만은 score 에서 10점 차감 (최대 하한 0).
  const lengthPass = length >= minLength

  let score =
    breakdown.seo.score +
    breakdown.aeo.score +
    breakdown.geo.score +
    breakdown.sanitation.score +
    breakdown.quality.score
  if (!lengthPass) score = Math.max(0, score - 10)
  score = Math.round(score)

  const hardFailures = rules.filter(r => r.severity === 'fail' && !r.pass).map(r => r.id)
  const warnings = rules.filter(r => r.severity === 'warn' && !r.pass).map(r => r.id)

  return {
    score,
    breakdown,
    rulesReport: rules,
    hardFailures,
    warnings,
    lengthCheck: { length, min: minLength, pass: lengthPass },
  }
}

function axisScore(rules: RuleResult[], axis: RuleAxis): { score: number; max: number } {
  const axisRules = rules.filter(r => r.axis === axis)
  const max = AXIS_WEIGHT[axis]
  if (axisRules.length === 0) return { score: max, max }
  const passed = axisRules.filter(r => r.pass).length
  const ratio = passed / axisRules.length
  return { score: Math.round(max * ratio), max }
}

/** 룰 id → 사람이 읽는 축 라벨. 편집기 QualityPanel 섹션 그룹핑용. */
export const AXIS_LABEL: Record<RuleAxis, string> = {
  seo: 'SEO',
  aeo: 'AEO',
  geo: 'GEO',
  sanitation: '환각·위생',
  quality: '품질',
}
