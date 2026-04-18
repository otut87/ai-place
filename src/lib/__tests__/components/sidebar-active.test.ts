/**
 * T-061 — Sidebar 의 isActive 헬퍼 단위 테스트.
 */
import { describe, it, expect } from 'vitest'
import { isActive } from '@/components/admin/sidebar'

describe('isActive', () => {
  it('/admin 루트는 정확 매칭만', () => {
    expect(isActive('/admin', '/admin')).toBe(true)
    expect(isActive('/admin/places', '/admin')).toBe(false)
  })

  it('하위 경로는 prefix 매칭', () => {
    expect(isActive('/admin/places', '/admin/places')).toBe(true)
    expect(isActive('/admin/places/abc', '/admin/places')).toBe(true)
    expect(isActive('/admin/places/abc/history', '/admin/places')).toBe(true)
  })

  it('이름 겹침(/admin/places vs /admin/places-bulk) 분리', () => {
    expect(isActive('/admin/places-bulk', '/admin/places')).toBe(false)
    expect(isActive('/admin/registered', '/admin/register')).toBe(false)
  })

  it('다른 경로는 false', () => {
    expect(isActive('/admin/billing', '/admin/places')).toBe(false)
    expect(isActive('/cheonan', '/admin')).toBe(false)
  })
})
