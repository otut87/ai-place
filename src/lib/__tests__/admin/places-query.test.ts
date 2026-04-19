import { describe, it, expect } from 'vitest'
import {
  parseListParams,
  clampPage,
  buildRange,
  buildPageList,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@/lib/admin/places-query'

describe('parseListParams', () => {
  it('returns defaults for empty input', () => {
    expect(parseListParams({})).toEqual({
      q: '',
      city: null,
      category: null,
      sector: null,
      status: null,
      subscription: null,
      minQualityScore: null,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
  })

  it('accepts subscription filter values', () => {
    expect(parseListParams({ subscription: 'paid' }).subscription).toBe('paid')
    expect(parseListParams({ subscription: 'past_due' }).subscription).toBe('past_due')
    expect(parseListParams({ subscription: 'suspended' }).subscription).toBe('suspended')
    expect(parseListParams({ subscription: 'weird' }).subscription).toBeNull()
    expect(parseListParams({ subscription: 'all' }).subscription).toBeNull()
  })

  it('clamps min_quality_score to 0~100', () => {
    expect(parseListParams({ min_quality_score: '70' }).minQualityScore).toBe(70)
    expect(parseListParams({ min_quality_score: '-5' }).minQualityScore).toBe(0)
    expect(parseListParams({ min_quality_score: '150' }).minQualityScore).toBe(100)
    expect(parseListParams({ min_quality_score: 'abc' }).minQualityScore).toBeNull()
    expect(parseListParams({}).minQualityScore).toBeNull()
  })

  it('trims the search query', () => {
    expect(parseListParams({ q: '  수피부과  ' }).q).toBe('수피부과')
  })

  it('treats empty query string as empty', () => {
    expect(parseListParams({ q: '' }).q).toBe('')
  })

  it('accepts city / category / sector slugs verbatim', () => {
    const p = parseListParams({ city: 'cheonan', category: 'dermatology', sector: 'medical' })
    expect(p.city).toBe('cheonan')
    expect(p.category).toBe('dermatology')
    expect(p.sector).toBe('medical')
  })

  it('normalizes the "all" sentinel to null', () => {
    const p = parseListParams({ city: 'all', category: 'all', sector: 'all', status: 'all' })
    expect(p.city).toBeNull()
    expect(p.category).toBeNull()
    expect(p.sector).toBeNull()
    expect(p.status).toBeNull()
  })

  it('accepts only whitelisted status values', () => {
    expect(parseListParams({ status: 'active' }).status).toBe('active')
    expect(parseListParams({ status: 'pending' }).status).toBe('pending')
    expect(parseListParams({ status: 'rejected' }).status).toBe('rejected')
    expect(parseListParams({ status: 'weird' }).status).toBeNull()
  })

  it('clamps page to >= 1', () => {
    expect(parseListParams({ page: '0' }).page).toBe(1)
    expect(parseListParams({ page: '-5' }).page).toBe(1)
    expect(parseListParams({ page: 'abc' }).page).toBe(1)
    expect(parseListParams({ page: '7' }).page).toBe(7)
  })

  it('clamps pageSize between 1 and MAX_PAGE_SIZE', () => {
    expect(parseListParams({ pageSize: '50' }).pageSize).toBe(50)
    expect(parseListParams({ pageSize: '0' }).pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(parseListParams({ pageSize: '9999' }).pageSize).toBe(MAX_PAGE_SIZE)
    expect(parseListParams({ pageSize: 'junk' }).pageSize).toBe(DEFAULT_PAGE_SIZE)
  })

  it('accepts URLSearchParams input', () => {
    const usp = new URLSearchParams({ q: 'abc', page: '3' })
    const p = parseListParams(usp)
    expect(p.q).toBe('abc')
    expect(p.page).toBe(3)
  })

  it('ignores duplicate-array params and takes the first value', () => {
    const p = parseListParams({ q: ['first', 'second'] })
    expect(p.q).toBe('first')
  })
})

describe('clampPage', () => {
  it('returns 1 when totalPages is 0 (no results)', () => {
    expect(clampPage(5, 0)).toBe(1)
  })

  it('clamps to 1 when page < 1', () => {
    expect(clampPage(0, 10)).toBe(1)
    expect(clampPage(-2, 10)).toBe(1)
  })

  it('clamps to totalPages when page > totalPages', () => {
    expect(clampPage(99, 10)).toBe(10)
  })

  it('returns the page when in range', () => {
    expect(clampPage(3, 10)).toBe(3)
  })
})

describe('buildRange', () => {
  it('returns 0-based inclusive range for page 1', () => {
    expect(buildRange(1, 20)).toEqual({ from: 0, to: 19 })
  })

  it('computes offset for subsequent pages', () => {
    expect(buildRange(2, 20)).toEqual({ from: 20, to: 39 })
    expect(buildRange(5, 10)).toEqual({ from: 40, to: 49 })
  })
})

describe('buildPageList', () => {
  it('returns empty list for 0 pages', () => {
    expect(buildPageList(1, 0)).toEqual([])
  })

  it('returns all pages when totalPages <= window', () => {
    expect(buildPageList(1, 5, 7)).toEqual([1, 2, 3, 4, 5])
  })

  it('inserts ellipsis on the right when current is near start', () => {
    expect(buildPageList(1, 20, 5)).toEqual([1, 2, 3, 4, 5, 'ellipsis', 20])
  })

  it('inserts ellipsis on the left when current is near end', () => {
    expect(buildPageList(20, 20, 5)).toEqual([1, 'ellipsis', 16, 17, 18, 19, 20])
  })

  it('inserts ellipsis on both sides when current is in middle', () => {
    expect(buildPageList(10, 20, 5)).toEqual([1, 'ellipsis', 8, 9, 10, 11, 12, 'ellipsis', 20])
  })
})
