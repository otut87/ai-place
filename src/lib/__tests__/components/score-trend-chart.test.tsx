// T-162 — 점수 추이 차트 렌더링 로직 테스트 (JSX → 문자열 검증).
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ScoreTrendChart } from '@/components/diagnostic/score-trend-chart'

// React SSR 는 동적 텍스트 사이에 <!-- --> 주석을 삽입하므로 비교 전 제거.
const clean = (html: string) => html.replace(/<!-- -->/g, '')

describe('ScoreTrendChart', () => {
  it('빈 데이터 → 안내 문구', () => {
    const html = clean(renderToString(<ScoreTrendChart points={[]} />))
    expect(html).toContain('진단 이력이 없습니다')
  })

  it('데이터 있음 → SVG 라인 + delta 라벨', () => {
    const html = clean(renderToString(<ScoreTrendChart points={[
      { score: 60, date: '2026-04-01T00:00:00Z' },
      { score: 75, date: '2026-04-10T00:00:00Z' },
      { score: 91, date: '2026-04-19T00:00:00Z' },
    ]} />))
    expect(html).toContain('<svg')
    expect(html).toContain('+31')           // delta: 91 - 60
    expect(html).toContain('60 → 91')
  })

  it('benchmarkScore → 평균선 텍스트', () => {
    const html = clean(renderToString(<ScoreTrendChart points={[
      { score: 70, date: '2026-04-01' },
    ]} benchmarkScore={91} />))
    expect(html).toContain('평균 91')
  })

  it('단일 포인트 → delta 라벨 생략', () => {
    const html = clean(renderToString(<ScoreTrendChart points={[
      { score: 50, date: '2026-04-01' },
    ]} />))
    expect(html).not.toContain('→')
  })
})
