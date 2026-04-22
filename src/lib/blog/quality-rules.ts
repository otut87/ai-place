// T-193 — 결정론 품질 검증 엔진 (16룰).
// SEO(5) + AEO(4) + GEO(3) + 환각·위생(4) + 품질(4) = 20 공식 축, 핵심 16 게이팅 룰.
//
// 각 룰은 { pass, value, severity, message } 반환.
// severity 'fail' → quality-v2 가 hardFailures 로 수집 → writer rewrite 1회 재시도.
// severity 'warn' → 편집기 QualityPanel 경고 배지.

import { validateSevenBlocks } from './template'
import {
  SUPERLATIVES,
  AI_CLICHES,
  NEGATIVE_WORDS,
  getBannedPhrasesForSector,
} from './banned-phrases'

export type Severity = 'fail' | 'warn'
export type RuleAxis = 'seo' | 'aeo' | 'geo' | 'sanitation' | 'quality'

export interface RuleResult {
  id: string
  axis: RuleAxis
  pass: boolean
  severity: Severity
  value?: number | string
  message: string
}

// ==========================================================================
// 공통 유틸 — markdown 전처리
// ==========================================================================

/** 코드 블록(```), 인라인 코드(`), HTML 주석 제거 — 룰 판정에서 제외. */
function stripCode(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
}

/** 마크다운 본문에서 순수 텍스트만 추출 (H2/H3, bold, link 제거). */
function stripMarkdown(markdown: string): string {
  return stripCode(markdown)
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
}

/** 단순 포함 카운트 (겹침 없음, 대소문자 그대로). */
function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count += 1
    idx += needle.length
  }
  return count
}

// ==========================================================================
// SEO 축 (5)
// ==========================================================================

/** R-SEO-01 — Title 길이 30~60자 (Google 검색 결과 잘림 방지). */
export function checkTitleLength(title: string): RuleResult {
  const len = Array.from(title.trim()).length
  const pass = len >= 30 && len <= 60
  return {
    id: 'seo.title_length',
    axis: 'seo',
    pass,
    severity: 'fail',
    value: len,
    message: pass
      ? `제목 ${len}자 (30~60)`
      : `제목 ${len}자 — 30~60자 권장 (Google 잘림 방지)`,
  }
}

/** R-SEO-02 — Meta description(summary) 50~160자.
 *  AI Place 는 summary 한 필드로 Direct Answer Block(40~80) 과 meta description 을 겸한다.
 *  plan 의 130~160 제약은 Direct Answer 와 상호 모순이므로 하한 50 으로 완화 —
 *  Direct Answer(40~80) 과 50~80자 구간에서 양립한다. */
export function checkMetaDescLength(summary: string): RuleResult {
  const len = Array.from(summary.trim()).length
  const pass = len >= 50 && len <= 160
  return {
    id: 'seo.meta_desc_length',
    axis: 'seo',
    pass,
    severity: 'fail',
    value: len,
    message: pass
      ? `메타 설명 ${len}자`
      : `메타 설명 ${len}자 — 50~160자 (Direct Answer 겸용)`,
  }
}

/** R-SEO-03 — 본문 H1 0개 (title 이 유일한 H1). */
export function checkH1Singleton(content: string): RuleResult {
  const h1Count = (stripCode(content).match(/^#\s+/gm) ?? []).length
  const pass = h1Count === 0
  return {
    id: 'seo.h1_singleton',
    axis: 'seo',
    pass,
    severity: 'fail',
    value: h1Count,
    message: pass
      ? '본문 H1 없음'
      : `본문 H1 ${h1Count}개 — 0개 권장 (title 이 유일한 H1)`,
  }
}

/** R-SEO-04 — markdown 내 `![alt](url)` alt 누락 0. */
export function checkImageAltRequired(content: string): RuleResult {
  const matches = Array.from(stripCode(content).matchAll(/!\[([^\]]*)\]\([^)]+\)/g))
  const missing = matches.filter(m => m[1].trim().length === 0).length
  const pass = missing === 0
  return {
    id: 'seo.image_alt_required',
    axis: 'seo',
    pass,
    severity: 'fail',
    value: missing,
    message: pass
      ? '이미지 alt 누락 없음'
      : `이미지 ${missing}개 alt 누락 (접근성·SEO 필수)`,
  }
}

/** R-SEO-05 — slug ASCII-safe (한글/공백 금지). T-190 정규화 이슈 예방. */
export function checkSlugAsciiSafe(slug: string): RuleResult {
  const pass = /^[a-z0-9-]+$/.test(slug)
  return {
    id: 'seo.slug_ascii_safe',
    axis: 'seo',
    pass,
    severity: 'fail',
    value: slug,
    message: pass
      ? 'slug 규격 OK'
      : `slug "${slug}" — 소문자 영문/숫자/하이픈만 허용 (한글 URL 정규화 이슈 회피)`,
  }
}

