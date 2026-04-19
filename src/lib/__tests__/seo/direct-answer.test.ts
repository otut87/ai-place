// T-123 — Direct Answer Block 유틸 테스트.
// 철학: "모든 페이지 H1 바로 아래에 40~80자 내의 자기완결형 요약문(Direct Answer Block)"

import { describe, it, expect } from 'vitest'
import { clampDirectAnswer, isValidDirectAnswer } from '@/lib/seo/direct-answer'

describe('isValidDirectAnswer', () => {
  it('40~80자는 유효', () => {
    // 정확히 40자
    const s40 = '가'.repeat(40)
    expect(isValidDirectAnswer(s40)).toBe(true)
    // 정확히 80자
    const s80 = '가'.repeat(80)
    expect(isValidDirectAnswer(s80)).toBe(true)
    // 범위 내
    const s60 = '가'.repeat(60)
    expect(isValidDirectAnswer(s60)).toBe(true)
  })

  it('39자 이하 / 81자 이상은 유효하지 않음', () => {
    expect(isValidDirectAnswer('가'.repeat(39))).toBe(false)
    expect(isValidDirectAnswer('가'.repeat(81))).toBe(false)
  })

  it('빈 문자열 / null / undefined 는 유효하지 않음', () => {
    expect(isValidDirectAnswer('')).toBe(false)
    expect(isValidDirectAnswer(null)).toBe(false)
    expect(isValidDirectAnswer(undefined)).toBe(false)
  })
})

describe('clampDirectAnswer', () => {
  it('80자 넘으면 자르고 … 추가, 40~80 범위 유지', () => {
    const long = '가'.repeat(200)
    const clamped = clampDirectAnswer(long)
    expect(clamped.length).toBeLessThanOrEqual(80)
    expect(clamped.length).toBeGreaterThanOrEqual(40)
  })

  it('40~80자 범위면 그대로 반환', () => {
    const ok = '가'.repeat(60)
    expect(clampDirectAnswer(ok)).toBe(ok)
  })

  it('40자 미만이면 fallback 을 뒤에 붙여 최소 40자 보장', () => {
    const short = '짧은 요약'
    const clamped = clampDirectAnswer(short, '추가 문구로 40자를 채우는 fallback 텍스트입니다.')
    expect(clamped.length).toBeGreaterThanOrEqual(40)
  })

  it('빈 문자열은 fallback 만 반환 (없으면 기본 문구)', () => {
    expect(clampDirectAnswer('').length).toBeGreaterThanOrEqual(40)
  })
})
