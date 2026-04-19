// T-163·T-166 — 진단 결과 → Markdown 리포트 + 우선순위 매트릭스.

import type { ScanResult, CheckResult, CheckId } from './scan-site'
import { generateFixSnippet } from './fix-snippets'
import { getImpactNote } from './impact-notes'
import { getBenchmark, scoreBucket } from './benchmark'

// 난이도: 1(쉬움) ~ 5(어려움) — 우선순위 매트릭스용.
const DIFFICULTY: Record<CheckId, number> = {
  jsonld_localbusiness: 3,
  robots_ai_allow: 1,
  faq_schema: 2,
  review_schema: 2,
  breadcrumb_schema: 2,
  direct_answer_block: 4,         // 본문 재작성 필요
  sameas_entity_linking: 1,
  last_updated: 1,
  time_markup: 1,
  author_person_schema: 2,
  title: 1,
  meta_description: 1,
  sitemap: 2,
  llms_txt: 1,
  https: 3,                         // 호스팅 세팅
  viewport: 1,
}

export interface PriorityItem {
  check: CheckResult
  impact: number              // maxPoints - points (0~20)
  difficulty: number          // 1~5
  roi: number                  // impact / difficulty (높을수록 우선)
  quadrant: 'quick_win' | 'big_effort' | 'minor' | 'fill_in'
}

export function buildPriorityMatrix(checks: CheckResult[]): PriorityItem[] {
  return checks
    .filter(c => c.status !== 'pass')
    .map(c => {
      const impact = c.maxPoints - c.points
      const difficulty = DIFFICULTY[c.id]
      const roi = impact / difficulty
      const highImpact = impact >= 5
      const lowDifficulty = difficulty <= 2
      const quadrant: PriorityItem['quadrant'] =
        highImpact && lowDifficulty ? 'quick_win' :
        highImpact && !lowDifficulty ? 'big_effort' :
        !highImpact && lowDifficulty ? 'fill_in' :
        'minor'
      return { check: c, impact, difficulty, roi, quadrant }
    })
    .sort((a, b) => b.roi - a.roi)
}

export interface ReportOptions {
  title?: string
  clientName?: string
  auditor?: string
  /** 이전 진단 대비 비교 정보 (Before/After 증명) */
  baseline?: { score: number; date: string }
}

export function generateMarkdownReport(result: ScanResult, opts: ReportOptions = {}): string {
  const lines: string[] = []
  const title = opts.title ?? `AI 검색 최적화 진단 리포트`
  const bucket = scoreBucket(result.score)
  const bench = getBenchmark()
  const now = new Date(result.fetchedAt).toLocaleString('ko-KR')

  // 헤더
  lines.push(`# ${title}`)
  lines.push('')
  if (opts.clientName) lines.push(`**클라이언트:** ${opts.clientName}`)
  lines.push(`**진단 대상:** ${result.url}`)
  lines.push(`**진단 일시:** ${now}`)
  lines.push(`**진단자:** ${opts.auditor ?? 'AI Place RC'}`)
  lines.push(`**스캔 범위:** ${result.pagesScanned}개 고유 경로${result.sitemapPresent ? ' (사이트맵 기반)' : ' (홈페이지 단독 — 사이트맵 없음)'}`)
  lines.push('')

  // 요약
  lines.push('## 1. 종합 점수')
  lines.push('')
  lines.push(`| 항목 | 값 |`)
  lines.push(`| --- | --- |`)
  lines.push(`| **AI 가독성 점수** | **${result.score}/100** (${bucket.label}) |`)
  lines.push(`| AI Place 등록 업체 평균 | ${bench.registered} |`)
  lines.push(`| 일반 업체 평균 | ${bench.unregistered} |`)
  if (opts.baseline) {
    const delta = result.score - opts.baseline.score
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '='
    lines.push(`| 초기 점수 (${opts.baseline.date}) | ${opts.baseline.score} |`)
    lines.push(`| **변화** | ${arrow} ${delta >= 0 ? '+' : ''}${delta} |`)
  }
  lines.push('')

  // 우선순위 매트릭스
  const priority = buildPriorityMatrix(result.checks)
  if (priority.length > 0) {
    lines.push('## 2. 우선순위 매트릭스')
    lines.push('')
    lines.push('**Quick Win (높은 효과 · 낮은 난이도)** 부터 순차 진행 권장.')
    lines.push('')
    lines.push(`| 순위 | 항목 | 영향도 | 난이도 | ROI | 분류 |`)
    lines.push(`| --- | --- | --- | --- | --- | --- |`)
    priority.slice(0, 10).forEach((p, i) => {
      const label = p.quadrant === 'quick_win' ? '🟢 Quick Win'
        : p.quadrant === 'big_effort' ? '🟡 Big Effort'
        : p.quadrant === 'fill_in' ? '⚪ Fill-in' : '⚫ Minor'
      lines.push(`| ${i + 1} | ${p.check.label} | ${p.impact}점 | ${p.difficulty}/5 | ${p.roi.toFixed(1)} | ${label} |`)
    })
    lines.push('')
  }

  // 이슈 상세
  lines.push('## 3. 이슈 상세 (수정 코드 포함)')
  lines.push('')
  priority.forEach((p, i) => {
    const c = p.check
    lines.push(`### ${i + 1}. ${c.label} (-${p.impact}점)`)
    lines.push('')
    lines.push(`**현재 상태:** ${c.status === 'fail' ? '❌ 실패' : '⚠ 부분'} (${c.points}/${c.maxPoints}점)`)
    if (c.detail) lines.push(`**세부 사항:** ${c.detail}`)
    const impact = getImpactNote(c.id)
    if (impact) {
      lines.push(`**예상 효과:** ${impact.expectedEffect}`)
      lines.push(`**근거:** ${impact.source}`)
    }
    const snip = generateFixSnippet(c)
    if (snip) {
      lines.push('')
      lines.push(`**수정 방법 (${snip.placement}):**`)
      if (snip.note) lines.push(`> ${snip.note}`)
      lines.push('')
      lines.push('```' + snip.lang)
      lines.push(snip.code)
      lines.push('```')
    }
    lines.push('')
  })

  // 통과 항목
  const passed = result.checks.filter(c => c.status === 'pass')
  if (passed.length > 0) {
    lines.push('## 4. 통과 항목')
    lines.push('')
    passed.forEach(c => {
      lines.push(`- ✅ **${c.label}** (${c.points}점)${c.detail ? ` — ${c.detail}` : ''}`)
    })
    lines.push('')
  }

  // 체크리스트
  if (priority.length > 0) {
    lines.push('## 5. 작업 체크리스트')
    lines.push('')
    priority.forEach(p => {
      lines.push(`- [ ] ${p.check.label} (${p.impact}점 복구 예상)`)
    })
    lines.push('')
  }

  // 푸터
  lines.push('---')
  lines.push('')
  lines.push('*진단 방법론: [AI Place](https://aiplace.kr/about/methodology) · GEO-SEO-AEO 딥리서치 기반*')
  lines.push(`*리포트 생성: ${new Date().toLocaleString('ko-KR')}*`)

  return lines.join('\n')
}
