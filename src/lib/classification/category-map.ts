// 카테고리 매핑 테이블 (T-015)
// 외부 소스의 카테고리 → AI Place 의 category slug.

/**
 * Kakao category_name 매핑.
 * Kakao 는 ">" 로 구분된 계층 문자열 ("의료,건강 > 병원 > 피부과")을 반환.
 * 정확 매칭 실패 시 마지막 레벨을 사용하는 fuzzy 폴백.
 */
export const KAKAO_CATEGORY_MAP: Record<string, string> = {
  '의료,건강 > 병원 > 피부과': 'dermatology',
  '의료,건강 > 병원 > 치과': 'dental',
  '의료,건강 > 병원 > 안과': 'eye',
  '의료,건강 > 병원 > 정형외과': 'orthopedics',
  '의료,건강 > 병원 > 한의원': 'korean-medicine',
  '의료,건강 > 병원 > 이비인후과': 'ent',
  '의료,건강 > 병원 > 내과': 'internal-medicine',
  '의료,건강 > 병원 > 산부인과': 'obgyn',
  '의료,건강 > 병원 > 소아청소년과': 'pediatrics',
  '의료,건강 > 병원 > 소아과': 'pediatrics',
  '의료,건강 > 병원 > 정신건강의학과': 'psychiatry',
  '의료,건강 > 병원 > 재활의학과': 'rehabilitation',
  '의료,건강 > 병원 > 성형외과': 'plastic-surgery',
  '의료,건강 > 병원 > 비뇨기과': 'urology',
  '의료,건강 > 약국': 'pharmacy',

  '서비스,산업 > 이,미용 > 헤어샵 > 미용실': 'hairsalon',
  '서비스,산업 > 이,미용 > 네일아트': 'nail',
  '서비스,산업 > 이,미용 > 피부관리': 'skincare',
  '서비스,산업 > 이,미용 > 속눈썹': 'lash',
  '서비스,산업 > 이,미용 > 왁싱': 'waxing',
  '서비스,산업 > 이,미용 > 반영구화장': 'semi-permanent',
  '서비스,산업 > 이,미용 > 헤어샵 > 바버샵': 'barbershop',

  '서비스,산업 > 인테리어': 'interior',
  '서비스,산업 > 이사,보관': 'moving',
  '서비스,산업 > 청소,세탁': 'cleaning',
  '서비스,산업 > 세탁,코인빨래방': 'laundry',
  '가정,생활 > 꽃배달': 'flower',

  '서비스,산업 > 차량정비': 'auto-repair',
  '서비스,산업 > 차량관리 > 세차': 'carwash',

  '교육,학문 > 학원': 'academy',
  '교육,학문 > 어린이집': 'daycare',
  '교육,학문 > 영어': 'english-academy',

  '서비스,산업 > 법률,세무': 'lawyer',
  '서비스,산업 > 세무': 'tax',
  '서비스,산업 > 회계': 'accounting',
}

/**
 * Google Places primaryType / types 배열의 원소별 매핑.
 * null 값은 "하위 분류 필요" 뜻 — Tier 3 (LLM) 로 폴백해야 함.
 */
export const GOOGLE_TYPE_MAP: Record<string, string | null> = {
  dermatologist: 'dermatology',
  dentist: 'dental',
  eye_care: 'eye',
  ophthalmologist: 'eye',
  orthopedic_clinic: 'orthopedics',
  physiotherapist: 'rehabilitation',
  doctor: null,              // 세부 전문 필요
  hospital: null,
  health: null,
  medical_lab: null,
  pharmacy: 'pharmacy',
  drugstore: 'pharmacy',

  hair_salon: 'hairsalon',
  barber_shop: 'barbershop',
  beauty_salon: null,         // skincare/nail/lash 중 세부 필요
  spa: 'skincare',
  nail_salon: 'nail',

  home_goods_store: null,
  furniture_store: null,
  moving_company: 'moving',
  laundry: 'laundry',
  locksmith: 'repair',

  car_repair: 'auto-repair',
  car_wash: 'carwash',

  school: null,
  primary_school: 'daycare',

  lawyer: 'lawyer',
  accounting: 'accounting',

  restaurant: null,            // korean/italian/bbq 등 세부 분류 필요
  cafe: 'cafe',
  bakery: 'bakery',
  bar: 'bar',
}

/** Kakao category 매핑 — 정확 → 마지막 세그먼트 fallback */
export function mapKakaoCategory(kakaoCategoryName: string): string | null {
  if (!kakaoCategoryName) return null
  const exact = KAKAO_CATEGORY_MAP[kakaoCategoryName]
  if (exact) return exact

  // fuzzy: 마지막 세그먼트에 매칭되는 키 탐색
  const last = kakaoCategoryName.split('>').pop()?.trim()
  if (!last) return null
  for (const [key, slug] of Object.entries(KAKAO_CATEGORY_MAP)) {
    if (key.endsWith(last)) return slug
  }
  return null
}

/** Google types 배열에서 첫 유효 매핑 반환. null 은 "세부 필요". */
export function mapGoogleTypes(types: readonly string[]): string | null {
  let needsDetail = false
  for (const t of types) {
    if (t in GOOGLE_TYPE_MAP) {
      const slug = GOOGLE_TYPE_MAP[t]
      if (slug) return slug
      needsDetail = true
    }
  }
  return needsDetail ? null : null
}
