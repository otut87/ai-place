/**
 * Phase 11 — PlaceReviewSummary
 * 소스별 요약 카드 렌더 — 데이터 없으면 null, 있으면 테마 + 인용 + 날짜.
 */
import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlaceReviewSummary } from '@/components/business/place-review-summary'
import type { ReviewSummary } from '@/lib/types'

function render(props: React.ComponentProps<typeof PlaceReviewSummary>) {
  return renderToStaticMarkup(createElement(PlaceReviewSummary, props))
}

const baseGoogle: ReviewSummary = {
  source: 'Google',
  positiveThemes: ['친절한 설명', '깔끔한 시설'],
  negativeThemes: ['주차 협소'],
  sampleQuote: '상담 시간이 길고 설명이 자세하다는 평이 반복됩니다.',
  lastChecked: '2026-04-19',
}

describe('PlaceReviewSummary', () => {
  it('요약 배열이 비어있으면 null 반환', () => {
    const html = render({ summaries: [], businessName: '수피부과' })
    expect(html).toBe('')
  })

  it('모든 필드가 비어있는 요약만 있으면 null', () => {
    const empty: ReviewSummary = {
      source: 'Google',
      positiveThemes: [],
      negativeThemes: [],
      lastChecked: '2026-04-19',
    }
    const html = render({ summaries: [empty], businessName: '수피부과' })
    expect(html).toBe('')
  })

  it('Google 요약 1건 있으면 카드 렌더', () => {
    const html = render({ summaries: [baseGoogle], businessName: '수피부과' })
    expect(html).toContain('Google 리뷰 요약')
    expect(html).toContain('친절한 설명')
    expect(html).toContain('주차 협소')
    expect(html).toContain('상담 시간이 길고')
    expect(html).toContain('2026-04-19')
    expect(html).toContain('수피부과')
  })

  it('여러 소스 요약을 모두 렌더 (각각 섹션)', () => {
    const naver: ReviewSummary = {
      source: 'Naver',
      positiveThemes: ['가격 합리적'],
      negativeThemes: [],
      lastChecked: '2026-04-15',
    }
    const html = render({ summaries: [baseGoogle, naver], businessName: '수피부과' })
    expect(html).toContain('Google 리뷰 요약')
    expect(html).toContain('Naver 리뷰 요약')
  })

  it('부정 테마만 있고 긍정 테마 비어있어도 렌더', () => {
    const onlyNeg: ReviewSummary = {
      source: 'Kakao',
      positiveThemes: [],
      negativeThemes: ['웨이팅 김'],
      lastChecked: '2026-04-19',
    }
    const html = render({ summaries: [onlyNeg], businessName: 'X' })
    expect(html).toContain('Kakao')
    expect(html).toContain('웨이팅 김')
  })

  it('lastChecked 를 <time dateTime> 으로 렌더 (구조화 데이터)', () => {
    const html = render({ summaries: [baseGoogle], businessName: 'X' })
    // React SSR 은 camelCase 속성을 그대로 출력 (dateTime="...")
    expect(html).toMatch(/<time\s+dateTime="2026-04-19"/)
  })

  it('원문이 아닌 요약임을 명시하는 고지 포함 (ToS 안전장치)', () => {
    const html = render({ summaries: [baseGoogle], businessName: 'X' })
    expect(html).toMatch(/원문 그대로의 인용이 아닙니다/)
  })
})
