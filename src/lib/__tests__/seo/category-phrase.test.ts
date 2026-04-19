// T-102 — 업종별 메타 description / DAB 문구 분기.
// 검수 리뷰 #7: "1곳인데 '단비 등의'" 어색 문구 해결.
// 철학: "모든 업종에 동일한 메타 템플릿을 사용하지 않는다."

import { describe, it, expect } from 'vitest'
import { formatDABExampleClause, resolveCategoryDescriptor } from '@/lib/seo/category-phrase'

describe('formatDABExampleClause', () => {
  it('0곳: 빈 문자열', () => {
    expect(formatDABExampleClause([], '메뉴')).toBe('')
  })

  it('1곳: "X의 메뉴" (등 제거)', () => {
    expect(formatDABExampleClause(['단비'], '메뉴')).toBe('단비의 메뉴')
  })

  it('2곳: "X, Y의 메뉴" (등 제거)', () => {
    expect(formatDABExampleClause(['A', 'B'], '메뉴')).toBe('A, B의 메뉴')
  })

  it('3곳 이상: "X, Y 등의 메뉴"', () => {
    expect(formatDABExampleClause(['A', 'B', 'C'], '메뉴')).toBe('A, B 등의 메뉴')
  })

  it('descriptor 가 복합형이어도 그대로 사용', () => {
    expect(formatDABExampleClause(['단비'], '메뉴, 분위기')).toBe('단비의 메뉴, 분위기')
  })
})

describe('resolveCategoryDescriptor', () => {
  it('의료는 "진료 과목, 전문 분야"', () => {
    expect(resolveCategoryDescriptor('medical')).toContain('진료')
  })

  it('음식은 "메뉴" 관련', () => {
    expect(resolveCategoryDescriptor('food')).toContain('메뉴')
  })

  it('카테고리 slug 미지정이면 sector fallback', () => {
    expect(resolveCategoryDescriptor('professional')).toBeTruthy()
  })

  it('철학: 비의료 섹터에는 "진료 과목" 금지', () => {
    for (const sec of ['beauty', 'living', 'auto', 'education', 'professional', 'pet', 'wedding', 'leisure', 'food']) {
      expect(resolveCategoryDescriptor(sec)).not.toContain('진료')
    }
  })
})