// ==========================================================================
// AEO 축 (4)
// ==========================================================================

/** R-AEO-01 — Direct Answer Block(summary) 40~80자. */
export function checkDirectAnswerLength(summary: string): RuleResult {
  const len = Array.from(summary.trim()).length
  const pass = len >= 40 && len <= 80
  return {
    id: 'aeo.direct_answer_length',
    axis: 'aeo',
    pass,
    severity: 'fail',
    value: len,
    message: pass
      ? `Direct Answer ${len}자`
      : `Direct Answer ${len}자 — 40~80자 (AI 인용 최적 길이)`,
  }
}

/** R-AEO-02 — FAQ 개수 3~5. */
export function checkFAQCount(faqs: Array<unknown>): RuleResult {
  const n = faqs?.length ?? 0
  const pass = n >= 3 && n <= 5
  return {
    id: 'aeo.faq_count',
    axis: 'aeo',
    pass,
    severity: 'fail',
    value: n,
    message: pass
      ? `FAQ ${n}개`
      : `FAQ ${n}개 — 3~5개 권장`,
  }
}

/** R-AEO-03 — 타깃 키워드 본문 언급 — 0=FAIL, 1-2=WARN, 3+=OK. */
export function checkTargetQueryUsage(content: string, targetQuery: string | null | undefined): RuleResult {
  const q = (targetQuery ?? '').trim()
  if (!q) {
    return {
      id: 'aeo.target_query_usage',
      axis: 'aeo',
      pass: false,
      severity: 'warn',
      value: 0,
      message: '타깃 키워드 미지정',
    }
  }
  const text = stripMarkdown(content)
  const n = countOccurrences(text, q)
  if (n === 0) {
    return {
      id: 'aeo.target_query_usage',
      axis: 'aeo',
      pass: false,
      severity: 'fail',
      value: n,
      message: `타깃 키워드 "${q}" 본문 미등장 — 최소 3회 권장`,
    }
  }
  if (n < 3) {
    return {
      id: 'aeo.target_query_usage',
      axis: 'aeo',
      pass: false,
      severity: 'warn',
      value: n,
      message: `타깃 키워드 ${n}회 — 3회 이상 권장`,
    }
  }
  return {
    id: 'aeo.target_query_usage',
    axis: 'aeo',
    pass: true,
    severity: 'fail',
    value: n,
    message: `타깃 키워드 ${n}회`,
  }
}

/** R-AEO-04 — 7블록 구조 통과. (template.ts validateSevenBlocks 래핑) */
export function checkSevenBlockStructure(content: string, sectorOrCategory?: string): RuleResult {
  const v = validateSevenBlocks(content, sectorOrCategory)
  const pass = v.passed === v.total
  return {
    id: 'aeo.seven_block_structure',
    axis: 'aeo',
    pass,
    severity: 'fail',
    value: `${v.passed}/${v.total}`,
    message: pass
      ? `7블록 완비 (${v.passed}/${v.total})`
      : `7블록 ${v.passed}/${v.total} — 미작성: ${[...v.missing, ...v.short].join(', ') || '-'}`,
  }
}

// ==========================================================================
// GEO 축 (3)
// ==========================================================================

/** R-GEO-01 — 도시명 본문 언급 최소 5회. WARN. */
export function checkCityMention(content: string, cityName: string, min = 5): RuleResult {
  const text = stripMarkdown(content)
  const n = countOccurrences(text, cityName)
  const pass = n >= min
  return {
    id: 'geo.city_mention',
    axis: 'geo',
    pass,
    severity: 'warn',
    value: n,
    message: pass
      ? `"${cityName}" ${n}회 언급`
      : `"${cityName}" ${n}회 — 최소 ${min}회 권장 (지역 SEO)`,
  }
}

/** R-GEO-02 — 업체당 최소 2회 언급 (verified + external 공통). WARN. */
export function checkLocalBusinessMention(
  content: string,
  placeNames: string[],
  minPerPlace = 2,
): RuleResult {
  if (placeNames.length === 0) {
    return {
      id: 'geo.local_business_mention',
      axis: 'geo',
      pass: true,
      severity: 'warn',
      value: 0,
      message: '업체 미지정',
    }
  }
  const text = stripMarkdown(content)
  const insufficient: string[] = []
  for (const name of placeNames) {
    const n = countOccurrences(text, name)
    if (n < minPerPlace) insufficient.push(`${name}(${n})`)
  }
  const pass = insufficient.length === 0
  return {
    id: 'geo.local_business_mention',
    axis: 'geo',
    pass,
    severity: 'warn',
    value: insufficient.length,
    message: pass
      ? `업체별 ${minPerPlace}회 이상 언급 OK`
      : `업체 언급 부족: ${insufficient.join(', ')} (최소 ${minPerPlace}회)`,
  }
}

