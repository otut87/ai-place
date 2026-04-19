// T-142 — 월간 리포트 빌더·렌더러 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildMonthlyReportData, renderMonthlyReportHtml } from '@/lib/diagnostic/monthly-report'

vi.mock('@/lib/diagnostic/scan-site', () => ({
  scanSite: vi.fn().mockResolvedValue({
    url: 'https://aiplace.kr/cheonan/medical/x',
    fetchedAt: 't',
    score: 72,
    checks: [
      { id: 'jsonld_localbusiness', label: 'JSON-LD', category: 'geo', status: 'pass', points: 20, maxPoints: 20 },
      { id: 'faq_schema', label: 'FAQ', category: 'geo', status: 'fail', points: 0, maxPoints: 15, detail: 'FAQ 없음' },
      { id: 'review_schema', label: 'Review', category: 'geo', status: 'warn', points: 2, maxPoints: 5, detail: '부분' },
      { id: 'direct_answer_block', label: 'DAB', category: 'aeo', status: 'fail', points: 0, maxPoints: 10, detail: 'H2 없음' },
      { id: 'title', label: '제목', category: 'seo', status: 'pass', points: 5, maxPoints: 5 },
    ],
  }),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

const samplePlace = { id: 'p1', name: '닥터스킨', slug: 'dr-skin', city: 'cheonan', category: 'medical' }

describe('buildMonthlyReportData', () => {
  it('publicUrl/점수/버킷/상위 이슈 3건 반환', async () => {
    const data = await buildMonthlyReportData(samplePlace, {
      getBotVisits: async () => ({ total: 123, uniqueBots: 4 }),
      getLatestCitation: async () => ({ rate: 0.33, at: '2026-04-01T00:00:00Z' }),
      period: new Date('2026-04-15'),
    })
    expect(data.publicUrl).toBe('https://aiplace.kr/cheonan/medical/dr-skin')
    expect(data.score).toBe(72)
    expect(data.botVisits30d).toBe(123)
    expect(data.citationRate).toBe(0.33)
    expect(data.periodLabel).toBe('2026년 4월')
    // 상위 이슈는 (maxPoints-points) 내림차순 — FAQ(-15) > DAB(-10) > Review(-3)
    expect(data.topIssues).toHaveLength(3)
    expect(data.topIssues[0].label).toBe('FAQ')
    expect(data.topIssues[1].label).toBe('DAB')
  })

  it('citation 없음 → null', async () => {
    const data = await buildMonthlyReportData(samplePlace, {
      getBotVisits: async () => ({ total: 0, uniqueBots: 0 }),
      getLatestCitation: async () => null,
    })
    expect(data.citationRate).toBeNull()
    expect(data.citationLastRun).toBeNull()
  })

  it('period 생략 시 현재 월 사용', async () => {
    const data = await buildMonthlyReportData(samplePlace, {
      getBotVisits: async () => ({ total: 0, uniqueBots: 0 }),
      getLatestCitation: async () => null,
    })
    const now = new Date()
    expect(data.periodLabel).toBe(`${now.getFullYear()}년 ${now.getMonth() + 1}월`)
  })
})

describe('renderMonthlyReportHtml', () => {
  const baseData = {
    placeId: 'p1', placeName: '닥터스킨 <주식회사>', publicUrl: 'https://aiplace.kr/cheonan/medical/dr-skin',
    score: 72, scoreBucket: '보통',
    bench: { registered: 91, unregistered: 58 },
    botVisits30d: 10, botBots30d: 3,
    citationRate: 0.5, citationLastRun: '2026-04-01T00:00:00Z',
    periodLabel: '2026년 4월',
    topIssues: [{ label: 'FAQ', detail: 'FAQ 없음' }],
  }

  it('HTML 핵심 필드 포함', () => {
    const html = renderMonthlyReportHtml(baseData)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('72')
    expect(html).toContain('2026년 4월')
    expect(html).toContain('/owner/places/p1/dashboard')
  })

  it('HTML 특수문자 이스케이프', () => {
    const html = renderMonthlyReportHtml(baseData)
    expect(html).toContain('&lt;주식회사&gt;')
    expect(html).not.toContain('<주식회사>')
  })

  it('topIssues 빈 경우 → 완료 문구', () => {
    const html = renderMonthlyReportHtml({ ...baseData, topIssues: [] })
    expect(html).toContain('주요 항목이 없습니다')
  })

  it('citationRate null → 미실행 안내', () => {
    const html = renderMonthlyReportHtml({ ...baseData, citationRate: null, citationLastRun: null })
    expect(html).toContain('아직 실행되지 않았습니다')
  })

  it('citationRate 숫자 → 퍼센트 표기', () => {
    const html = renderMonthlyReportHtml({ ...baseData, citationRate: 0.337 })
    expect(html).toContain('34%')
  })
})
