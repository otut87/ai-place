import { describe, it, expect } from 'vitest'
import {
  MEASUREMENT_WINDOW_DAYS,
  getMeasurementWindow,
} from '@/lib/owner/measurement-window'

const NOW = new Date('2026-04-22T12:00:00Z')

function isoMinusDays(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString()
}

describe('measurement-window', () => {
  it('업체 0건 → D-15 카운트다운 (오너가 업체 등록 전)', () => {
    const w = getMeasurementWindow([], NOW)
    expect(w.daysElapsed).toBe(0)
    expect(w.daysRemaining).toBe(MEASUREMENT_WINDOW_DAYS)
    expect(w.isMeasuring).toBe(true)
    expect(w.label).toBe('D-15')
    expect(w.referenceCreatedAt).toBeNull()
  })

  it('업체 생성 직후 (오늘) → D-15', () => {
    const w = getMeasurementWindow([isoMinusDays(0)], NOW)
    expect(w.daysElapsed).toBe(0)
    expect(w.daysRemaining).toBe(15)
    expect(w.isMeasuring).toBe(true)
    expect(w.label).toBe('D-15')
  })

  it('12일 경과 → D-3', () => {
    const w = getMeasurementWindow([isoMinusDays(12)], NOW)
    expect(w.daysElapsed).toBe(12)
    expect(w.daysRemaining).toBe(3)
    expect(w.isMeasuring).toBe(true)
    expect(w.label).toBe('D-3')
  })

  it('14일 경과 → D-1 · 내일 공개', () => {
    const w = getMeasurementWindow([isoMinusDays(14)], NOW)
    expect(w.daysElapsed).toBe(14)
    expect(w.daysRemaining).toBe(1)
    expect(w.isMeasuring).toBe(true)
    expect(w.label).toBe('D-1 · 내일 공개')
  })

  it('15일 경과 → 측정 완료', () => {
    const w = getMeasurementWindow([isoMinusDays(15)], NOW)
    expect(w.daysElapsed).toBe(15)
    expect(w.isMeasuring).toBe(false)
    expect(w.label).toBe('측정 완료')
  })

  it('30일 경과 → 측정 완료', () => {
    const w = getMeasurementWindow([isoMinusDays(30)], NOW)
    expect(w.daysElapsed).toBe(30)
    expect(w.daysRemaining).toBe(0)
    expect(w.isMeasuring).toBe(false)
    expect(w.label).toBe('측정 완료')
  })

  it('가장 이른 업체 기준 — 10일 · 3일 섞이면 10일 기준', () => {
    const w = getMeasurementWindow(
      [isoMinusDays(10), isoMinusDays(3), isoMinusDays(7)],
      NOW,
    )
    expect(w.daysElapsed).toBe(10)
    expect(w.referenceCreatedAt).toBe(isoMinusDays(10))
  })

  it('null/undefined 섞여도 유효 값만 채택', () => {
    const w = getMeasurementWindow(
      [null, undefined, isoMinusDays(5), null],
      NOW,
    )
    expect(w.daysElapsed).toBe(5)
    expect(w.isMeasuring).toBe(true)
  })

  it('미래 날짜(시계 오차) → 0 으로 보정', () => {
    const future = new Date(NOW.getTime() + 86_400_000).toISOString()
    const w = getMeasurementWindow([future], NOW)
    expect(w.daysElapsed).toBe(0)
    expect(w.isMeasuring).toBe(true)
  })

  it('잘못된 ISO 문자열은 0 으로 처리', () => {
    const w = getMeasurementWindow(['not-a-date'], NOW)
    expect(w.daysElapsed).toBe(0)
    expect(w.isMeasuring).toBe(true)
    // 잘못된 문자열도 earliest 로 남아 referenceCreatedAt 에 들어감 (정렬 기준).
    expect(w.referenceCreatedAt).toBe('not-a-date')
  })
})
