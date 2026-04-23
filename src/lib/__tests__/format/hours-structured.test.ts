// T-217 — 구조화 영업시간 round-trip 테스트.

import { describe, it, expect } from 'vitest'
import {
  parseHoursArray,
  serializeHoursMap,
  emptyHoursMap,
  DAY_ORDER,
  HOURS_PRESETS,
} from '@/lib/format/hours-structured'

describe('hours-structured', () => {
  it('빈 입력 → 모든 요일 closed map', () => {
    const map = parseHoursArray([])
    for (const d of DAY_ORDER) {
      expect(map[d].closed).toBe(true)
    }
  })

  it('범위 포맷 "Mo-Fr 09:00-18:00" 을 5일로 확장', () => {
    const map = parseHoursArray(['Mo-Fr 09:00-18:00'])
    expect(map.Mo.closed).toBe(false)
    expect(map.Mo.open).toBe('09:00')
    expect(map.Fr.close).toBe('18:00')
    expect(map.Sa.closed).toBe(true)
    expect(map.Su.closed).toBe(true)
  })

  it('round-trip: 범위 + 단일 요일 섞인 케이스', () => {
    const orig = ['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00']
    const map = parseHoursArray(orig)
    const out = serializeHoursMap(map)
    expect(out).toEqual(['Mo-Fr 09:00-18:00', 'Sa 09:00-13:00'])
  })

  it('연속 요일 같은 시간은 범위로 압축', () => {
    const map = emptyHoursMap()
    map.Mo = { closed: false, open: '10:00', close: '20:00' }
    map.Tu = { closed: false, open: '10:00', close: '20:00' }
    map.We = { closed: false, open: '10:00', close: '20:00' }
    expect(serializeHoursMap(map)).toEqual(['Mo-We 10:00-20:00'])
  })

  it('중간에 다른 시간이 끼면 run 이 끊김', () => {
    const map = emptyHoursMap()
    map.Mo = { closed: false, open: '09:00', close: '18:00' }
    map.Tu = { closed: false, open: '10:00', close: '19:00' }
    map.We = { closed: false, open: '09:00', close: '18:00' }
    const out = serializeHoursMap(map)
    expect(out).toEqual(['Mo 09:00-18:00', 'Tu 10:00-19:00', 'We 09:00-18:00'])
  })

  it('closed 요일은 직렬화에서 제외', () => {
    const map = emptyHoursMap()
    map.Mo = { closed: false, open: '09:00', close: '18:00' }
    map.Sa = { closed: true, open: '09:00', close: '18:00' }
    expect(serializeHoursMap(map)).toEqual(['Mo 09:00-18:00'])
  })

  it('프리셋: 평일 9-18시 → Mo-Fr 만 open', () => {
    const preset = HOURS_PRESETS.find((p) => p.id === 'weekday9to6')!
    const map = preset.apply(emptyHoursMap())
    expect(serializeHoursMap(map)).toEqual(['Mo-Fr 09:00-18:00'])
  })

  it('파싱 실패 엔트리는 무시 (자유 입력 방어)', () => {
    const map = parseHoursArray(['평일 9-6시 (자유 입력)', 'Mo 09:00-18:00'])
    expect(map.Mo.closed).toBe(false)
    expect(map.Tu.closed).toBe(true) // 파싱 실패한 엔트리 무시
  })
})
