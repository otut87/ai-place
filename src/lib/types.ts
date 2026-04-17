// AI Place — Core Types
// 모든 데이터 모델의 기반. Phase 1은 시드 데이터, Phase 3에서 Supabase로 전환.

/** 도시 */
export interface City {
  slug: string          // "cheonan" (영문, URL용)
  name: string          // "천안" (한글, 표시용)
  nameEn: string        // "Cheonan"
}

/** Schema.org LocalBusiness 하위 타입 — 유효한 값만 허용 */
export type LocalBusinessSchemaType =
  | 'LocalBusiness'
  // 의료
  | 'MedicalClinic'
  | 'Dentist'
  | 'Pharmacy'
  // 뷰티
  | 'BeautySalon'
  | 'HairSalon'
  | 'HealthAndBeautyBusiness'
  | 'HealthClub'
  // 생활서비스
  | 'HomeAndConstructionBusiness'
  | 'MovingCompany'
  | 'Florist'
  | 'DryCleaningOrLaundry'
  // 자동차
  | 'AutoRepair'
  | 'AutoDealer'
  | 'AutoRental'
  | 'TireShop'
  // 음식
  | 'Restaurant'
  | 'FoodEstablishment'
  | 'CafeOrCoffeeShop'
  | 'Bakery'
  | 'BarOrPub'
  // 전문서비스
  | 'ProfessionalService'
  | 'LegalService'
  | 'AccountingService'
  | 'InsuranceAgency'
  | 'FinancialService'
  | 'RealEstateAgent'
  // 교육
  | 'EducationalOrganization'
  | 'Preschool'
  | 'SportsActivityLocation'
  // 반려동물
  | 'VeterinaryCare'
  // 웨딩·행사
  | 'EventVenue'
  // 레저
  | 'EntertainmentBusiness'
  // 기타
  | 'Store'
  | 'TravelAgency'
  | 'ChildCare'
  | 'LodgingBusiness'

/** 대분류 (Sector) — Schema.org 타입과 1:1 매핑 */
export interface Sector {
  slug: string                       // "medical"
  name: string                       // "의료"
  nameEn: string                     // "Medical"
  schemaType: LocalBusinessSchemaType // Schema.org 타입
}

/** 소분류 (Category) — 대분류에 속하는 세부 업종 */
export interface Category {
  slug: string          // "dermatology"
  name: string          // "피부과"
  nameEn: string        // "Dermatology"
  icon?: string         // lucide-react icon name
  sector: string        // Sector slug reference ("medical")
}

/** 업체 서비스 */
export interface Service {
  name: string          // "여드름치료"
  description?: string  // 서비스 설명
  priceRange?: string   // "5-10만원"
}

/** FAQ 항목 */
export interface FAQ {
  question: string
  answer: string
}

/** 업체 (Place) — 핵심 엔티티 */
export interface Place {
  slug: string              // "pretty-clinic" (영문, URL용)
  name: string              // "천안예쁜피부과"
  nameEn?: string           // "Cheonan Pretty Dermatology"
  city: string              // City slug reference
  category: string          // Category slug reference
  description: string       // 한 줄 설명
  address: string           // "천안시 서북구 불당동 123"
  phone?: string            // "+82-41-XXX-XXXX"
  openingHours?: string[]   // ["Mo-Fr 09:00-18:00", "Sa 09:00-13:00"]
  imageUrl?: string         // 대표 이미지 URL
  rating?: number           // 4.5
  reviewCount?: number      // 23
  services: Service[]
  faqs: FAQ[]
  tags: string[]            // ["여드름", "레이저", "보톡스"]
  naverPlaceUrl?: string    // 네이버 플레이스 URL (sameAs)
  kakaoMapUrl?: string      // 카카오맵 URL (sameAs)
  googleBusinessUrl?: string // Google Business Profile URL (sameAs)
  lastUpdated?: string      // "2026-04-14" (ISO 8601, Freshness §4.2)
  latitude?: number
  longitude?: number
  googlePlaceId?: string    // Google Places API place_id
  reviewSummaries?: ReviewSummary[]
  images?: PlaceImage[]
  // GEO 추천 로직 (GPT/Gemini 리뷰 반영)
  recommendedFor?: string[]      // ["여드름 치료 필요한 환자", "건강보험 적용 원하는 분"]
  strengths?: string[]           // ["피부질환 중심 진료", "건강보험 적용 가능"]
  placeType?: string             // "질환치료형" | "미용시술형" | "프리미엄"
  recommendationNote?: string    // 40-60자 추천형 Direct Answer Block
}

// --- Google Places API 연동 타입 ---

/** 리뷰 요약 (Google Places API에서 추출) */
export interface ReviewSummary {
  source: string              // "Google"
  positiveThemes: string[]    // ["친절한 상담", "대기시간 짧음"]
  negativeThemes: string[]    // ["주차 불편"]
  sampleQuote?: string        // 패러프레이즈 (Google ToS 준수)
  lastChecked: string         // ISO 8601
}

/** 업체 이미지 (alt 구조화) */
export interface PlaceImage {
  url: string
  alt: string                 // "수피부과의원 진료실 내부"
  type: 'exterior' | 'interior' | 'treatment' | 'staff' | 'equipment'
}

