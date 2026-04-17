import { describe, it, expect } from 'vitest'
import {
  extractTaskRefs,
  parseTaskStatusFromDoc,
  validateTaskStatus,
} from '../gates/task-status'

describe('extractTaskRefs', () => {
  it('extracts T-NNN refs from commit message', () => {
    expect(extractTaskRefs('feat: T-001 add tests')).toEqual(['T-001'])
  })

  it('extracts multiple refs', () => {
    expect(extractTaskRefs('refactor: T-001 T-002 combined')).toEqual(['T-001', 'T-002'])
  })

  it('deduplicates refs', () => {
    expect(extractTaskRefs('T-001 fix T-001 again')).toEqual(['T-001'])
  })

  it('returns empty when no refs', () => {
    expect(extractTaskRefs('WIP change')).toEqual([])
  })

  it('only matches T-NNN or T-NNNa (ignores T-NN or T-NNNN)', () => {
    expect(extractTaskRefs('T-001 T-01 T-0001')).toEqual(['T-001'])
  })

  it('extracts sub-task refs like T-010a', () => {
    expect(extractTaskRefs('feat: T-010a blog 확장')).toEqual(['T-010a'])
  })

  it('distinguishes T-010 from T-010a', () => {
    expect(extractTaskRefs('T-010 and T-010a are different')).toEqual(['T-010', 'T-010a'])
  })
})

describe('parseTaskStatusFromDoc', () => {
  const doc = `
## T-001. Foo 작업 [SEO]

스펙...

## T-002. Bar 작업 🔜

대기중

## T-003. Baz 작업 ✅

완료

## T-004. Qux 작업 ⏳

진행중
`

  it('extracts status for each TASK ID', () => {
    const statuses = parseTaskStatusFromDoc(doc)
    expect(statuses['T-001']).toBe('unknown')
    expect(statuses['T-002']).toBe('pending')
    expect(statuses['T-003']).toBe('completed')
    expect(statuses['T-004']).toBe('in_progress')
  })
})

describe('validateTaskStatus', () => {
  const statuses: Record<string, 'pending' | 'in_progress' | 'completed' | 'unknown'> = {
    'T-001': 'in_progress',
    'T-002': 'completed',
    'T-003': 'pending',
    'T-004': 'unknown',
  }

  it('passes when all referenced tasks are in_progress or completed', () => {
    const res = validateTaskStatus(['T-001', 'T-002'], statuses)
    expect(res.ok).toBe(true)
  })

  it('fails when referenced task is still pending', () => {
    const res = validateTaskStatus(['T-003'], statuses)
    expect(res.ok).toBe(false)
    expect(res.violations[0].taskId).toBe('T-003')
    expect(res.violations[0].reason).toBe('not_started')
  })

  it('fails when referenced task is unknown (no marker)', () => {
    const res = validateTaskStatus(['T-004'], statuses)
    expect(res.ok).toBe(false)
    expect(res.violations[0].reason).toBe('status_marker_missing')
  })

  it('fails when referenced task does not exist in doc', () => {
    const res = validateTaskStatus(['T-999'], statuses)
    expect(res.ok).toBe(false)
    expect(res.violations[0].reason).toBe('not_in_doc')
  })

  it('passes with empty refs', () => {
    const res = validateTaskStatus([], statuses)
    expect(res.ok).toBe(true)
  })
})
