// T-127 — LLM 기반 카테고리·도시 마스터 자동 입력.
//
// 현재 구현: 휴리스틱 매핑 (한글→slug) + SCHEMA_DATA_DICTIONARY §1 룩업.
// Future: Claude Sonnet + tool use 로 확장 (WebFetch schema.org docs).
//         lookupSchemaOrgType / checkDictionary / fetchSchemaOrgDoc 도구 정의.
//
// 참조 문서:
// - docs/리뷰/SCHEMA_DATA_DICTIONARY.md §1~§4
// - Schema.org /docs/full.html

import { CATEGORY_SCHEMA_MAP, getMedicalSpecialty } from '@/lib/jsonld/category-schema'
import { normalizeSlug } from '@/lib/admin/master-data'

export interface CategorySuggestion {
  slug: string
  nameKo: string
  nameEn: string
  sector: string
  schemaType: string
  icon?: string
  medicalSpecialty?: string
  compliance?: {
    riskLevel: 'low' | 'medium' | 'high'
    law: string[]
    guard: string[]
  }
  /** 데이터 사전 §1 에 이미 등록된 slug 인지 */
  dictionaryExists: boolean
  /** 미등록 → SCHEMA_DATA_DICTIONARY 업데이트 필요 플래그 */
  needsDictionaryUpdate: boolean
  /** LLM 제안 근거 (현재: 휴리스틱 매칭, Future: Claude 응답) */
  reasoning?: string
}

// 한글 → slug 휴리스틱 매핑 (신규 업종 패턴).
// SCHEMA_DATA_DICTIONARY 83 카테고리에 포함되지 않은 경우의 힌트.
const KOREAN_TO_SLUG_HINTS: Array<{ pattern: RegExp; slug: string; sector: string; schemaType: string; icon?: string }> = [
  { pattern: /필라테스|요가|pilates|yoga/i, slug: 'pilates', sector: 'leisure', schemaType: 'HealthClub', icon: 'Dumbbell' },
  { pattern: /세탁|laundry/i, slug: 'laundry', sector: 'living', schemaType: 'DryCleaningOrLaundry' },
  { pattern: /피부과|dermatology/i, slug: 'dermatology', sector: 'medical', schemaType: 'MedicalClinic' },
  { pattern: /치과|dental/i, slug: 'dental', sector: 'medical', schemaType: 'Dentist' },
  { pattern: /약국|pharmacy/i, slug: 'pharmacy', sector: 'medical', schemaType: 'Pharmacy' },
  { pattern: /동물병원|vet/i, slug: 'vet', sector: 'pet', schemaType: 'VeterinaryCare' },
  { pattern: /수영|swim/i, slug: 'swimming', sector: 'education', schemaType: 'SportsActivityLocation' },
  { pattern: /카페|cafe/i, slug: 'cafe', sector: 'food', schemaType: 'CafeOrCoffeeShop' },
  { pattern: /미용실|hair\s*salon/i, slug: 'hairsalon', sector: 'beauty', schemaType: 'HairSalon' },
  { pattern: /네일|nail/i, slug: 'nail', sector: 'beauty', schemaType: 'NailSalon' },
]

// 한글명을 영문으로 변환 힌트.
const KOREAN_TO_ENGLISH: Record<string, string> = {
  필라테스: 'Pilates',
  요가: 'Yoga',
  세탁: 'Laundry',
  세탁소: 'Laundry',
  피부과: 'Dermatology',
  치과: 'Dental',
  약국: 'Pharmacy',
  동물병원: 'Veterinary',
  수영장: 'Swimming Pool',
  카페: 'Cafe',
  미용실: 'Hair Salon',
  네일샵: 'Nail Salon',
  스튜디오: 'Studio',
}

// 의료 섹터 감지 패턴 (T-085 컴플라이언스 자동 플래그).
const MEDICAL_KEYWORDS = /피부과|치과|한의원|정형외과|내과|소아과|안과|이비인후과|산부인과|정신건강|비뇨기|성형외과|재활/
const LEGAL_KEYWORDS = /변호사|법률|법무/
const TAX_KEYWORDS = /세무|회계/

function romanize(korean: string): string {
  const mapped = KOREAN_TO_ENGLISH[korean.trim()]
  if (mapped) {
    return normalizeSlug(mapped.toLowerCase().replace(/\s+/g, '-'))
  }
  // fallback: 한글 문자 제거 후 나머지 사용 (영문 혼합 입력 대응)
  const asciiOnly = korean.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
  if (asciiOnly) return normalizeSlug(asciiOnly.toLowerCase().replace(/\s+/g, '-'))
  return normalizeSlug(korean) // 한글만 있으면 빈 문자열 반환 (관리자 수동 입력 유도)
}

