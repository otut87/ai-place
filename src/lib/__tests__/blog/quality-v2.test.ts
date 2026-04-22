// T-193 — quality-v2 통합 테스트.
import { describe, it, expect } from 'vitest'
import { scoreBlogPostV2 } from '@/lib/blog/quality-v2'

const GOOD_CONTENT = `
## 결론

천안 피부과 중 여드름 치료 전문 3곳을 추천합니다. 평균 평점 4.7 이상, 전문의 2인 이상 기준 선정입니다.

## 분석 방법

천안 피부과 23곳의 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간은 2026년 1월~4월이며 가중치는 리뷰:평점:전문의 = 3:2:1 입니다.

## 업체별 상세

### A 피부과

A 피부과는 천안 동남구 소재 전문의 2인 운영 의원입니다. 리뷰 수 120건 평점 4.8점 기준입니다. 상담 시간 평균 15분, 주차장 완비, 진료시간 오전 9시부터 오후 7시까지. [A 피부과 상세](/cheonan/dermatology/a-clinic)

### B 피부과

B 피부과는 천안 서북구 소재 전문의 1인 운영 의원입니다. 리뷰 95건 평점 4.7점 기록. 레이저 장비 다수 보유. 야간 진료 가능합니다. [B 피부과 상세](/cheonan/dermatology/b-clinic)

## 비교표

| 업체 | 전문의 | 리뷰 | 평점 |
|---|---|---|---|
| A 피부과 | 2인 | 120건 | 4.8 |
| B 피부과 | 1인 | 95건 | 4.7 |

## 체크리스트

- 전문의 자격 확인 (HIRA 검색)
- 상담 시간 15분 이상 보장
- 부작용 상담 프로세스 공개
- 가격표 사전 제시 여부
- 응급 연락망 안내
- 재진 주기 설명

## 위험 신호

- 전문의 자격이 불확실하거나 원장만 있는 경우
- 1회 방문 후 고가의 장기 결제 패키지 유도
- 부작용 설명 생략하거나 서면 동의서 없이 시술
- 가격 비공개 또는 상담 시점 구두 안내

## 자주 묻는 질문

**Q. 여드름 치료는 몇 회 받나요?** A. 8~12주 주기 4~6회입니다.
**Q. 건보 적용되나요?** A. 일부 적용됩니다. 상담 필요.
**Q. 흉터 치료도 가능한가요?** A. 천안 피부과 대부분 가능합니다.

[/about/methodology](/about/methodology) 참고.

**면책**: 본 글은 공개 데이터 기반이며 의료 진단이 아닙니다. 치료 효과는 개인차가 있습니다.
`.trim()

// 본문 길이 1,800 자 확보용 패딩
const PADDING = '\n\n'.concat('추가 본문 내용. 객관적 사실 서술. 천안 지역 기반. '.repeat(60))

const BASE_INPUT = {
  title: '천안 피부과 추천 3곳 — 여드름 치료 리뷰 412건 분석',
  // Direct Answer(40~80) + Meta(50~160) 동시 만족 구간 — 60자
  summary: '천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 평점 4.7점 이상 기준.',
  content: GOOD_CONTENT + PADDING,
  slug: 'cheonan-dermatology-acne-top3',
  tags: ['천안 피부과', '여드름'],
  targetQuery: '천안 피부과',
  faqs: [
    { question: 'Q1', answer: 'A1' },
    { question: 'Q2', answer: 'A2' },
    { question: 'Q3', answer: 'A3' },
  ],
  categoryOrSector: 'medical',
  cityName: '천안',
  allowedPlaceNames: ['A 피부과', 'B 피부과'],
  forbiddenPlaceNames: [],
}

describe('scoreBlogPostV2', () => {
  it('건강한 입력은 높은 점수 + hardFailures 없음', () => {
    const r = scoreBlogPostV2(BASE_INPUT)
    expect(r.hardFailures).toEqual([])
    expect(r.score).toBeGreaterThanOrEqual(85)
    expect(r.lengthCheck.pass).toBe(true)
  })

  it('금칙 표현이 있으면 hardFailure 에 수집', () => {
    const r = scoreBlogPostV2({
      ...BASE_INPUT,
      content: BASE_INPUT.content + '\n\n완치를 보장합니다.',
    })
    expect(r.hardFailures).toContain('sanitation.banned_phrases')
  })

  it('환각(외부 업체) 탐지', () => {
    const r = scoreBlogPostV2({
      ...BASE_INPUT,
      content: BASE_INPUT.content + '\n\n경쟁 피부과도 유명합니다.',
      forbiddenPlaceNames: ['경쟁 피부과'],
    })
    expect(r.hardFailures).toContain('sanitation.place_name_allowlist')
  })

  it('본문 1,800자 미만은 10점 페널티', () => {
    const shortInput = {
      ...BASE_INPUT,
      content: GOOD_CONTENT, // 패딩 제거
    }
    const full = scoreBlogPostV2(BASE_INPUT)
    const short = scoreBlogPostV2(shortInput)
    expect(short.lengthCheck.pass).toBe(false)
    expect(short.score).toBeLessThanOrEqual(full.score - 10)
  })

  it('외부 링크 탐지 FAIL', () => {
    const r = scoreBlogPostV2({
      ...BASE_INPUT,
      content: BASE_INPUT.content + '\n\n[참고](https://external-site.com)',
    })
    expect(r.hardFailures).toContain('sanitation.external_links')
  })

  it('한글 slug FAIL', () => {
    const r = scoreBlogPostV2({ ...BASE_INPUT, slug: '천안-피부과' })
    expect(r.hardFailures).toContain('seo.slug_ascii_safe')
  })

  it('breakdown 합이 대체로 score 와 일치', () => {
    const r = scoreBlogPostV2(BASE_INPUT)
    const sum =
      r.breakdown.seo.score +
      r.breakdown.aeo.score +
      r.breakdown.geo.score +
      r.breakdown.sanitation.score +
      r.breakdown.quality.score
    // lengthCheck.pass=true 이므로 sum 과 score 는 반올림 오차만 다름
    expect(Math.abs(sum - r.score)).toBeLessThanOrEqual(1)
  })

  it('warnings 와 hardFailures 는 서로 배타적', () => {
    const r = scoreBlogPostV2(BASE_INPUT)
    for (const id of r.hardFailures) {
      expect(r.warnings).not.toContain(id)
    }
  })
})
