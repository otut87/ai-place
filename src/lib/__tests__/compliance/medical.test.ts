import { describe, it, expect } from 'vitest'
import {
  isMedicalCategory,
  findMedicalViolations,
  enforceConsultPrice,
  MEDICAL_DISCLAIMER,
} from '@/lib/compliance/medical'

describe('isMedicalCategory', () => {
  it('의료 카테고리', () => {
    expect(isMedicalCategory('dermatology')).toBe(true)
    expect(isMedicalCategory('dental')).toBe(true)
    expect(isMedicalCategory('plastic-surgery')).toBe(true)
  })

  it('비의료', () => {
    expect(isMedicalCategory('hair-salon')).toBe(false)
    expect(isMedicalCategory(null)).toBe(false)
    expect(isMedicalCategory(undefined)).toBe(false)
  })
})

describe('findMedicalViolations', () => {
  it('최상급 표현 감지', () => {
    const v = findMedicalViolations('천안 최고의 피부과')
    expect(v).toHaveLength(1)
    expect(v[0].reason).toContain('최상급')
  })

  it('치료효과 보장 감지', () => {
    const v = findMedicalViolations('여드름 100% 완치 보장')
    expect(v.length).toBeGreaterThan(0)
  })

  it('"안전" 단독 → 감지, "안전성" → 통과', () => {
    expect(findMedicalViolations('안전한 시술')).toHaveLength(1)
    expect(findMedicalViolations('안전성이 검증된 시술')).toHaveLength(0)
  })

  it('부작용 없음 감지', () => {
    const v = findMedicalViolations('부작용 없는 시술')
    expect(v.length).toBeGreaterThan(0)
  })

  it('정상 표현 → 위반 없음', () => {
    expect(findMedicalViolations('여드름 관리, 리프팅 시술 안내')).toHaveLength(0)
  })
})

describe('enforceConsultPrice', () => {
  it('의료 카테고리 → 상담 문의 강제', () => {
    const r = enforceConsultPrice('dermatology', { name: '여드름 레이저', price: '100000' })
    expect(r.price).toBe('상담 문의')
  })

  it('비의료 → 원본 유지', () => {
    const r = enforceConsultPrice('hair-salon', { name: '컷', price: '20000' })
    expect(r.price).toBe('20000')
  })

  it('가격 없음 → 변환 안 함', () => {
    const r = enforceConsultPrice('dermatology', { name: '상담' })
    expect(r.price).toBeUndefined()
  })
})

describe('MEDICAL_DISCLAIMER', () => {
  it('의료진 상담 문구 포함', () => {
    expect(MEDICAL_DISCLAIMER).toContain('의료진')
  })
})
