// T-121 — 83 카테고리 → Schema.org 타입 매핑 (단일 소스).
// 참조: docs/리뷰/SCHEMA_DATA_DICTIONARY.md §1
// 철학: "업종별 스키마 타입은 반드시 분기한다" + "pet/wedding LocalBusiness 폴백 금지".

/**
 * 카테고리 slug → Schema.org 타입.
 * 표준 Schema.org 타입이 없는 경우 가장 근접한 상위 타입 + `additionalType` 으로 표현.
 * `LocalBusiness` 는 폴백일 뿐이며, 신규 카테고리는 반드시 여기에 추가 (T-127 자동화).
 */
export const CATEGORY_SCHEMA_MAP: Record<string, string> = {
  // --- 의료 (14) ---
  dermatology: 'MedicalClinic',
  dental: 'Dentist',
  eye: 'MedicalClinic',
  orthopedics: 'MedicalClinic',
  'korean-medicine': 'MedicalClinic',
  ent: 'MedicalClinic',
  'internal-medicine': 'MedicalClinic',
  obgyn: 'MedicalClinic',
  pediatrics: 'MedicalClinic',
  psychiatry: 'MedicalClinic',
  rehabilitation: 'MedicalClinic',
  'plastic-surgery': 'MedicalClinic',
  urology: 'MedicalClinic',
  pharmacy: 'Pharmacy',

  // --- 뷰티 (9) ---
  hairsalon: 'HairSalon',
  nail: 'NailSalon',
  skincare: 'BeautySalon',
  lash: 'BeautySalon',
  waxing: 'BeautySalon',
  'semi-permanent': 'BeautySalon',
  barbershop: 'HairSalon',
  scalp: 'BeautySalon',
  diet: 'HealthClub',

  // --- 생활 (10) ---
  interior: 'HomeAndConstructionBusiness',
  moving: 'MovingCompany',
  cleaning: 'HomeAndConstructionBusiness',
  laundry: 'DryCleaningOrLaundry',
  repair: 'HomeAndConstructionBusiness',
  hardware: 'GeneralContractor',
  flower: 'Florist',
  'pest-control': 'HomeAndConstructionBusiness',
  locksmith: 'Locksmith',
  storage: 'SelfStorage',

  // --- 자동차 (8) ---
  'auto-repair': 'AutoRepair',
  'car-wash': 'AutoWash',
  tire: 'TireShop',
  detailing: 'AutoRepair',
  'import-repair': 'AutoRepair',
  scrap: 'AutomotiveBusiness',
  'used-car': 'AutoDealer',
  'car-rental': 'AutoRental',

  // --- 교육 (11) ---
  academy: 'EducationalOrganization',
  language: 'LanguageSchool',
  music: 'EducationalOrganization',
  art: 'EducationalOrganization',
  sports: 'SportsActivityLocation',
  coding: 'EducationalOrganization',
  vocational: 'EducationalOrganization',
  kindergarten: 'Preschool',
  taekwondo: 'SportsActivityLocation',
  swimming: 'SportsActivityLocation',
  studycafe: 'LocalBusiness',

  // --- 전문 (9) ---
  webagency: 'ProfessionalService',
  legal: 'LegalService',
  tax: 'AccountingService',
  realestate: 'RealEstateAgent',
  insurance: 'InsuranceAgency',
  printing: 'ProfessionalService',
  photo: 'ProfessionalService',
  designagency: 'ProfessionalService',
  marketing: 'ProfessionalService',

  // --- 반려동물 (5) — LocalBusiness 폴백 금지 ---
  vet: 'VeterinaryCare',
  grooming: 'LocalBusiness',
  'pet-hotel': 'LodgingBusiness',
  'pet-shop': 'PetStore',
  'pet-training': 'LocalBusiness',

  // --- 웨딩·행사 (5) — LocalBusiness 폴백 금지 ---
  'wedding-hall': 'EventVenue',
  'wedding-studio': 'ProfessionalService',
  dress: 'ClothingStore',
  funeral: 'FuneralHome',
  catering: 'FoodEstablishment',

  // --- 레저 (6) ---
  'kids-cafe': 'EntertainmentBusiness',
  karaoke: 'EntertainmentBusiness',
  bowling: 'BowlingAlley',
  sauna: 'HealthClub',
  'escape-room': 'EntertainmentBusiness',
  'pc-room': 'EntertainmentBusiness',

  // --- 음식 (6) ---
  restaurant: 'Restaurant',
  cafe: 'CafeOrCoffeeShop',
  bakery: 'Bakery',
  delivery: 'FoodEstablishment',
  bar: 'BarOrPub',
  buffet: 'Restaurant',
}

