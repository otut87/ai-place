import { describe, it, expect } from 'vitest'
import {
  parseBulkAction,
  partitionIds,
  summarizeBulkResult,
  type BulkAction,
} from '@/lib/admin/places-bulk'

describe('parseBulkAction', () => {
  it('accepts whitelisted actions', () => {
    const actions: BulkAction[] = ['activate', 'reject', 'delete']
    for (const a of actions) expect(parseBulkAction(a)).toBe(a)
  })

  it('rejects unknown actions', () => {
    expect(parseBulkAction('purge')).toBeNull()
    expect(parseBulkAction('')).toBeNull()
    expect(parseBulkAction(undefined)).toBeNull()
    expect(parseBulkAction(null)).toBeNull()
  })
})

describe('partitionIds', () => {
  it('separates valid from invalid ids', () => {
    const r = partitionIds(['a', 'b', 'c', 'z'], new Set(['a', 'b', 'c']))
    expect(r.valid).toEqual(['a', 'b', 'c'])
    expect(r.invalid).toEqual(['z'])
  })

  it('dedupes selected ids', () => {
    const r = partitionIds(['a', 'a', 'b'], new Set(['a', 'b']))
    expect(r.valid).toEqual(['a', 'b'])
    expect(r.invalid).toEqual([])
  })

  it('returns empty arrays for empty input', () => {
    expect(partitionIds([], new Set())).toEqual({ valid: [], invalid: [] })
  })

  it('accepts allowed ids as array or Set', () => {
    const r = partitionIds(['a', 'b'], ['a'])
    expect(r.valid).toEqual(['a'])
    expect(r.invalid).toEqual(['b'])
  })
})

describe('summarizeBulkResult', () => {
  it('formats all-success result', () => {
    expect(summarizeBulkResult({ successes: 5, failures: 0 })).toBe('5개 처리 완료')
  })

  it('formats partial failure', () => {
    expect(summarizeBulkResult({ successes: 3, failures: 2 })).toBe('3개 성공 · 2개 실패')
  })

  it('formats all-failure', () => {
    expect(summarizeBulkResult({ successes: 0, failures: 4 })).toBe('4개 모두 실패')
  })

  it('formats empty result', () => {
    expect(summarizeBulkResult({ successes: 0, failures: 0 })).toBe('처리된 항목이 없습니다')
  })
})
