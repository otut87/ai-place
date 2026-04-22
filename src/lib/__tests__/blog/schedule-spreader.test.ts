// T-196 — 발행 시간 분산 테스트.
import { describe, it, expect } from 'vitest'
import { spreadSchedule } from '@/lib/blog/schedule-spreader'

describe('spreadSchedule', () => {
  it('count=10 — 9~22시 구간에 전부 포함', () => {
    const slots = spreadSchedule({ count: 10, plannedDate: '2026-04-23' })
    expect(slots.length).toBe(10)
    for (const s of slots) {
      expect(s.kstHour).toBeGreaterThanOrEqual(9)
      // jitter ±10 분 고려 — 마지막 슬롯이 22:0X 까지 가능
      expect(s.kstHour).toBeLessThanOrEqual(22)
    }
  })

  it('첫 슬롯은 startHour 근처, 마지막은 endHour 근처', () => {
    const slots = spreadSchedule({ count: 10, plannedDate: '2026-04-23', jitter: false })
    expect(slots[0].kstHour).toBe(9)
    expect(slots[0].kstMinute).toBe(0)
    expect(slots[9].kstHour).toBe(22)
    expect(slots[9].kstMinute).toBe(0)
  })

  it('count=1 — 중앙 시간 (9+22)/2 ≈ 15시', () => {
    const slots = spreadSchedule({ count: 1, plannedDate: '2026-04-23', jitter: false })
    expect(slots.length).toBe(1)
    expect(slots[0].kstHour).toBeGreaterThanOrEqual(15)
    expect(slots[0].kstHour).toBeLessThanOrEqual(16)
  })

  it('KST → UTC 변환 정확성 (KST 09:00 = UTC 00:00)', () => {
    const slots = spreadSchedule({ count: 1, plannedDate: '2026-04-23', jitter: false, startHour: 9, endHour: 10 })
    // count=1, start=9, end=10 → 중앙 = 9.5h (9시 30분)
    // KST 2026-04-23 09:30 = UTC 2026-04-23 00:30
    expect(slots[0].scheduledForUtc).toBe('2026-04-23T00:30:00.000Z')
  })

  it('jitter 결정론 — 같은 date+index 는 항상 같은 값', () => {
    const a = spreadSchedule({ count: 10, plannedDate: '2026-04-23' })
    const b = spreadSchedule({ count: 10, plannedDate: '2026-04-23' })
    expect(a.map(s => s.scheduledForUtc)).toEqual(b.map(s => s.scheduledForUtc))
  })

  it('잘못된 날짜 포맷 throw', () => {
    expect(() => spreadSchedule({ count: 10, plannedDate: '26/04/23' })).toThrow()
  })

  it('startHour >= endHour throw', () => {
    expect(() => spreadSchedule({ count: 10, plannedDate: '2026-04-23', startHour: 22, endHour: 9 })).toThrow()
  })

  it('count=0 → 빈 배열', () => {
    expect(spreadSchedule({ count: 0, plannedDate: '2026-04-23' })).toEqual([])
  })
})
