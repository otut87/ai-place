import { describe, it, expect } from 'vitest'
import { STANDARD_PLAN_AMOUNT, STANDARD_PLAN_NAME } from '@/lib/billing/types'

describe('billing/types constants', () => {
  it('STANDARD_PLAN_AMOUNT = 33,000원', () => {
    expect(STANDARD_PLAN_AMOUNT).toBe(33000)
  })

  it('STANDARD_PLAN_NAME = standard', () => {
    expect(STANDARD_PLAN_NAME).toBe('standard')
  })
})
