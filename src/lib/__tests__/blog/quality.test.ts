// T-111 / T-027 — 블로그 품질 스코어 테스트.
import { describe, it, expect } from 'vitest'
import { scoreBlogPost } from '@/lib/blog/quality'

const FULL_POST = {
  title: '천안 피부과 추천 3곳 — 리뷰 412건 분석',
  summary: '천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 4.7점.',
  categoryOrSector: 'medical',
  content: `
## 결론

천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 평점 4.7점 이상, 전문의 상주 기준입니다.

## 분석 방법

천안 피부과 23곳의 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간은 2026년 1월~4월.

## 업체별 상세

### A 피부과

전문의 2인, 여드름 클리닉 운영. 리뷰 수 120건, 평점 4.8. 상담 시간이 평균 15분으로 충분합니다. 주차장 완비. 진료 시간 오전 9시부터 오후 7시까지입니다.

### B 피부과

전문의 1인. 레이저 장비 보유. 리뷰 수 95건, 평점 4.7. 야간 진료 가능. 모공·흉터 관리 특화. 대중 교통 접근성 우수. 주말 오후 진료.

## 비교표

| 업체 | 전문의 | 리뷰 | 평점 |
|---|---|---|---|
| A | 2인 | 120건 | 4.8 |
| B | 1인 | 95건 | 4.7 |

## 체크리스트

- 전문의 자격 확인 (HIRA 검색)
- 상담 시간 15분 이상 보장 여부
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

**Q. 여드름 치료는 보통 몇 회 받나요?**
A. 일반적으로 8~12주 주기로 4~6회 내외입니다. 개인차가 있어 상담 필수입니다.

**면책**: 본 글은 공개 데이터 기반 자체 조사이며 의료 진단이 아닙니다. 치료 효과는 개인에 따라 다를 수 있습니다.
`,
}

describe('scoreBlogPost', () => {
  it('7블록 완비 + 표 + 체크리스트면 90점 이상', () => {
    const r = scoreBlogPost(FULL_POST)
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.breakdown.sevenBlocks).toBeGreaterThanOrEqual(32)
  })

  it('빈 본문은 50점 이하', () => {
    const r = scoreBlogPost({ ...FULL_POST, content: '' })
    expect(r.score).toBeLessThanOrEqual(50)
    expect(r.suggestions.length).toBeGreaterThan(0)
  })

  it('summary 길이 부족 시 감점', () => {
    const r = scoreBlogPost({ ...FULL_POST, summary: '짧은 요약' })
    expect(r.breakdown.summaryLength).toBe(0)
  })
})
