import { describe, it, expect } from 'vitest'
import {
  computeAssignedDays,
  pickPostTypeForN,
} from '@/lib/blog/monthly-blog-planner'

describe('computeAssignedDays', () => {
  it('30일 월 · quota 5 → 5개 고유 일자 반환', () => {
    const days = computeAssignedDays('uuid-1', 30, 5)
    expect(days).toHaveLength(5)
    expect(new Set(days).size).toBe(5)
    for (const d of days) {
      expect(d).toBeGreaterThanOrEqual(1)
      expect(d).toBeLessThanOrEqual(30)
    }
  })

  it('31일 월 · quota 5 → 5개 일자', () => {
    const days = computeAssignedDays('uuid-a', 31, 5)
    expect(days).toHaveLength(5)
  })

  it('28일 월(2월) · quota 5 → 5개 일자 clamp', () => {
    const days = computeAssignedDays('uuid-b', 28, 5)
    expect(days).toHaveLength(5)
    for (const d of days) expect(d).toBeLessThanOrEqual(28)
  })

  it('업체마다 분산 — 다른 placeId 면 시작일 다를 수 있음', () => {
    const a = computeAssignedDays('place-aaa', 30, 5)
    const b = computeAssignedDays('place-zzz', 30, 5)
    // 두 세트가 완전히 동일할 확률은 해시 분포로 매우 낮아야.
    const same = JSON.stringify(a) === JSON.stringify(b)
    expect(same).toBe(false)
  })

  it('결정론 — 같은 placeId 는 항상 같은 결과', () => {
    expect(computeAssignedDays('same-id', 30, 5)).toEqual(computeAssignedDays('same-id', 30, 5))
  })

  it('quota 0 → 빈 배열', () => {
    expect(computeAssignedDays('p', 30, 0)).toEqual([])
  })

  it('quota 1 → 1개 일자', () => {
    expect(computeAssignedDays('p', 30, 1)).toHaveLength(1)
  })
})

describe('pickPostTypeForN', () => {
  it('로테이션 순서 — detail/compare/guide/keyword/detail', () => {
    expect(pickPostTypeForN(0, true)).toBe('detail')
    expect(pickPostTypeForN(1, true)).toBe('compare')
    expect(pickPostTypeForN(2, true)).toBe('guide')
    expect(pickPostTypeForN(3, true)).toBe('keyword')
    expect(pickPostTypeForN(4, true)).toBe('detail')
  })

  it('5 초과면 순환 (n % 5)', () => {
    expect(pickPostTypeForN(5, true)).toBe('detail')
    expect(pickPostTypeForN(6, true)).toBe('compare')
    expect(pickPostTypeForN(9, true)).toBe('detail')
  })

  it('compare 불가능한 업체 → detail 로 fallback', () => {
    expect(pickPostTypeForN(1, false)).toBe('detail')
    expect(pickPostTypeForN(6, false)).toBe('detail')
  })

  it('compare 외 유형은 canCompare 와 무관', () => {
    expect(pickPostTypeForN(0, false)).toBe('detail')
    expect(pickPostTypeForN(2, false)).toBe('guide')
    expect(pickPostTypeForN(3, false)).toBe('keyword')
  })
})
