/**
 * format/hours.ts 테스트 (T-010)
 * 한글 영업시간 + Schema.org OpeningHoursSpecification.
 */
import { describe, it, expect } from 'vitest'
import { formatHoursKo, toSchemaOrgHours } from '@/lib/format/hours'

describe('formatHoursKo', () => {
  it('Mo-Fr 09:00-18:00 → "월-금 09:00-18:00"', () => {
    expect(formatHoursKo(['Mo-Fr 09:00-18:00'])).toBe('월-금 09:00-18:00')
  })

  it('여러 엔트리 — 쉼표 구분', () => {
    expect(formatHoursKo(['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00']))
      .toBe('월-금 09:00-18:00, 토 09:00-13:00')
  })

  it('단일 요일 "Sa 09:00-13:00" → "토 09:00-13:00"', () => {
    expect(formatHoursKo(['Sa 09:00-13:00'])).toBe('토 09:00-13:00')
  })

  it('모든 요일 약어 변환', () => {
    expect(formatHoursKo(['Mo 09:00-10:00'])).toContain('월')
    expect(formatHoursKo(['Tu 09:00-10:00'])).toContain('화')
    expect(formatHoursKo(['We 09:00-10:00'])).toContain('수')
    expect(formatHoursKo(['Th 09:00-10:00'])).toContain('목')
    expect(formatHoursKo(['Fr 09:00-10:00'])).toContain('금')
    expect(formatHoursKo(['Sa 09:00-10:00'])).toContain('토')
    expect(formatHoursKo(['Su 09:00-10:00'])).toContain('일')
  })

  it('빈 배열 → 빈 문자열', () => {
    expect(formatHoursKo([])).toBe('')
  })

  it('undefined → 빈 문자열', () => {
    expect(formatHoursKo(undefined)).toBe('')
  })

  it('파싱 실패 시 원본 유지 (방어적)', () => {
    expect(formatHoursKo(['잘못된 형식'])).toBe('잘못된 형식')
  })
})

describe('toSchemaOrgHours', () => {
  it('Mo-Fr 09:00-18:00 → 5일 분리', () => {
    const specs = toSchemaOrgHours(['Mo-Fr 09:00-18:00'])
    expect(specs).toHaveLength(5)
    expect(specs[0]).toEqual({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: 'Monday',
      opens: '09:00',
      closes: '18:00',
    })
    expect(specs[4].dayOfWeek).toBe('Friday')
  })

  it('단일 요일 + 요일 범위 혼합', () => {
    const specs = toSchemaOrgHours(['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'])
    expect(specs).toHaveLength(6)
    expect(specs[5].dayOfWeek).toBe('Saturday')
  })

  it('undefined → 빈 배열', () => {
    expect(toSchemaOrgHours(undefined)).toEqual([])
  })
})
