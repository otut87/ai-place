// T-235 — sparkline path 빌더 검증.

import { describe, it, expect } from 'vitest'
import { buildSparkline } from '@/lib/sparkline'

describe('buildSparkline', () => {
  it('빈 배열 → empty=true, 빈 문자열', () => {
    const r = buildSparkline([])
    expect(r.empty).toBe(true)
    expect(r.fill).toBe('')
    expect(r.stroke).toBe('')
  })

  it('전부 0 인 배열 → empty=true (placeholder 대체용)', () => {
    const r = buildSparkline([0, 0, 0, 0])
    expect(r.empty).toBe(true)
    expect(r.stroke).toBe('')
    expect(r.fill).toBe('')
  })

  it('데이터가 있으면 stroke 는 M 으로 시작 + L 로 연결', () => {
    const r = buildSparkline([1, 2, 3, 5])
    expect(r.empty).toBe(false)
    expect(r.stroke.startsWith('M')).toBe(true)
    expect(r.stroke).toMatch(/M[\d.]+,[\d.]+ L/)
  })

  it('fill 은 stroke 끝에 우하단 → 좌하단 → Z 가 붙는다 (area 폴리곤)', () => {
    const r = buildSparkline([1, 2, 3], { width: 100, height: 50 })
    expect(r.fill.endsWith('Z')).toBe(true)
    expect(r.fill).toContain('L100.0,50.0')
    expect(r.fill).toContain('L0,50.0')
  })

  it('단일 값 — stepX=0 이지만 path 생성 가능', () => {
    const r = buildSparkline([7])
    expect(r.empty).toBe(false)
    expect(r.stroke).toMatch(/^M0\.0,/)
  })

  it('width/height 옵션이 path 좌표에 반영된다', () => {
    const wide = buildSparkline([1, 2, 3], { width: 800, height: 100 })
    expect(wide.stroke).toContain('M0.0,')
    expect(wide.stroke).toContain('800.0,')
  })

  it('값이 큰 인덱스가 height 상단(작은 y) 으로 매핑된다', () => {
    const r = buildSparkline([1, 10], { width: 100, height: 100 })
    const matches = [...r.stroke.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map(m => ({
      x: parseFloat(m[1]),
      y: parseFloat(m[2]),
    }))
    expect(matches[1].y).toBeLessThan(matches[0].y)
  })
})
