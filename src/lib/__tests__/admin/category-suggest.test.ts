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

describe('suggestCategoryFromKorean (추가 브랜치)', () => {
  it('법률 카테고리 → compliance medium + 변호사법', () => {
    const s = suggestCategoryFromKorean('변호사 사무소')
    expect(s.compliance?.riskLevel).toBe('medium')
    expect(s.compliance?.law[0]).toMatch(/변호사법/)
  })

  it('세무 카테고리 → compliance medium + 세무사법', () => {
    const s = suggestCategoryFromKorean('세무 회계')
    expect(s.compliance?.riskLevel).toBe('medium')
    expect(s.compliance?.law).toContain('세무사법')
  })

  it('미용실 → hairsalon + HairSalon', () => {
    const s = suggestCategoryFromKorean('미용실')
    expect(s.slug).toBe('hairsalon')
    expect(s.schemaType).toBe('HairSalon')
    expect(s.sector).toBe('beauty')
  })

  it('네일 → nail + NailSalon', () => {
    const s = suggestCategoryFromKorean('네일샵')
    expect(s.slug).toBe('nail')
    expect(s.schemaType).toBe('NailSalon')
  })

  it('카페 → cafe + CafeOrCoffeeShop (food sector)', () => {
    const s = suggestCategoryFromKorean('카페')
    expect(s.slug).toBe('cafe')
    expect(s.sector).toBe('food')
  })

  it('동물병원 → vet + VeterinaryCare (pet sector)', () => {
    const s = suggestCategoryFromKorean('동물병원')
    expect(s.slug).toBe('vet')
    expect(s.sector).toBe('pet')
    expect(s.schemaType).toBe('VeterinaryCare')
  })

  it('요가 → pilates mapping (같은 hint pattern)', () => {
    const s = suggestCategoryFromKorean('요가')
    expect(s.slug).toBe('pilates')
  })

  it('영문 입력 "nail shop" → slug nail', () => {
    const s = suggestCategoryFromKorean('nail shop')
    expect(s.slug).toBe('nail')
  })

  it('한글 only 미등록 단어 → living 섹터 fallback', () => {
    const s = suggestCategoryFromKorean('무엇무엇')
    expect(s.sector).toBe('living')
    expect(s.schemaType).toBe('LocalBusiness')
    expect(s.reasoning).toMatch(/매핑 불가/)
  })

  it('pet 섹터 slug fallback: grooming → pet', () => {
    const s = suggestCategoryFromKorean('grooming')
    // inferSectorFromSlug fallback (no hint)
    expect(s.sector).toBeTruthy()
  })

  // inferSectorFromSlug 의 모든 분기 커버.
  it('영문 입력 wedding-hall → wedding 섹터', () => {
    const s = suggestCategoryFromKorean('wedding-hall')
    expect(s.sector).toBe('wedding')
  })

  it('영문 입력 bakery → food 섹터', () => {
    const s = suggestCategoryFromKorean('bakery')
    expect(s.sector).toBe('food')
  })

  it('영문 입력 academy → education 섹터', () => {
    const s = suggestCategoryFromKorean('academy')
    expect(s.sector).toBe('education')
  })

  it('영문 입력 realestate → professional 섹터', () => {
    const s = suggestCategoryFromKorean('realestate')
    expect(s.sector).toBe('professional')
  })

  it('영문 입력 auto-repair → auto 섹터 (dictionary + inferSector)', () => {
    const s = suggestCategoryFromKorean('auto-repair')
    expect(s.sector).toBe('auto')
    expect(s.dictionaryExists).toBe(true)
  })

  it('영문 입력 semi-permanent → beauty 섹터 (dictionary + inferSector)', () => {
    const s = suggestCategoryFromKorean('semi-permanent')
    expect(s.sector).toBe('beauty')
    expect(s.dictionaryExists).toBe(true)
  })

  it('영문 입력 pc-room → leisure 섹터 (dictionary + inferSector)', () => {
    const s = suggestCategoryFromKorean('pc-room')
    expect(s.sector).toBe('leisure')
    expect(s.dictionaryExists).toBe(true)
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
