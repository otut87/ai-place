import { describe, it, expect } from 'vitest'
import { confirmNameMatches } from '@/lib/admin/confirm-name'

describe('confirmNameMatches', () => {
  it('정확 일치 → true', () => {
    expect(confirmNameMatches('닥터에버스', '닥터에버스')).toBe(true)
  })
  it('앞뒤 공백 trim', () => {
    expect(confirmNameMatches('  닥터에버스  ', '닥터에버스')).toBe(true)
  })
  it('부분 일치는 false', () => {
    expect(confirmNameMatches('닥터', '닥터에버스')).toBe(false)
  })
  it('대소문자 다르면 false', () => {
    expect(confirmNameMatches('Clinic', 'clinic')).toBe(false)
  })
  it('빈 expected 는 false (안전장치)', () => {
    expect(confirmNameMatches('', '')).toBe(false)
    expect(confirmNameMatches('a', '')).toBe(false)
  })
})
