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
  latitude?: number
  longitude?: number
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
