/**
 * constants/disclaimers.ts 테스트 (T-004)
 *
 * 업종별 면책 문구 분기. 잘못된 sector 로 호출 시 null 반환 → UI 미렌더.
 */
import { describe, it, expect } from 'vitest'
import { DISCLAIMERS, getDisclaimer } from '@/lib/constants/disclaimers'

describe('DISCLAIMERS map', () => {
  it('10개 sector 모두 정의 (medical/beauty/living/auto/education/professional/pet/wedding/leisure/food)', () => {
    const required = ['medical', 'beauty', 'living', 'auto', 'education', 'professional', 'pet', 'wedding', 'leisure', 'food']
    for (const sector of required) {
      expect(DISCLAIMERS).toHaveProperty(sector)
    }
  })

  it('medical 은 의료 전문의 문구 포함', () => {
    expect(DISCLAIMERS.medical).toContain('전문의')
  })

  it('food 는 null (미렌더)', () => {
    expect(DISCLAIMERS.food).toBeNull()
  })

  it('auto 는 차량 문구 포함', () => {
    expect(DISCLAIMERS.auto).toContain('차량')
  })
})

describe('getDisclaimer()', () => {
  it('존재하는 sector → 문구 반환', () => {
    expect(getDisclaimer('medical')).toContain('전문의')
    expect(getDisclaimer('beauty')).toContain('개인차')
  })

  it('null 인 sector (food) → null', () => {
    expect(getDisclaimer('food')).toBeNull()
  })

  it('정의되지 않은 sector → null (안전한 기본)', () => {
    expect(getDisclaimer('unknown')).toBeNull()
    expect(getDisclaimer('')).toBeNull()
  })
})
