/**
 * format/rating.ts 테스트 (T-009)
 * 평점 표기 일관성 — 모든 표기는 formatRatingLine 사용.
 */
import { describe, it, expect } from 'vitest'
import { formatRatingLine } from '@/lib/format/rating'

describe('formatRatingLine', () => {
  it('Google 기본 포맷', () => {
    expect(formatRatingLine(4.5, 178, 'google')).toBe('★ 4.5 · 리뷰 178건 (Google)')
  })

  it('Naver 소스', () => {
    expect(formatRatingLine(4.3, 42, 'naver')).toBe('★ 4.3 · 리뷰 42건 (Naver)')
  })

  it('mixed 소스 → 출처 미표기', () => {
    expect(formatRatingLine(4.7, 250, 'mixed')).toBe('★ 4.7 · 리뷰 250건')
  })

  it('평점 소수점 1자리 고정 (4 → 4.0)', () => {
    expect(formatRatingLine(4, 10, 'google')).toBe('★ 4.0 · 리뷰 10건 (Google)')
  })

  it('review count 0 인 경우 "리뷰 없음"', () => {
    expect(formatRatingLine(4.5, 0, 'google')).toBe('★ 4.5 · 리뷰 없음 (Google)')
  })

  it('rating 소수점 반올림 (4.55 → 4.6)', () => {
    expect(formatRatingLine(4.55, 10, 'google')).toBe('★ 4.6 · 리뷰 10건 (Google)')
  })
})
