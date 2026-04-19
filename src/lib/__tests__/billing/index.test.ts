import { describe, it, expect, afterEach } from 'vitest'
import { getPgAdapter } from '@/lib/billing'

describe('getPgAdapter', () => {
  const ORIGINAL = process.env.BILLING_ADAPTER

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.BILLING_ADAPTER
    else process.env.BILLING_ADAPTER = ORIGINAL
  })

  it('BILLING_ADAPTER=mock → mock 어댑터', () => {
    process.env.BILLING_ADAPTER = 'mock'
    expect(getPgAdapter().provider).toBe('mock')
  })

  it('그 외 → toss 어댑터', () => {
    process.env.BILLING_ADAPTER = 'toss'
    expect(getPgAdapter().provider).toBe('toss')
  })

  it('미설정 → toss 기본', () => {
    delete process.env.BILLING_ADAPTER
    expect(getPgAdapter().provider).toBe('toss')
  })
})
