// T-122 — <time datetime> 렌더 유틸 테스트.
// 철학: "날짜는 <time datetime="YYYY-MM-DD"> 태그로 마크업한다."

import { describe, it, expect } from 'vitest'
import { toIsoDate, latestUpdatedAt } from '@/lib/format/time'

describe('toIsoDate', () => {
  it('ISO datetime → YYYY-MM-DD', () => {
    expect(toIsoDate('2026-04-19T10:00:00Z')).toBe('2026-04-19')
  })

  it('YYYY-MM-DD 는 그대로', () => {
    expect(toIsoDate('2026-04-19')).toBe('2026-04-19')
  })

  it('null/undefined/빈 문자열은 null', () => {
    expect(toIsoDate(null)).toBeNull()
    expect(toIsoDate(undefined)).toBeNull()
    expect(toIsoDate('')).toBeNull()
  })

  it('유효하지 않은 문자열은 null', () => {
    expect(toIsoDate('not a date')).toBeNull()
  })
})

describe('latestUpdatedAt', () => {
  it('여러 ISO datetime 중 가장 최신을 반환', () => {
    const dates = ['2026-04-10T00:00:00Z', '2026-04-15T00:00:00Z', '2026-04-12T00:00:00Z']
    expect(latestUpdatedAt(dates)).toBe('2026-04-15')
  })

  it('null 섞임 → 유효한 것 중 최신', () => {
    expect(latestUpdatedAt(['2026-04-10T00:00:00Z', null, '2026-04-15T00:00:00Z'])).toBe('2026-04-15')
  })

  it('모두 null/유효하지 않음 → null', () => {
    expect(latestUpdatedAt([null, undefined, ''])).toBeNull()
  })

  it('빈 배열 → null', () => {
    expect(latestUpdatedAt([])).toBeNull()
  })
})
