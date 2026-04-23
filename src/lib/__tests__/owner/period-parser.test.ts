import { describe, it, expect } from 'vitest'
import {
  monthBounds,
  monthPresets,
  resolveOwnerPagePeriod,
  toDateInputValue,
} from '@/lib/owner/period-parser'

// T-209 — period-parser 테스트.
// KST=UTC+9 고정. 모든 경계는 KST 자정 기준.

describe('monthBounds', () => {
  it('2026년 4월의 경계는 KST 4/1 00:00 ~ KST 5/1 00:00 (UTC 로는 3/31 15:00 ~ 4/30 15:00)', () => {
    const { from, to } = monthBounds(2026, 3) // monthIndex0=3 → 4월
    expect(from.toISOString()).toBe('2026-03-31T15:00:00.000Z')
    expect(to.toISOString()).toBe('2026-04-30T15:00:00.000Z')
  })

  it('12월 경계 — 다음해 1월로 넘어감', () => {
    const { from, to } = monthBounds(2026, 11)
    expect(from.toISOString()).toBe('2026-11-30T15:00:00.000Z')
    expect(to.toISOString()).toBe('2026-12-31T15:00:00.000Z')
  })
})

describe('monthPresets', () => {
  const NOW = new Date('2026-04-23T12:00:00+09:00') // KST 2026-04-23 정오

  it('세 개 프리셋을 반환 — 이번 달 / 지난 달 / 지지난 달', () => {
    const presets = monthPresets(NOW)
    expect(presets).toHaveLength(3)
    expect(presets[0].key).toBe('current')
    expect(presets[0].label).toBe('이번 달')
    expect(presets[0].koreanLabel).toBe('2026년 4월')
    expect(presets[0].yearMonth).toBe('2026-04')
    expect(presets[1].key).toBe('prev')
    expect(presets[1].koreanLabel).toBe('2026년 3월')
    expect(presets[2].key).toBe('prev2')
    expect(presets[2].koreanLabel).toBe('2026년 2월')
  })

  it('1월 기준이면 지난 달은 전년 12월', () => {
    const jan = new Date('2026-01-15T12:00:00+09:00')
    const presets = monthPresets(jan)
    expect(presets[0].koreanLabel).toBe('2026년 1월')
    expect(presets[1].koreanLabel).toBe('2025년 12월')
    expect(presets[2].koreanLabel).toBe('2025년 11월')
  })

  it('from/to 가 monthBounds 와 일치', () => {
    const presets = monthPresets(NOW)
    const bounds = monthBounds(2026, 3)
    expect(presets[0].from.toISOString()).toBe(bounds.from.toISOString())
    expect(presets[0].to.toISOString()).toBe(bounds.to.toISOString())
  })
})

describe('resolveOwnerPagePeriod', () => {
  const NOW = new Date('2026-04-23T12:00:00+09:00')

  it('빈 입력 → days=30 기본', () => {
    const result = resolveOwnerPagePeriod({}, NOW)
    expect(result.mode).toBe('days')
    if (result.mode === 'days') {
      expect(result.days).toBe(30)
    }
    expect(result.label).toBe('지난 30일')
  })

  it('days=7 → 7일 모드', () => {
    const result = resolveOwnerPagePeriod({ days: '7' }, NOW)
    expect(result.mode).toBe('days')
    if (result.mode === 'days') expect(result.days).toBe(7)
    expect(result.label).toBe('지난 7일')
  })

  it('days=90 → 90일 모드', () => {
    const result = resolveOwnerPagePeriod({ days: '90' }, NOW)
    expect(result.mode).toBe('days')
    if (result.mode === 'days') expect(result.days).toBe(90)
  })

  it('days=invalid → 기본 30', () => {
    const result = resolveOwnerPagePeriod({ days: 'abc' }, NOW)
    expect(result.mode).toBe('days')
    if (result.mode === 'days') expect(result.days).toBe(30)
  })

  it('from/to 가 월 경계에 일치 → month 모드', () => {
    const result = resolveOwnerPagePeriod({ from: '2026-03-01', to: '2026-04-01' }, NOW)
    expect(result.mode).toBe('month')
    if (result.mode === 'month') {
      expect(result.monthKey).toBe('2026-03')
      expect(result.label).toBe('2026년 3월')
    }
  })

  it('from/to 가 월 경계 외 → custom 모드', () => {
    const result = resolveOwnerPagePeriod({ from: '2026-03-15', to: '2026-04-05' }, NOW)
    expect(result.mode).toBe('custom')
    expect(result.label).toContain('2026-03-15')
    // to 는 exclusive 라 라벨은 4/4 까지 표시
    expect(result.label).toContain('2026-04-04')
  })

  it('from > to 면 days 모드 fallback', () => {
    const result = resolveOwnerPagePeriod({ from: '2026-04-10', to: '2026-04-01' }, NOW)
    expect(result.mode).toBe('days')
  })

  it('from 만 있으면 days fallback', () => {
    const result = resolveOwnerPagePeriod({ from: '2026-04-01' }, NOW)
    expect(result.mode).toBe('days')
  })

  it('잘못된 형식의 날짜 → days fallback', () => {
    const result = resolveOwnerPagePeriod({ from: '2026/04/01', to: '2026-05-01' }, NOW)
    expect(result.mode).toBe('days')
  })
})

describe('toDateInputValue', () => {
  it('KST 자정 경계를 YYYY-MM-DD 로 변환', () => {
    const date = new Date('2026-04-01T00:00:00+09:00')
    expect(toDateInputValue(date)).toBe('2026-04-01')
  })

  it('UTC 가 같은 날이어도 KST 로는 다음날인 경우', () => {
    // UTC 2026-04-01 20:00 → KST 2026-04-02 05:00
    const date = new Date('2026-04-01T20:00:00Z')
    expect(toDateInputValue(date)).toBe('2026-04-02')
  })
})
