import { describe, it, expect } from 'vitest'
import { validateReview, parseReviewLog } from '../gates/review'

describe('parseReviewLog', () => {
  it('parses valid JSONL', () => {
    const input = [
      '{"commit":"abc","files":["src/lib/a.ts"],"timestamp":"2026-04-17T10:00:00Z","reviewer":"self","taskId":"T-001"}',
      '{"commit":"def","files":["src/lib/b.ts"],"timestamp":"2026-04-17T11:00:00Z","reviewer":"self","taskId":"T-002"}',
    ].join('\n')

    const entries = parseReviewLog(input)
    expect(entries).toHaveLength(2)
    expect(entries[0].commit).toBe('abc')
  })

  it('skips empty lines', () => {
    const input = '\n{"commit":"abc","files":["x"],"timestamp":"","reviewer":"","taskId":""}\n\n'
    const entries = parseReviewLog(input)
    expect(entries).toHaveLength(1)
  })

  it('returns empty array for empty input', () => {
    expect(parseReviewLog('')).toEqual([])
  })
})

describe('validateReview', () => {
  const requiredPattern = 'src/lib/**/*.ts'

  it('passes when all changed files are reviewed', () => {
    const changed = ['src/lib/data.ts']
    const entries = [{
      commit: 'abc',
      files: ['src/lib/data.ts'],
      timestamp: '',
      reviewer: 'self',
      taskId: 'T-001',
    }]
    const res = validateReview(changed, entries, requiredPattern)
    expect(res.ok).toBe(true)
  })

  it('fails when a file requiring review has no log entry', () => {
    const changed = ['src/lib/data.ts']
    const res = validateReview(changed, [], requiredPattern)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(1)
    expect(res.violations[0].file).toBe('src/lib/data.ts')
  })

  it('ignores files outside required pattern', () => {
    const changed = ['src/components/footer.tsx', 'src/app/page.tsx']
    const res = validateReview(changed, [], requiredPattern)
    expect(res.ok).toBe(true)
  })

  it('matches even if log entry lists the file among multiple files', () => {
    const changed = ['src/lib/a.ts', 'src/lib/b.ts']
    const entries = [{
      commit: 'x',
      files: ['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts'],
      timestamp: '',
      reviewer: 'self',
      taskId: 'T-001',
    }]
    const res = validateReview(changed, entries, requiredPattern)
    expect(res.ok).toBe(true)
  })

  it('reports multiple unreviewed files', () => {
    const changed = ['src/lib/a.ts', 'src/lib/b.ts', 'src/lib/c.ts']
    const entries = [{
      commit: 'x',
      files: ['src/lib/a.ts'],
      timestamp: '',
      reviewer: 'self',
      taskId: 'T-001',
    }]
    const res = validateReview(changed, entries, requiredPattern)
    expect(res.ok).toBe(false)
    expect(res.violations).toHaveLength(2)
  })
})
