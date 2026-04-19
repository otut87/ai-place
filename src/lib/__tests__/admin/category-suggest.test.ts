// T-127 — LLM 기반 카테고리 자동 입력 (스캐폴딩 + 휴리스틱 fallback).

import { describe, it, expect } from 'vitest'
import {
  suggestCategoryFromKorean,
  categorySuggestionToRow,
} from '@/lib/admin/category-suggest'

describe('suggestCategoryFromKorean (휴리스틱 fallback)', () => {
  it('"필라테스 스튜디오" → leisure/sports 섹터 + SportsActivityLocation 제안', () => {
    const s = suggestCategoryFromKorean('필라테스 스튜디오')
    expect(s.slug).toMatch(/pilates|studio/)
    expect(s.sector).toMatch(/leisure|education/)
    expect(s.schemaType).toMatch(/SportsActivityLocation|HealthClub/)
  })

  it('"세탁소" → laundry → DryCleaningOrLaundry', () => {
    const s = suggestCategoryFromKorean('세탁소')
    expect(s.slug).toContain('laundry')
    expect(s.schemaType).toBe('DryCleaningOrLaundry')
  })

  it('"치과" → dental → Dentist', () => {
    const s = suggestCategoryFromKorean('치과')
    expect(s.slug).toBe('dental')
    expect(s.schemaType).toBe('Dentist')
    expect(s.medicalSpecialty).toBe('Dentistry')
  })

  it('의료 카테고리는 compliance riskLevel=high 플래그', () => {
    const s = suggestCategoryFromKorean('피부과')
    expect(s.compliance?.riskLevel).toBe('high')
    expect(s.compliance?.law).toContain('의료법')
  })

  it('매핑 가능한 경우 이미 CATEGORY_SCHEMA_MAP 에 존재하면 dictionaryExists=true', () => {
    const s = suggestCategoryFromKorean('치과')
    expect(s.dictionaryExists).toBe(true)
  })

  it('알 수 없는 한글명 → dictionaryExists=false + LocalBusiness fallback 표시', () => {
    const s = suggestCategoryFromKorean('가상의업종')
    expect(s.dictionaryExists).toBe(false)
    expect(s.schemaType).toBe('LocalBusiness')
    expect(s.needsDictionaryUpdate).toBe(true)
  })

  it('한글명을 기반으로 slug 를 로마자로 변환 시도', () => {
    const s = suggestCategoryFromKorean('수영장')
    // 수영 → swim 또는 매핑 기반
    expect(s.slug).toBeTruthy()
    expect(s.slug.length).toBeGreaterThan(0)
  })
})

describe('categorySuggestionToRow', () => {
  it('제안 객체를 master-data.upsertCategory input 으로 변환', () => {
    const suggestion = {
      slug: 'pilates',
      nameKo: '필라테스',
      nameEn: 'Pilates',
      sector: 'leisure',
      schemaType: 'HealthClub',
      icon: 'Dumbbell',
      dictionaryExists: false,
      needsDictionaryUpdate: true,
    }
    const row = categorySuggestionToRow(suggestion)
    expect(row).toMatchObject({
      slug: 'pilates',
      name: '필라테스',
      nameEn: 'Pilates',
      sector: 'leisure',
      icon: 'Dumbbell',
    })
  })
})