// --- Phase 2: 비교/가이드 콘텐츠 타입 ---

/** 통계 항목 (GEO lever: Statistics Addition §2.2) */
export interface StatisticItem {
  label: string             // "평균 여드름 치료 비용"
  value: string             // "7.5만원"
  note?: string             // "AI플레이스 자체 조사 기준"
}

/** 출처 (GEO lever: Cite Sources §2.2) */
export interface Source {
  name: string              // "건강보험심사평가원"
  url?: string
  year?: number
}

/** 비교 주제 */
export interface ComparisonTopic {
  slug: string              // "acne-treatment"
  name: string              // "여드름 치료"
  city: string
  category: string
}

/** 비교 항목 — 업체별 특정 주제 데이터 */
export interface ComparisonEntry {
  placeSlug: string
  placeName: string
  rating?: number
  reviewCount?: number
  methods: string[]         // ["압출+레이저 병행", "PDT 치료"]
  priceRange: string        // "5-10만원"
  specialties: string[]
  pros: string[]
  cons: string[]
}

/** 비교 페이지 전체 데이터 */
export interface ComparisonPage {
  topic: ComparisonTopic
  summary: string           // Direct Answer Block (40-60자)
  entries: ComparisonEntry[]
  statistics: StatisticItem[]
  faqs: FAQ[]
  sources: Source[]
  lastUpdated: string       // ISO 8601
}

/** 가이드 섹션 */
export interface GuideSection {
  heading: string
  content: string
  items?: string[]
  recommendedPlaces?: Array<{
    slug: string        // "soo-derm"
    name: string        // "수피부과의원"
    reason: string      // "피부질환 중심 진료, 건강보험 적용 가능"
  }>
}

/** 가이드 페이지 데이터 */
export interface GuidePage {
  city: string
  category: string
  title: string
  summary: string           // Direct Answer Block
  sections: GuideSection[]
  statistics: StatisticItem[]
  faqs: FAQ[]
  sources: Source[]
  lastUpdated: string
}

/** 키워드 랜딩 페이지 — AI 검색 쿼리 1:1 매칭 */
export interface KeywordPage {
  slug: string              // "acne" (URL용)
  city: string
  category: string
  targetQuery: string       // "천안 여드름 피부과 추천"
  title: string
  summary: string           // Direct Answer Block
  relatedPlaceSlugs: string[]
  faqs: FAQ[]
  statistics: StatisticItem[]
  sources: Source[]
  lastUpdated: string
}

// --- Blog (T-010 Phase 1.5) ---

/** 블로그 포스트 타입 — keyword/compare/guide 통합 */
export type BlogPostType = 'keyword' | 'compare' | 'guide' | 'general'
export type BlogPostStatus = 'draft' | 'active' | 'archived'

/** 블로그 글 전체 데이터 (상세 페이지용) */
export interface BlogPost {
  id: string
  slug: string                                // "cheonan-dermatology-acne"
  title: string
  summary: string                             // Direct Answer Block (40-60자)
  content: string                             // Markdown 본문
  city: string                                // "cheonan"
  sector: string                              // "medical" (대분류)
  category: string | null                     // "dermatology" (소분류, 선택)
  tags: string[]
  postType: BlogPostType
  relatedPlaceSlugs: string[]                 // 관련 업체 (양방향 링크)
  targetQuery: string | null                  // SEO 타깃 쿼리 (keyword 타입)
  faqs: FAQ[]
  statistics: StatisticItem[]
  sources: Source[]
  viewCount: number
  qualityScore: number | null
  status: BlogPostStatus
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

/** 블로그 글 요약 (목록/카드용) */
export interface BlogPostSummary {
  id: string
  slug: string
  title: string
  summary: string
  city: string
  sector: string
  category: string | null
  postType: BlogPostType
  tags: string[]
  viewCount: number
  publishedAt: string | null
}

// --- AI 인용 테스트 관련 타입 ---

/** AI 엔진 종류 */
export type AIEngine = 'chatgpt' | 'claude' | 'gemini'

/** 테스트 프롬프트 */
export interface TestPrompt {
  id: string
  text: string              // "천안 피부과 추천해줘"
  category: string          // "dermatology"
  city: string              // "cheonan"
  createdAt: string         // ISO 8601
}

/** AI 인용 결과 */
export interface CitationResult {
  id: string
  promptId: string
  engine: AIEngine
  response: string          // AI 전체 응답
  citedSources: string[]    // 인용된 URL 목록
  citedPlaces: string[]     // 언급된 업체명 목록
  aiplaceCited: boolean     // aiplace.kr 인용 여부
  sessionId: string         // 세션 고유 ID (새 세션 확인용)
  testedAt: string          // ISO 8601
}

/** 베이스라인 측정 요약 */
export interface BaselineSummary {
  promptId: string
  engine: AIEngine
  totalRuns: number
  aiplaceCitedCount: number
  topCitedSources: Array<{ url: string; count: number }>
  topMentionedPlaces: Array<{ name: string; count: number }>
}