/**
 * 의료 소분류 → medicalSpecialty (ITU 표준 enum).
 */
const MEDICAL_SPECIALTY_MAP: Record<string, string> = {
  dermatology: 'Dermatology',
  dental: 'Dentistry',
  eye: 'Optometric',
  orthopedics: 'Orthopedic',
  'korean-medicine': 'TraditionalChineseMedicine',
  ent: 'Otolaryngologic',
  'internal-medicine': 'InternalMedicine',
  obgyn: 'Obstetric',
  pediatrics: 'Pediatric',
  psychiatry: 'Psychiatric',
  rehabilitation: 'PhysicalTherapy',
  'plastic-surgery': 'PlasticSurgery',
  urology: 'Urologic',
  pharmacy: 'CommunityHealth',
}

/**
 * 카테고리 slug → Schema.org 타입.
 * 미등록 slug 는 'LocalBusiness' 폴백 (dev 경고 + SCHEMA_DATA_DICTIONARY 업데이트 필요).
 */
export function getCategorySchemaType(categorySlug: string): string {
  const type = CATEGORY_SCHEMA_MAP[categorySlug]
  if (type) return type
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[category-schema] unknown slug "${categorySlug}" — falling back to LocalBusiness. ` +
        'Update docs/리뷰/SCHEMA_DATA_DICTIONARY.md §1 and CATEGORY_SCHEMA_MAP.',
    )
  }
  return 'LocalBusiness'
}

/**
 * 의료 카테고리의 medicalSpecialty 값. 비의료는 null.
 */
export function getMedicalSpecialty(categorySlug: string): string | null {
  return MEDICAL_SPECIALTY_MAP[categorySlug] ?? null
}

export interface SchemaTypeExtras {
  /** JSON-LD 에 반드시 포함되어야 하는 필드 (없으면 Rich Results 경고) */
  requiredFields: string[]
  /** 권장 필드 */
  recommendedFields: string[]
}

/**
 * 타입별 필수·권장 필드 힌트. 데이터 사전 §2 구현.
 */
export function getSchemaTypeExtras(categorySlug: string): SchemaTypeExtras {
  const type = getCategorySchemaType(categorySlug)
  const isMedical = MEDICAL_SPECIALTY_MAP[categorySlug] !== undefined

  if (isMedical) {
    return {
      requiredFields: ['medicalSpecialty', 'address'],
      recommendedFields: ['aggregateRating', 'openingHoursSpecification', 'geo', 'hasOfferCatalog'],
    }
  }

  switch (type) {
    case 'Restaurant':
    case 'CafeOrCoffeeShop':
    case 'Bakery':
    case 'BarOrPub':
    case 'FoodEstablishment':
      return {
        requiredFields: ['address'],
        recommendedFields: ['servesCuisine', 'menu', 'priceRange', 'acceptsReservations'],
      }
    case 'EducationalOrganization':
    case 'LanguageSchool':
    case 'Preschool':
      return {
        requiredFields: ['address'],
        recommendedFields: ['teaches', 'educationalLevel', 'offers'],
      }
    case 'AutoRepair':
    case 'AutoDealer':
    case 'AutoRental':
    case 'AutomotiveBusiness':
    case 'TireShop':
    case 'AutoWash':
      return {
        requiredFields: ['address'],
        recommendedFields: ['brand', 'hasOfferCatalog', 'areaServed'],
      }
    case 'LegalService':
    case 'AccountingService':
    case 'RealEstateAgent':
    case 'InsuranceAgency':
      return {
        requiredFields: ['address'],
        recommendedFields: ['knowsAbout', 'serviceType', 'areaServed'],
      }
    case 'BeautySalon':
    case 'HairSalon':
    case 'NailSalon':
      return {
        requiredFields: ['address'],
        recommendedFields: ['priceRange', 'hasOfferCatalog', 'paymentAccepted'],
      }
    default:
      return {
        requiredFields: ['address'],
        recommendedFields: ['aggregateRating', 'openingHoursSpecification', 'geo'],
      }
  }
}
