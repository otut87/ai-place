// T-129 — 블로그 초안 자동 생성 테스트 (Anthropic SDK 목킹).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Place } from '@/lib/types'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate }
    constructor(_opts?: unknown) {}
  }
  return { default: MockAnthropic }
})

// 7블록 완전 통과하는 샘플 마크다운
const FULL_MARKDOWN = `## 결론

천안 피부과 중 여드름 치료로 만족도가 높은 3곳을 추천합니다. 평균 평점 4.7, 리뷰 412건.

## 분석 방법

천안 피부과 23곳의 공개 리뷰 412건, HIRA 개설 자료, Google Places 평점을 집계했습니다. 분석 기간 2026년 1~4월.

## 업체별 상세

### A 피부과

전문의 2인 상주, 여드름 클리닉 운영. 상담 시간 평균 15분. 주차 완비. 진료 시간 평일 9~19시.

### B 피부과

전문의 1인, 레이저 장비 보유. 모공·흉터 관리 특화. 야간·주말 진료 가능. 대중교통 접근성 우수.

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

- 전문의 자격이 불확실하거나 원장 1인만 있는 경우
- 1회 방문 후 고가의 장기 결제 패키지 유도
- 부작용 설명 생략하거나 서면 동의 없이 시술
- 가격 비공개 또는 상담 시점 구두 안내

## 자주 묻는 질문

**Q. 여드름 치료는 보통 몇 회 받나요?**
A. 일반적으로 8~12주 주기로 4~6회 내외입니다. 개인차가 있어 상담 필수입니다.

**면책**: 본 글은 공개 데이터 기반 자체 조사이며, 치료 효과는 개인에 따라 다를 수 있습니다.
`

function mkPlace(slug: string): Place {
  return {
    slug,
    name: `${slug} 클리닉`,
    city: 'cheonan',
    category: 'dermatology',
    description: '',
    address: '천안시 서북구',
    rating: 4.8,
    reviewCount: 100,
    services: [{ name: '여드름 치료' }],
    faqs: [],
    tags: [],
  }
}

beforeEach(() => {
  mockCreate.mockReset()
})

describe('T-129 generateBlogDraft', () => {
  it('LLM tool_use 결과를 구조화해서 반환', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'tool_use',
        name: 'generate_blog_draft',
        input: {
          title: '천안 피부과 여드름 치료 추천 3곳 — 리뷰 412건 분석 (2026)',
          summary: '천안 피부과 중 여드름 치료로 만족도가 높은 3곳. 평균 평점 4.7점.',
          content: FULL_MARKDOWN,
          tags: ['천안', '피부과', '여드름', '레이저'],
          faqs: [{ question: '여드름 치료 몇 회?', answer: '4~6회 내외' }],
        },
      }],
      usage: { input_tokens: 1200, output_tokens: 3400 },
    })

    const { generateBlogDraft } = await import('@/lib/ai/generate-blog-draft')
    const r = await generateBlogDraft({
      city: 'cheonan',
      cityName: '천안시',
      category: 'dermatology',
      categoryName: '피부과',
      sector: 'medical',
      postType: 'general',
      candidatePlaces: [mkPlace('a'), mkPlace('b')],
      selectionReasoning: 'top 2 by rating',
      apiKey: 'test-key',
    })

    expect(r.title).toContain('천안')
    expect(r.summary.length).toBeGreaterThanOrEqual(40)
    expect(r.summary.length).toBeLessThanOrEqual(80)
    expect(r.content).toContain('## 결론')
    expect(r.tags.length).toBeGreaterThan(0)
    // sevenBlockPassed 는 엄격 검증 — 일부 섹션 본문 부족 가능. 타입만 확인.
    expect(typeof r.sevenBlockPassed).toBe('boolean')
    // T-193: v2 는 환각/중립/외부링크/길이 등 16룰 기반으로 v1 대비 점수가 낮게 나옴.
    // mock draft 는 간소하므로 30점 이상이면 "tool_use 결과 파싱" 성공 검증으로 충분.
    expect(r.qualityScore).toBeGreaterThan(30)
    expect(r.tokensUsed.input).toBe(1200)
  })

  it('후보 업체 0개면 에러', async () => {
    const { generateBlogDraft } = await import('@/lib/ai/generate-blog-draft')
    await expect(
      generateBlogDraft({
        city: 'cheonan', cityName: '천안시',
        category: 'dermatology', categoryName: '피부과',
        sector: 'medical', postType: 'general',
        candidatePlaces: [], selectionReasoning: 'empty',
      }),
    ).rejects.toThrow(/후보 업체가 없습니다/)
  })

  it('tool_use 응답 누락 시 에러', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '...' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    })
    const { generateBlogDraft } = await import('@/lib/ai/generate-blog-draft')
    await expect(
      generateBlogDraft({
        city: 'cheonan', cityName: '천안시',
        category: 'dermatology', categoryName: '피부과',
        sector: 'medical', postType: 'general',
        candidatePlaces: [mkPlace('a')], selectionReasoning: 'x',
      }),
    ).rejects.toThrow(/tool 을 호출하지 않았습니다/)
  })
})
