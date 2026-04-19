import { describe, it, expect } from 'vitest'
import { canAutopublish, hoursUntilPublishable } from '@/lib/admin/autopublish'

const EARLIER = new Date('2026-04-19T00:00:00Z')
const ENABLED = { slug: 'dermatology', autopublishEnabled: true, reviewDelayHours: 24 }
const DISABLED = { slug: 'dermatology', autopublishEnabled: false, reviewDelayHours: 24 }

describe('canAutopublish', () => {
  it('비활성 카테고리 → 항상 false', () => {
    const now = new Date('2026-04-21T00:00:00Z')
    expect(canAutopublish(DISABLED, EARLIER, now)).toBe(false)
  })

  it('24시간 전 생성 → true', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    expect(canAutopublish(ENABLED, EARLIER, now)).toBe(true)
  })

  it('23시간 전 → false (유예 내)', () => {
    const now = new Date('2026-04-19T23:00:00Z')
    expect(canAutopublish(ENABLED, EARLIER, now)).toBe(false)
  })

  it('exact 24시간 경계 → true', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    expect(canAutopublish(ENABLED, EARLIER, now)).toBe(true)
  })
})

describe('hoursUntilPublishable', () => {
  it('비활성 → Infinity', () => {
    expect(hoursUntilPublishable(DISABLED, EARLIER, new Date('2026-04-21T00:00:00Z'))).toBe(Infinity)
  })

  it('6시간 남음 → 6', () => {
    const now = new Date('2026-04-19T18:00:00Z')
    expect(hoursUntilPublishable(ENABLED, EARLIER, now)).toBe(6)
  })

  it('이미 발행 가능 → 0', () => {
    const now = new Date('2026-04-20T00:00:00Z')
    expect(hoursUntilPublishable(ENABLED, EARLIER, now)).toBe(0)
  })
})