/**
 * 한글 카테고리명 → 제안 필드.
 * 1. SCHEMA_DATA_DICTIONARY §1 에 이미 있는 slug 인지 매칭
 * 2. 없으면 휴리스틱 hint 로 추론
 * 3. 그래도 모르면 LocalBusiness fallback + dictionary 업데이트 플래그
 */
export function suggestCategoryFromKorean(koreanName: string): CategorySuggestion {
  const trimmed = koreanName.trim()

  // 1. 휴리스틱 hint 매칭
  const hint = KOREAN_TO_SLUG_HINTS.find(h => h.pattern.test(trimmed))
  const candidateSlug = hint?.slug ?? romanize(trimmed)
  const dictionaryExists = Boolean(CATEGORY_SCHEMA_MAP[candidateSlug])

  // 2. sector / schemaType 결정
  let sector: string
  let schemaType: string
  let icon: string | undefined = hint?.icon

  if (dictionaryExists) {
    schemaType = CATEGORY_SCHEMA_MAP[candidateSlug]
    sector = hint?.sector ?? inferSectorFromSlug(candidateSlug)
  } else if (hint) {
    sector = hint.sector
    schemaType = hint.schemaType
  } else {
    sector = 'living'
    schemaType = 'LocalBusiness'
  }

  // 3. 영문명
  const nameEn = KOREAN_TO_ENGLISH[trimmed]
    ?? trimmed.replace(/[^a-zA-Z0-9\s-]/g, '').trim()
    ?? ''

  // 4. 의료 specialty
  const medicalSpecialty = getMedicalSpecialty(candidateSlug) ?? undefined

  // 5. 컴플라이언스 감지
  let compliance: CategorySuggestion['compliance']
  if (MEDICAL_KEYWORDS.test(trimmed) || sector === 'medical') {
    compliance = {
      riskLevel: 'high',
      law: ['의료법', '의료광고법'],
      guard: ['가격 "상담 문의" 강제', '금칙어 필터 (T-085)', '시술 전후 사진 금지'],
    }
  } else if (LEGAL_KEYWORDS.test(trimmed)) {
    compliance = {
      riskLevel: 'medium',
      law: ['변호사법 §23'],
      guard: ['"승소 보장" 등 과장 광고 금지'],
    }
  } else if (TAX_KEYWORDS.test(trimmed)) {
    compliance = {
      riskLevel: 'medium',
      law: ['세무사법'],
      guard: [],
    }
  } else {
    compliance = { riskLevel: 'low', law: [], guard: [] }
  }

  return {
    slug: candidateSlug,
    nameKo: trimmed,
    nameEn,
    sector,
    schemaType,
    icon,
    medicalSpecialty,
    compliance,
    dictionaryExists,
    needsDictionaryUpdate: !dictionaryExists,
    reasoning: dictionaryExists
      ? `SCHEMA_DATA_DICTIONARY §1 에 등록된 "${candidateSlug}" 매칭`
      : hint
        ? `휴리스틱 매칭 (${hint.pattern.source}) — 사전 업데이트 필요`
        : '매핑 불가 — 관리자 검토 후 사전 업데이트 필요',
  }
}

function inferSectorFromSlug(slug: string): string {
  // 간단한 prefix 기반 추론 (fallback)
  if (/^(pet-|grooming|vet)/.test(slug)) return 'pet'
  if (/^(wedding|dress|funeral|catering)/.test(slug)) return 'wedding'
  if (/^(auto-|car-|tire|detailing|scrap|used-car)/.test(slug)) return 'auto'
  if (/(cafe|restaurant|bakery|bar|buffet|delivery)/.test(slug)) return 'food'
  if (/^(kids-|karaoke|bowling|sauna|escape|pc-room)/.test(slug)) return 'leisure'
  if (/^(webagency|legal|tax|realestate|insurance|printing|photo|design|marketing)/.test(slug)) return 'professional'
  if (/(academy|language|music|art|sports|coding|vocational|kindergarten|taekwondo|swimming|studycafe)/.test(slug)) return 'education'
  if (/(hairsalon|nail|skincare|lash|waxing|semi-permanent|barbershop|scalp|diet)/.test(slug)) return 'beauty'
  return 'living'
}

/**
 * 제안을 master-data.upsertCategory input 으로 변환.
 */
export function categorySuggestionToRow(s: CategorySuggestion): {
  slug: string
  name: string
  nameEn: string
  sector: string
  icon: string | null
} {
  return {
    slug: s.slug,
    name: s.nameKo,
    nameEn: s.nameEn,
    sector: s.sector,
    icon: s.icon ?? null,
  }
}
