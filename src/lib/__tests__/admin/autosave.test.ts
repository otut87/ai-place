import { describe, it, expect, vi } from 'vitest'
import { computeFieldDiff, equalsShallow, makeDebouncer } from '@/lib/admin/autosave'

describe('equalsShallow', () => {
  it('원시값', () => {
    expect(equalsShallow('a', 'a')).toBe(true)
    expect(equalsShallow(1, 1)).toBe(true)
    expect(equalsShallow('a', 'b')).toBe(false)
    expect(equalsShallow(null, null)).toBe(true)
    expect(equalsShallow(null, 'x')).toBe(false)
  })

  it('배열', () => {
    expect(equalsShallow([1, 2], [1, 2])).toBe(true)
    expect(equalsShallow([1, 2], [1, 3])).toBe(false)
    expect(equalsShallow([1], [1, 2])).toBe(false)
  })

  it('객체', () => {
    expect(equalsShallow({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(equalsShallow({ a: 1 }, { a: 2 })).toBe(false)
    expect(equalsShallow({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })
})

describe('computeFieldDiff', () => {
  it('변경 감지', () => {
    const d = computeFieldDiff(
      { name: '홍', phone: '010-1111', tags: ['a'] },
      { name: '길동', phone: '010-1111', tags: ['a', 'b'] },
      ['name', 'phone', 'tags'],
    )
    expect(d).toHaveLength(2)
    expect(d.find(x => x.field === 'name')?.kind).toBe('changed')
    expect(d.find(x => x.field === 'tags')?.kind).toBe('changed')
    expect(d.find(x => x.field === 'phone')).toBeUndefined()
  })

  it('added: 빈 값 → 값', () => {
    const d = computeFieldDiff(
      { name: '' },
      { name: '홍' },
      ['name'],
    )
    expect(d[0].kind).toBe('added')
  })

  it('removed: 값 → 빈 값', () => {
    const d = computeFieldDiff(
      { tags: ['a'] },
      { tags: [] },
      ['tags'],
    )
    expect(d[0].kind).toBe('removed')
  })

  it('동일 → 빈 diff', () => {
    const d = computeFieldDiff({ a: 1 }, { a: 1 }, ['a'])
    expect(d).toEqual([])
  })
})

describe('makeDebouncer', () => {
  it('마지막 호출만 실행', async () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { debounced } = makeDebouncer(fn, 100)
    debounced('a'); debounced('b'); debounced('c')
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(99)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')
    vi.useRealTimers()
  })

  it('cancel 로 실행 취소', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { debounced, cancel } = makeDebouncer(fn, 100)
    debounced('x')
    cancel()
    vi.advanceTimersByTime(200)
    expect(fn).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('flush 로 즉시 실행', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { debounced, flush } = makeDebouncer(fn, 100)
    debounced('x')
    flush('y')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('y')
    vi.useRealTimers()
  })
})
