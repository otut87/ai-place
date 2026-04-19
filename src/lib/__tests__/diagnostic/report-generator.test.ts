// T-163·T-166 — 리포트 생성기·우선순위 매트릭스 테스트.
import { describe, it, expect } from 'vitest'
import { generateMarkdownReport, buildPriorityMatrix } from '@/lib/diagnostic/report-generator'
import type { CheckResult, ScanResult } from '@/lib/diagnostic/scan-site'

function ck(id: string, status: 'pass' | 'warn' | 'fail', points: number, maxPoints: number): CheckResult {
  return {
    id: id as CheckResult['id'], label: id, category: 'geo',
    status, points, maxPoints,
  }
}

const sampleResult: ScanResult = {
  url: 'https://example.com/',
  fetchedAt: '2026-04-19T00:00:00Z',
  score: 60,
  pagesScanned: 8,
  sitemapPresent: true,
  checks: [
    ck('jsonld_localbusiness', 'pass', 18, 18),
    ck('faq_schema', 'fail', 0, 12),
    ck('sameas_entity_linking', 'fail', 0, 5),
    ck('title', 'pass', 5, 5),
    ck('sitemap', 'pass', 7, 7),
    ck('llms_txt', 'warn', 0, 1),
  ],
}

describe('buildPriorityMatrix', () => {
  it('pass 항목은 제외', () => {
    const m = buildPriorityMatrix(sampleResult.checks)
    expect(m.every(p => p.check.status !== 'pass')).toBe(true)
  })

  it('ROI 내림차순 정렬', () => {
    const m = buildPriorityMatrix(sampleResult.checks)
    for (let i = 0; i + 1 < m.length; i++) {
      expect(m[i].roi).toBeGreaterThanOrEqual(m[i + 1].roi)
    }
  })

  it('FAQ (영향 12, 난이도 2) → quick_win', () => {
    const m = buildPriorityMatrix(sampleResult.checks)
    const faq = m.find(p => p.check.id === 'faq_schema')!
    expect(faq.quadrant).toBe('quick_win')
  })

  it('llms_txt (영향 1, 난이도 1) → fill_in', () => {
    const m = buildPriorityMatrix(sampleResult.checks)
    const l = m.find(p => p.check.id === 'llms_txt')!
    expect(l.quadrant).toBe('fill_in')
  })
})

describe('generateMarkdownReport', () => {
  it('헤더·스캔 범위·점수 포함', () => {
    const md = generateMarkdownReport(sampleResult, { clientName: '천안 카페' })
    expect(md).toContain('천안 카페')
    expect(md).toContain('60/100')
    expect(md).toContain('8개 고유 경로')
  })

  it('우선순위 매트릭스 섹션 + 이슈 상세', () => {
    const md = generateMarkdownReport(sampleResult)
    expect(md).toContain('## 2. 우선순위 매트릭스')
    expect(md).toContain('## 3. 이슈 상세')
    expect(md).toContain('```') // 코드 블록
  })

  it('통과 항목 섹션에 pass 체크 포함', () => {
    const md = generateMarkdownReport(sampleResult)
    expect(md).toContain('jsonld_localbusiness')
    expect(md).toContain('✅')
  })

  it('baseline 있으면 변화 표시', () => {
    const md = generateMarkdownReport(sampleResult, { baseline: { score: 40, date: '2026-04-01' } })
    expect(md).toContain('↑')
    expect(md).toContain('+20')
  })

  it('체크리스트 섹션 포함', () => {
    const md = generateMarkdownReport(sampleResult)
    expect(md).toContain('## 5. 작업 체크리스트')
    expect(md).toContain('- [ ]')
  })

  it('사이트맵 없으면 경고 문구', () => {
    const md = generateMarkdownReport({ ...sampleResult, sitemapPresent: false })
    expect(md).toContain('사이트맵 없음')
  })
})
