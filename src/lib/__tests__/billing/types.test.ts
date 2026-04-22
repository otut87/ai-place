import { describe, it, expect } from 'vitest'
import { STANDARD_PLAN_AMOUNT, STANDARD_PLAN_NAME } from '@/lib/billing/types'

describe('billing/types constants', () => {
  it('STANDARD_PLAN_AMOUNT = 9,900원 (T-205 단일 요금제)', () => {
    expect(STANDARD_PLAN_AMOUNT).toBe(9900)
  })

  it('STANDARD_PLAN_NAME = standard', () => {
    expect(STANDARD_PLAN_NAME).toBe('standard')
  })
})
