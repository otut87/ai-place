import { describe, it, expect } from 'vitest'
import { isAnalyticsSuppressedPath } from '@/lib/analytics/suppressed-paths'

describe('isAnalyticsSuppressedPath', () => {
  it('/admin 루트는 suppress', () => {
    expect(isAnalyticsSuppressedPath('/admin')).toBe(true)
  })

  it('/admin 하위 라우트 suppress', () => {
    expect(isAnalyticsSuppressedPath('/admin/places')).toBe(true)
    expect(isAnalyticsSuppressedPath('/admin/login')).toBe(true)
    expect(isAnalyticsSuppressedPath('/admin/places/abc/history')).toBe(true)
  })

  it('/owner 하위 라우트 suppress', () => {
    expect(isAnalyticsSuppressedPath('/owner')).toBe(true)
    expect(isAnalyticsSuppressedPath('/owner/places/x')).toBe(true)
  })

  it('공개 경로는 suppress 안 함', () => {
    expect(isAnalyticsSuppressedPath('/')).toBe(false)
    expect(isAnalyticsSuppressedPath('/cheonan/dermatology')).toBe(false)
    expect(isAnalyticsSuppressedPath('/blog')).toBe(false)
  })

  it('prefix 혼동 방지 — /administrator 는 suppress 안 함', () => {
    expect(isAnalyticsSuppressedPath('/administrator')).toBe(false)
    expect(isAnalyticsSuppressedPath('/ownership')).toBe(false)
  })

  it('빈 경로는 false', () => {
    expect(isAnalyticsSuppressedPath('')).toBe(false)
  })
})
