import { describe, it, expect } from 'vitest'
import { STANDARD_PLAN_AMOUNT, STANDARD_PLAN_NAME } from '@/lib/billing/types'

describe('billing/types constants', () => {
  it('STANDARD_PLAN_AMOUNT = 14,900원 (T-206 단일 요금제 최종)', () => {
    expect(STANDARD_PLAN_AMOUNT).toBe(14900)
  })

  it('STANDARD_PLAN_NAME = standard', () => {
    expect(STANDARD_PLAN_NAME).toBe('standard')
  })
})
