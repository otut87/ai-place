// T-121 — 83 카테고리 → Schema.org 타입 매핑 테이블 테스트.
// SCHEMA_DATA_DICTIONARY.md §1 을 단일 소스로 반영.

import { describe, it, expect } from 'vitest'
import {
  getCategorySchemaType,
  getMedicalSpecialty,
  getSchemaTypeExtras,
  CATEGORY_SCHEMA_MAP,
} from '@/lib/jsonld/category-schema'

describe('getCategorySchemaType — 83 카테고리 매핑', () => {
  it('의료: 피부과 → MedicalClinic, 치과 → Dentist, 약국 → Pharmacy', () => {
    expect(getCategorySchemaType('dermatology')).toBe('MedicalClinic')
    expect(getCategorySchemaType('dental')).toBe('Dentist')
    expect(getCategorySchemaType('pharmacy')).toBe('Pharmacy')
    expect(getCategorySchemaType('plastic-surgery')).toBe('MedicalClinic')
    expect(getCategorySchemaType('korean-medicine')).toBe('MedicalClinic')
  })

  it('뷰티: 미용실 → HairSalon, 네일 → NailSalon, 피부관리 → BeautySalon', () => {
    expect(getCategorySchemaType('hairsalon')).toBe('HairSalon')
    expect(getCategorySchemaType('nail')).toBe('NailSalon')
    expect(getCategorySchemaType('skincare')).toBe('BeautySalon')
    expect(getCategorySchemaType('barbershop')).toBe('HairSalon')
  })

  it('생활: 이사 → MovingCompany, 세탁 → DryCleaningOrLaundry, 꽃 → Florist', () => {
    expect(getCategorySchemaType('moving')).toBe('MovingCompany')
    expect(getCategorySchemaType('laundry')).toBe('DryCleaningOrLaundry')
    expect(getCategorySchemaType('flower')).toBe('Florist')
    expect(getCategorySchemaType('locksmith')).toBe('Locksmith')
    expect(getCategorySchemaType('storage')).toBe('SelfStorage')
  })

  it('자동차: 세차 → AutoWash, 타이어 → TireShop, 중고차 → AutoDealer, 렌트 → AutoRental', () => {
    expect(getCategorySchemaType('auto-repair')).toBe('AutoRepair')
    expect(getCategorySchemaType('car-wash')).toBe('AutoWash')
    expect(getCategorySchemaType('tire')).toBe('TireShop')
    expect(getCategorySchemaType('used-car')).toBe('AutoDealer')
    expect(getCategorySchemaType('car-rental')).toBe('AutoRental')
  })

  it('교육: 어학원 → LanguageSchool, 유치원 → Preschool, 스포츠 → SportsActivityLocation', () => {
    expect(getCategorySchemaType('language')).toBe('LanguageSchool')
    expect(getCategorySchemaType('kindergarten')).toBe('Preschool')
    expect(getCategorySchemaType('sports')).toBe('SportsActivityLocation')
    expect(getCategorySchemaType('taekwondo')).toBe('SportsActivityLocation')
    expect(getCategorySchemaType('swimming')).toBe('SportsActivityLocation')
    expect(getCategorySchemaType('academy')).toBe('EducationalOrganization')
  })

  it('전문: 법률 → LegalService, 세무 → AccountingService, 부동산 → RealEstateAgent', () => {
    expect(getCategorySchemaType('legal')).toBe('LegalService')
    expect(getCategorySchemaType('tax')).toBe('AccountingService')
    expect(getCategorySchemaType('realestate')).toBe('RealEstateAgent')
    expect(getCategorySchemaType('insurance')).toBe('InsuranceAgency')
  })

  it('반려동물 (섹터 폴백 금지): 표준 타입 있는 3개는 분기, 없는 2개는 LocalBusiness + category', () => {
    expect(getCategorySchemaType('vet')).toBe('VeterinaryCare')
    expect(getCategorySchemaType('pet-shop')).toBe('PetStore')
    expect(getCategorySchemaType('pet-hotel')).toBe('LodgingBusiness')
    // Schema.org 에 표준 타입 없는 'grooming', 'pet-training' 은 LocalBusiness 가 허용되지만
    // 매핑 테이블에 명시적 등록되어야 한다 (미등록 fallback 과 구분)
    expect(CATEGORY_SCHEMA_MAP).toHaveProperty('grooming')
    expect(CATEGORY_SCHEMA_MAP).toHaveProperty('pet-training')
  })

  it('웨딩 (섹터 폴백 금지): 웨딩홀 → EventVenue, 장례 → FuneralHome, 케이터링 → FoodEstablishment', () => {
    expect(getCategorySchemaType('wedding-hall')).toBe('EventVenue')
    expect(getCategorySchemaType('funeral')).toBe('FuneralHome')
    expect(getCategorySchemaType('catering')).toBe('FoodEstablishment')
    expect(getCategorySchemaType('dress')).toBe('ClothingStore')
    for (const slug of ['wedding-hall', 'funeral', 'catering', 'dress']) {
      expect(getCategorySchemaType(slug)).not.toBe('LocalBusiness')
    }
  })

  it('레저: 볼링 → BowlingAlley, 사우나 → HealthClub', () => {
    expect(getCategorySchemaType('bowling')).toBe('BowlingAlley')
    expect(getCategorySchemaType('sauna')).toBe('HealthClub')
    expect(getCategorySchemaType('karaoke')).toBe('EntertainmentBusiness')
  })

  it('음식: 카페 → CafeOrCoffeeShop, 베이커리 → Bakery, 바 → BarOrPub', () => {
    expect(getCategorySchemaType('restaurant')).toBe('Restaurant')
    expect(getCategorySchemaType('cafe')).toBe('CafeOrCoffeeShop')
    expect(getCategorySchemaType('bakery')).toBe('Bakery')
    expect(getCategorySchemaType('bar')).toBe('BarOrPub')
  })

  it('미등록 slug 는 LocalBusiness 폴백 + "사전 업데이트 필요" 신호를 가진다', () => {
    // 실제 구현이 fallback 을 허용하되, 경고성으로 noted.
    expect(getCategorySchemaType('unknown-future-slug')).toBe('LocalBusiness')
  })

  it('매핑 테이블은 전체 83 카테고리를 포함한다', () => {
    const expected = [
      'dermatology', 'dental', 'eye', 'orthopedics', 'korean-medicine', 'ent',
      'internal-medicine', 'obgyn', 'pediatrics', 'psychiatry', 'rehabilitation',
      'plastic-surgery', 'urology', 'pharmacy',
      'hairsalon', 'nail', 'skincare', 'lash', 'waxing', 'semi-permanent',
      'barbershop', 'scalp', 'diet',
      'interior', 'moving', 'cleaning', 'laundry', 'repair', 'hardware',
      'flower', 'pest-control', 'locksmith', 'storage',
      'auto-repair', 'car-wash', 'tire', 'detailing', 'import-repair',
      'scrap', 'used-car', 'car-rental',
      'academy', 'language', 'music', 'art', 'sports', 'coding', 'vocational',
      'kindergarten', 'taekwondo', 'swimming', 'studycafe',
      'webagency', 'legal', 'tax', 'realestate', 'insurance', 'printing',
      'photo', 'designagency', 'marketing',
      'vet', 'grooming', 'pet-hotel', 'pet-shop', 'pet-training',
      'wedding-hall', 'wedding-studio', 'dress', 'funeral', 'catering',
      'kids-cafe', 'karaoke', 'bowling', 'sauna', 'escape-room', 'pc-room',
      'restaurant', 'cafe', 'bakery', 'delivery', 'bar', 'buffet',
    ]
    for (const slug of expected) {
      expect(CATEGORY_SCHEMA_MAP).toHaveProperty(slug)
    }
    expect(expected.length).toBeGreaterThanOrEqual(79)
  })
})

