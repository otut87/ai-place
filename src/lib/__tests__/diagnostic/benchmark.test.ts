// T-138 — 벤치마크 유틸 테스트.
import { describe, it, expect } from 'vitest'
import { getBenchmark, scoreBucket, deltaVsRegistered, DEFAULT_BENCHMARK } from '@/lib/diagnostic/benchmark'

describe('getBenchmark', () => {
  it('기본 벤치마크 반환', () => {
    const b = getBenchmark()
    expect(b.registered).toBe(91)
    expect(b.unregistered).toBe(58)
    expect(b.note).toContain('JSON-LD')
  })
})

describe('scoreBucket', () => {
  it('85점 이상 → 우수/great', () => {
    expect(scoreBucket(85)).toEqual({ label: '우수', tone: 'great' })
    expect(scoreBucket(100)).toEqual({ label: '우수', tone: 'great' })
  })
  it('60~84 → 보통/ok', () => {
    expect(scoreBucket(60)).toEqual({ label: '보통', tone: 'ok' })
    expect(scoreBucket(84)).toEqual({ label: '보통', tone: 'ok' })
  })
  it('30~59 → 개선 필요/warn', () => {
    expect(scoreBucket(30)).toEqual({ label: '개선 필요', tone: 'warn' })
    expect(scoreBucket(59)).toEqual({ label: '개선 필요', tone: 'warn' })
  })
  it('30 미만 → 심각/bad', () => {
    expect(scoreBucket(0)).toEqual({ label: '심각', tone: 'bad' })
    expect(scoreBucket(29)).toEqual({ label: '심각', tone: 'bad' })
  })
})

describe('deltaVsRegistered', () => {
  it('평균 이상 → 동등 문구', () => {
    expect(deltaVsRegistered(95)).toContain('동등')
    expect(deltaVsRegistered(95)).toContain('+4점')
  })
  it('평균 미만 → 낮음 문구', () => {
    expect(deltaVsRegistered(70)).toContain('21점 낮음')
  })
  it('커스텀 벤치마크 지원', () => {
    expect(deltaVsRegistered(50, { registered: 80, unregistered: 50, note: '' })).toContain('30점 낮음')
  })
  it('DEFAULT_BENCHMARK 상수 export', () => {
    expect(DEFAULT_BENCHMARK.registered).toBe(91)
  })
})
