// T-111 / T-027 연계 — 블로그 글 품질 스코어.
// 7블록 통과율을 핵심 지표로.

import { validateSevenBlocks } from './template'

export interface BlogQualityInput {
  title: string
  summary: string         // Direct Answer Block (40~60자)
  content: string         // Markdown
  categoryOrSector?: string
}

export interface BlogQualityResult {
  score: number                // 0~100
  breakdown: {
    sevenBlocks: number        // 40점 만점 (통과율 × 40)
    summaryLength: number      // 20점 (40~60자)
    headingDepth: number       // 20점 (H2 4개 이상 + H3 2개 이상)
    tableOrList: number        // 20점 (비교표 혹은 체크리스트 존재)
  }
  suggestions: string[]
}

export function scoreBlogPost(input: BlogQualityInput): BlogQualityResult {
  const suggestions: string[] = []

  const sev = validateSevenBlocks(input.content, input.categoryOrSector)
  const sevenBlocks = Math.round(sev.passRate * 40)
  if (sev.missing.length > 0) {
    suggestions.push(`미작성 블록: ${sev.missing.join(', ')}`)
  }
  if (sev.short.length > 0) {
    suggestions.push(`본문 부족 블록: ${sev.short.join(', ')}`)
  }

  const sLen = input.summary.length
  let summaryLength = 0
  if (sLen >= 40 && sLen <= 60) summaryLength = 20
  else if (sLen >= 35 && sLen <= 70) summaryLength = 12
  else if (sLen >= 30 && sLen <= 80) summaryLength = 6
  else suggestions.push(`Summary 길이 ${sLen}자 (권장 40~60)`)

  const h2Count = (input.content.match(/^##\s/gm) ?? []).length
  const h3Count = (input.content.match(/^###\s/gm) ?? []).length
  let headingDepth = 0
  if (h2Count >= 4) headingDepth += 12
  if (h3Count >= 2) headingDepth += 8
  if (headingDepth < 20) suggestions.push(`H2 ${h2Count}개 · H3 ${h3Count}개 (권장 H2 4+, H3 2+)`)

  const hasTable = /\|.*\|/.test(input.content)
  const hasList = /^\s*[-*]\s/m.test(input.content)
  let tableOrList = 0
  if (hasTable) tableOrList += 12
  if (hasList) tableOrList += 8
  if (tableOrList < 20) suggestions.push('비교표 또는 체크리스트 필수')

  const score = sevenBlocks + summaryLength + headingDepth + tableOrList
  return { score, breakdown: { sevenBlocks, summaryLength, headingDepth, tableOrList }, suggestions }
}