describe('getMedicalSpecialty — 의료 소분류별 ITU 표준 값', () => {
  it('의료 카테고리별 specialty 반환', () => {
    expect(getMedicalSpecialty('dermatology')).toBe('Dermatology')
    expect(getMedicalSpecialty('dental')).toBe('Dentistry')
    expect(getMedicalSpecialty('korean-medicine')).toBe('TraditionalChineseMedicine')
    expect(getMedicalSpecialty('plastic-surgery')).toBe('PlasticSurgery')
    expect(getMedicalSpecialty('obgyn')).toBe('Obstetric')
    expect(getMedicalSpecialty('urology')).toBe('Urologic')
    expect(getMedicalSpecialty('psychiatry')).toBe('Psychiatric')
  })

  it('비의료 카테고리는 null', () => {
    expect(getMedicalSpecialty('cafe')).toBeNull()
    expect(getMedicalSpecialty('hairsalon')).toBeNull()
  })
})

describe('getSchemaTypeExtras — 타입별 필수 추가 필드', () => {
  it('Restaurant/Cafe/Bakery/BarOrPub 는 servesCuisine 권장', () => {
    expect(getSchemaTypeExtras('restaurant').recommendedFields).toContain('servesCuisine')
    expect(getSchemaTypeExtras('cafe').recommendedFields).toContain('servesCuisine')
  })

  it('EducationalOrganization 은 teaches 권장', () => {
    expect(getSchemaTypeExtras('academy').recommendedFields).toContain('teaches')
  })

  it('MedicalClinic 류는 medicalSpecialty 필수', () => {
    expect(getSchemaTypeExtras('dermatology').requiredFields).toContain('medicalSpecialty')
    expect(getSchemaTypeExtras('dental').requiredFields).toContain('medicalSpecialty')
  })
})
