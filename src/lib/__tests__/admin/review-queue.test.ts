import { describe, it, expect } from 'vitest'
import {
  REJECT_REASONS,
  isRejectReason,
  rejectReasonLabel,
  parseReviewParams,
  type RejectReason,
} from '@/lib/admin/review-queue'

describe('REJECT_REASONS', () => {
  it('5종 포함', () => {
    expect(REJECT_REASONS).toEqual(['fact_error', 'tone', 'seo', 'duplicate', 'other'])
  })
})

describe('isRejectReason', () => {
  it('화이트리스트는 true', () => {
    expect(isRejectReason('fact_error')).toBe(true)
    expect(isRejectReason('tone')).toBe(true)
  })
  it('외 값은 false', () => {
    expect(isRejectReason('invalid')).toBe(false)
    expect(isRejectReason('')).toBe(false)
    expect(isRejectReason(undefined)).toBe(false)
    expect(isRejectReason(123)).toBe(false)
  })
})

describe('rejectReasonLabel', () => {
  it('각 enum 에 한국어 라벨', () => {
    for (const r of REJECT_REASONS) {
      const label = rejectReasonLabel(r as RejectReason)
      expect(label).not.toBe('')
      expect(label).not.toBe(r)
    }
  })
  it('fact_error → 사실 오류', () => {
    expect(rejectReasonLabel('fact_error')).toBe('사실 오류')
  })
})

describe('parseReviewParams', () => {
  it('파라미터 없으면 기본 type=place', () => {
    expect(parseReviewParams({})).toEqual({ type: 'place' })
  })
  it('place=<id> 정상 파싱', () => {
    expect(parseReviewParams({ place: 'abc-123' })).toEqual({ type: 'place', placeId: 'abc-123' })
  })
  it('type=blog 파싱', () => {
    expect(parseReviewParams({ type: 'blog', blog: 'my-post' })).toEqual({ type: 'blog', blogSlug: 'my-post' })
  })
  it('잘못된 type → place 기본', () => {
    expect(parseReviewParams({ type: 'weird' }).type).toBe('place')
  })
  it('배열 파라미터 첫번째만 사용', () => {
    expect(parseReviewParams({ place: ['a', 'b'] })).toEqual({ type: 'place', placeId: 'a' })
  })
  it('경로 이탈 시도는 거부', () => {
    expect(parseReviewParams({ place: '../etc' })).toEqual({ type: 'place' })
    expect(parseReviewParams({ place: 'a/b' })).toEqual({ type: 'place' })
    expect(parseReviewParams({ blog: 'a\\b' })).toEqual({ type: 'place' })
  })
})