/** R-GEO-03 — 내부 링크 최소 3개. WARN. */
export function checkInternalLinks(content: string, min = 3): RuleResult {
  const links = Array.from(stripCode(content).matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
  const internal = links.filter(m => {
    const url = m[1].trim()
    if (url.startsWith('/')) return true
    if (url.startsWith('https://aiplace.kr')) return true
    if (url.startsWith('http://aiplace.kr')) return true
    return false
  })
  const pass = internal.length >= min
  return {
    id: 'geo.internal_links',
    axis: 'geo',
    pass,
    severity: 'warn',
    value: internal.length,
    message: pass
      ? `내부 링크 ${internal.length}개`
      : `내부 링크 ${internal.length}개 — 최소 ${min}개 권장`,
  }
}

// ==========================================================================
// 환각·위생 축 (4)
// ==========================================================================

/** R-SAN-01 — 업체명 allowlist 밖 등장 = 환각. FAIL. */
export function checkPlaceNameAllowlist(
  content: string,
  allowedNames: string[],
  candidateForbidden: string[] = [],
): RuleResult {
  if (candidateForbidden.length === 0) {
    return {
      id: 'sanitation.place_name_allowlist',
      axis: 'sanitation',
      pass: true,
      severity: 'fail',
      value: 0,
      message: '환각 후보 미지정 (검사 생략)',
    }
  }
  const allowSet = new Set(allowedNames.map(n => n.trim()).filter(Boolean))
  const text = stripMarkdown(content)
  const found: string[] = []
  for (const name of candidateForbidden) {
    const trimmed = name.trim()
    if (!trimmed) continue
    if (allowSet.has(trimmed)) continue
    if (text.includes(trimmed)) found.push(trimmed)
  }
  const pass = found.length === 0
  return {
    id: 'sanitation.place_name_allowlist',
    axis: 'sanitation',
    pass,
    severity: 'fail',
    value: found.length,
    message: pass
      ? '허용 외 업체명 없음'
      : `허용 외 업체명 등장 (환각 의심): ${found.slice(0, 3).join(', ')}${found.length > 3 ? ' 외' : ''}`,
  }
}

/** R-SAN-02 — 금칙 표현 탐지 (섹터별). FAIL. */
export function checkBannedPhrases(content: string, sector?: string): RuleResult {
  const banned = getBannedPhrasesForSector(sector)
  const text = stripMarkdown(content)
  const hits: string[] = []
  for (const phrase of banned) {
    if (text.includes(phrase)) hits.push(phrase)
  }
  const pass = hits.length === 0
  return {
    id: 'sanitation.banned_phrases',
    axis: 'sanitation',
    pass,
    severity: 'fail',
    value: hits.length,
    message: pass
      ? '금칙 표현 없음'
      : `금칙 표현 ${hits.length}건: ${hits.slice(0, 5).join(', ')}`,
  }
}

/** R-SAN-03 — 중립 서술 검증 (과장 + 비방 동시 탐지). FAIL.
 *  평점/리뷰 제약이 제거됐으므로 writer 에 중립 서술을 강제하고 이 룰로 게이팅.
 */
export function checkNeutralTone(content: string): RuleResult {
  const text = stripMarkdown(content)
  const superlatives = SUPERLATIVES.filter(s => text.includes(s))
  const negatives = NEGATIVE_WORDS.filter(n => text.includes(n))
  const pass = superlatives.length === 0 && negatives.length === 0
  return {
    id: 'sanitation.neutral_tone',
    axis: 'sanitation',
    pass,
    severity: 'fail',
    value: superlatives.length + negatives.length,
    message: pass
      ? '중립 서술 OK'
      : `과장(${superlatives.length}) · 비방(${negatives.length}) 표현 검출: ${[...superlatives, ...negatives].slice(0, 4).join(', ')}`,
  }
}

/** R-SAN-04 — 외부 도메인 링크 0 (aiplace.kr 외부 금지). FAIL. */
export function checkExternalLinks(content: string, maxExternal = 0): RuleResult {
  const links = Array.from(stripCode(content).matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
  const external = links.filter(m => {
    const url = m[1].trim().toLowerCase()
    if (!/^https?:\/\//.test(url)) return false
    if (url.startsWith('https://aiplace.kr')) return false
    if (url.startsWith('http://aiplace.kr')) return false
    return true
  })
  const pass = external.length <= maxExternal
  return {
    id: 'sanitation.external_links',
    axis: 'sanitation',
    pass,
    severity: 'fail',
    value: external.length,
    message: pass
      ? '외부 링크 없음'
      : `외부 링크 ${external.length}개 — 자사 도메인 외 금지`,
  }
}

// ==========================================================================
// 품질 축 (4) — 기존 quality.ts 흡수
// ==========================================================================

/** R-QUAL-01 — 키워드 본문 밀도 5~12회. WARN. */
export function checkKeywordDensity(
  content: string,
  keyword: string | null | undefined,
  min = 5,
  max = 12,
): RuleResult {
  const kw = (keyword ?? '').trim()
  if (!kw) {
    return {
      id: 'quality.keyword_density',
      axis: 'quality',
      pass: true,
      severity: 'warn',
      value: 0,
      message: '키워드 미지정',
    }
  }
  const text = stripMarkdown(content)
  const n = countOccurrences(text, kw)
  const pass = n >= min && n <= max
  return {
    id: 'quality.keyword_density',
    axis: 'quality',
    pass,
    severity: 'warn',
    value: n,
    message: pass
      ? `키워드 "${kw}" ${n}회`
      : `키워드 "${kw}" ${n}회 — ${min}~${max}회 권장`,
  }
}

/** R-QUAL-02 — 문장 끝 반복(같은 어미 3연속 이상). WARN. */
export function checkSentenceEnding(content: string, maxRepeat = 2): RuleResult {
  const text = stripMarkdown(content)
  const sentences = text
    .split(/[.!?。\n]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
  const endings = sentences.map(s => s.slice(-3))
  let maxSeen = 1
  let currRun = 1
  for (let i = 1; i < endings.length; i += 1) {
    if (endings[i] && endings[i] === endings[i - 1]) {
      currRun += 1
      if (currRun > maxSeen) maxSeen = currRun
    } else {
      currRun = 1
    }
  }
  const pass = maxSeen <= maxRepeat
  return {
    id: 'quality.sentence_ending',
    axis: 'quality',
    pass,
    severity: 'warn',
    value: maxSeen,
    message: pass
      ? `문장 끝 반복 ${maxSeen}연속`
      : `문장 끝 ${maxSeen}연속 반복 — ${maxRepeat}회 이하 권장`,
  }
}

/** R-QUAL-03 — H2 4개 이상 + H3 2개 이상. WARN. */
export function checkHeadingDepth(content: string): RuleResult {
  const body = stripCode(content)
  const h2 = (body.match(/^##\s+/gm) ?? []).length
  const h3 = (body.match(/^###\s+/gm) ?? []).length
  const pass = h2 >= 4 && h3 >= 2
  return {
    id: 'quality.heading_depth',
    axis: 'quality',
    pass,
    severity: 'warn',
    value: `H2:${h2}/H3:${h3}`,
    message: pass
      ? `H2 ${h2}, H3 ${h3}`
      : `H2 ${h2}, H3 ${h3} — H2 4+, H3 2+ 권장`,
  }
}

/** R-QUAL-04 — 비교표 또는 체크리스트 존재. WARN. */
export function checkTableOrList(content: string): RuleResult {
  const body = stripCode(content)
  const hasTable = /^\s*\|.*\|/m.test(body)
  const hasList = /^\s*[-*]\s+/m.test(body)
  const pass = hasTable || hasList
  return {
    id: 'quality.table_or_list',
    axis: 'quality',
    pass,
    severity: 'warn',
    value: hasTable ? 'table' : hasList ? 'list' : 'none',
    message: pass
      ? `구조 요소 ${hasTable ? '표' : '리스트'} 존재`
      : '비교표 또는 체크리스트 필요',
  }
}

// ==========================================================================
// 보너스 — AI cliché 탐지 (WARN, 점수 계산에는 포함)
// ==========================================================================

/** AI cliché 과다 탐지 (4개 이상 = WARN). */
export function checkAICliches(content: string, maxHits = 3): RuleResult {
  const text = stripMarkdown(content)
  const hits = AI_CLICHES.filter(c => text.includes(c))
  const pass = hits.length <= maxHits
  return {
    id: 'quality.ai_cliches',
    axis: 'quality',
    pass,
    severity: 'warn',
    value: hits.length,
    message: pass
      ? `상투어 ${hits.length}건`
      : `AI 상투어 ${hits.length}건 탐지: ${hits.join(', ')}`,
  }
}
