import { describe, it, expect } from 'vitest'
import { filterCommands } from '@/components/admin/command-palette'

const LIST = [
  { id: 'review', label: '검수 큐', hint: 'Ops', href: '/admin/review' },
  { id: 'places', label: '업체 목록', hint: 'Content', href: '/admin/places' },
  { id: 'billing-failures', label: '결제 실패 큐', hint: 'Billing', href: '/admin/billing/failures' },
]

describe('filterCommands', () => {
  it('빈 쿼리 → 전체', () => {
    expect(filterCommands(LIST, '')).toEqual(LIST)
    expect(filterCommands(LIST, '   ')).toEqual(LIST)
  })

  it('라벨 매칭', () => {
    const r = filterCommands(LIST, '업체')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('places')
  })

  it('id 매칭', () => {
    const r = filterCommands(LIST, 'review')
    expect(r).toHaveLength(1)
  })

  it('hint 매칭', () => {
    const r = filterCommands(LIST, 'billing')
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('billing-failures')
  })

  it('대소문자 무관', () => {
    expect(filterCommands(LIST, 'OPS').length).toBe(1)
  })
})
