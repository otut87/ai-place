import { describe, it, expect } from 'vitest'
import { validateTaskRef } from '../gates/task-ref'

describe('validateTaskRef', () => {
  const pattern = '(T-\\d{3}|WO-#\\d+)'

  it('passes when commit message contains T-NNN reference', () => {
    const commits = [{ hash: 'abc', message: 'feat: T-001 수피부과 제거', body: '' }]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('passes when body contains WO-#N reference', () => {
    const commits = [{
      hash: 'abc',
      message: 'feat: remove ghost entries',
      body: 'Refs WO-#1',
    }]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(true)
  })

  it('accepts multiple commits with valid refs', () => {
    const commits = [
      { hash: 'a', message: 'T-001 first', body: '' },
      { hash: 'b', message: 'T-002 second', body: '' },
    ]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(true)
  })

  it('fails when commit lacks any ref', () => {
    const commits = [{ hash: 'abc', message: 'feat: random change', body: '' }]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].commit).toBe('abc')
  })

  it('reports each missing commit individually', () => {
    const commits = [
      { hash: 'a', message: 'T-001 ok', body: '' },
      { hash: 'b', message: 'no ref here', body: '' },
      { hash: 'c', message: 'also no ref', body: '' },
    ]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(2)
    expect(result.violations.map(v => v.commit)).toEqual(['b', 'c'])
  })

  it('passes with empty commit list (nothing to check)', () => {
    const result = validateTaskRef([], pattern)
    expect(result.ok).toBe(true)
  })

  it('rejects invalid formats close to spec', () => {
    const commits = [
      { hash: 'a', message: 'T-1 (too short)', body: '' },
      { hash: 'b', message: 'WO#1 (missing dash)', body: '' },
      { hash: 'c', message: 'T_001 (underscore)', body: '' },
    ]
    const result = validateTaskRef(commits, pattern)
    expect(result.ok).toBe(false)
    expect(result.violations).toHaveLength(3)
  })
})
