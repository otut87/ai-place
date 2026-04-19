import { describe, it, expect } from 'vitest'
import { JOB_STATUS_LABEL, jobStatusTone } from '@/lib/admin/pipeline-jobs'

describe('JOB_STATUS_LABEL', () => {
  it('5가지 상태 모두 한국어', () => {
    expect(JOB_STATUS_LABEL.pending).toBe('대기')
    expect(JOB_STATUS_LABEL.running).toBe('실행 중')
    expect(JOB_STATUS_LABEL.succeeded).toBe('성공')
    expect(JOB_STATUS_LABEL.failed).toBe('실패')
    expect(JOB_STATUS_LABEL.canceled).toBe('취소')
  })
})

describe('jobStatusTone', () => {
  it('상태 → tone', () => {
    expect(jobStatusTone('succeeded')).toBe('ok')
    expect(jobStatusTone('failed')).toBe('danger')
    expect(jobStatusTone('running')).toBe('warn')
    expect(jobStatusTone('pending')).toBe('warn')
    expect(jobStatusTone('canceled')).toBe('muted')
  })
})
