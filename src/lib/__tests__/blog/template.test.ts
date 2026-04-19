// T-111 — 블로그 본문 7블록 템플릿 테스트.
import { describe, it, expect } from 'vitest'
import {
  getSevenBlockTemplate,
  validateSevenBlocks,
  getBlockChecklist,
} from '@/lib/blog/template'

const FULL_MARKDOWN = `
## 결론

천안에서 여드름 치료로 만족도가 높은 피부과 3곳을 추천합니다. 평균 평점 4.7점 이상, 전문의 상주 기준입니다.

## 분석 방법

천안 피부과 23곳의 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간은 2026년 1월~4월.

## 업체별 상세

### A 피부과

전문의 2인, 여드름 클리닉 운영. 리뷰 수 120건, 평점 4.8. 상담 시간이 평균 15분으로 충분합니다. 주차장 완비. 진료 시간 오전 9시부터 오후 7시까지입니다.

### B 피부과

전문의 1인. 레이저 장비 보유. 리뷰 수 95건, 평점 4.7. 야간 진료 가능. 모공·흉터 관리 특화. 대중 교통 접근성 우수. 주말 오후 진료.

### C 피부과

전문의 3인. 여드름·흉터 전문 클리닉. 리뷰 수 150건, 평점 4.9. 상담 예약 필수이며 초진은 평균 30분 소요. 환자 재방문율 75% 이상으로 높은 수준입니다.

## 비교표

| 업체 | 전문의 | 리뷰 | 평점 |
|---|---|---|---|
| A | 2인 | 120건 | 4.8 |
| B | 1인 | 95건 | 4.7 |
| C | 3인 | 150건 | 4.9 |

세 곳 모두 전문의 상주이며 리뷰 수 90건 이상입니다.

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
- 가격 비공개 또는 상담 시점에 구두로만 안내
- 시술 후 재진 스케줄이 모호한 경우

## 자주 묻는 질문

**Q. 여드름 치료는 보통 몇 회 받나요?**
A. 일반적으로 8~12주 주기로 4~6회 내외입니다. 개인차가 있어 상담 필수입니다.

**면책**: 본 글은 공개 데이터 기반 자체 조사이며 의료 진단이 아닙니다. 치료 효과는 개인에 따라 다를 수 있습니다.
`

describe('T-111 getSevenBlockTemplate', () => {
  it('기본 템플릿은 7블록 반환', () => {
    const t = getSevenBlockTemplate()
    expect(t).toHaveLength(7)
    expect(t.map(b => b.id)).toEqual([
      'conclusion', 'methodology', 'detail', 'comparison',
      'checklist', 'warning', 'faq',
    ])
  })

  it('medical 섹터는 warning 이 강화됨', () => {
    const t = getSevenBlockTemplate('medical')
    const warn = t.find(b => b.id === 'warning')!
    expect(warn.minContentLength).toBeGreaterThanOrEqual(60)
    expect(warn.description).toMatch(/의료법|부작용/)
  })
})

describe('T-111 validateSevenBlocks', () => {
  it('완전한 본문은 7/7 통과', () => {
    const v = validateSevenBlocks(FULL_MARKDOWN, 'medical')
    expect(v.passed).toBe(7)
    expect(v.missing).toEqual([])
    expect(v.passRate).toBe(1)
  })

  it('결론 블록이 없으면 missing 에 포함', () => {
    const withoutConclusion = FULL_MARKDOWN.replace(/## 결론[\s\S]*?(?=## 분석 방법)/, '')
    const v = validateSevenBlocks(withoutConclusion)
    expect(v.missing).toContain('conclusion')
    expect(v.passed).toBeLessThan(7)
  })

  it('FAQ 본문이 짧으면 short 에 포함', () => {
    const shortFaq = FULL_MARKDOWN.replace(
      /## 자주 묻는 질문[\s\S]*$/,
      '## 자주 묻는 질문\n\n짧다.',
    )
    const v = validateSevenBlocks(shortFaq)
    expect(v.short).toContain('faq')
  })
})

describe('T-111 getBlockChecklist', () => {
  it('각 블록의 상태(ok/missing/short)를 반환', () => {
    const c = getBlockChecklist(FULL_MARKDOWN, 'medical')
    expect(c).toHaveLength(7)
    c.forEach(item => {
      expect(['ok', 'missing', 'short']).toContain(item.status)
    })
    const okCount = c.filter(x => x.status === 'ok').length
    expect(okCount).toBe(7)
  })
})
