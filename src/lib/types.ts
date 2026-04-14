// AI Place — Core Types
// 모든 데이터 모델의 기반. Phase 1은 시드 데이터, Phase 3에서 Supabase로 전환.

/** 도시 */
export interface City {
  slug: string          // "cheonan" (영문, URL용)
  name: string          // "천안" (한글, 표시용)
  nameEn: string        // "Cheonan"
}

/** 업종 카테고리 */
export interface Category {
  slug: string          // "dermatology"
  name: string          // "피부과"
  nameEn: string        // "Dermatology"
  icon?: string         // lucide-react icon name
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
