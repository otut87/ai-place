// T-066 — 업체 공개 노출 완성도 계산.
// 설계안 §3.4 체크리스트 기준. 100점 만점. place-validation.ts 는 폼 검증 범위가
// 다르므로 여기서 공개용 노출 기준만 별도로 집계.

export interface CompletenessInput {
  name: string | null
  description: string | null
  phone: string | null
  address: string | null
  opening_hours: string[] | null
  services: Array<{ name: string; description?: string }> | null
  faqs: Array<{ question: string; answer: string }> | null
  tags: string[] | null
  images: unknown
  naver_place_url: string | null
  kakao_map_url: string | null
}

export interface ChecklistItem {
  id: string
  label: string
  passed: boolean
  weight: number
}

export function computeCompleteness(place: CompletenessInput): {
  items: ChecklistItem[]
  score: number
} {
  const items: ChecklistItem[] = [
    { id: 'name', label: '업체명', passed: Boolean(place.name && place.name.trim()), weight: 5 },
    { id: 'description', label: '설명 ≥ 40자', passed: (place.description ?? '').trim().length >= 40, weight: 15 },
    { id: 'phone', label: '전화번호', passed: Boolean(place.phone && place.phone.trim()), weight: 10 },
    { id: 'address', label: '주소', passed: Boolean(place.address && place.address.trim()), weight: 10 },
    { id: 'hours', label: '영업시간 1건 이상', passed: Array.isArray(place.opening_hours) && place.opening_hours.length > 0, weight: 5 },
    { id: 'kakao', label: '카카오맵 링크', passed: Boolean(place.kakao_map_url), weight: 10 },
    { id: 'naver', label: '네이버 플레이스 링크', passed: Boolean(place.naver_place_url), weight: 10 },
    { id: 'services', label: '서비스 ≥ 3', passed: Array.isArray(place.services) && place.services.length >= 3, weight: 10 },
    { id: 'faqs', label: 'FAQ ≥ 5', passed: Array.isArray(place.faqs) && place.faqs.length >= 5, weight: 15 },
    { id: 'tags', label: '태그 ≥ 8', passed: Array.isArray(place.tags) && place.tags.length >= 8, weight: 5 },
    { id: 'images', label: '이미지 ≥ 1', passed: Array.isArray(place.images) && place.images.length >= 1, weight: 5 },
  ]

  const max = items.reduce((a, b) => a + b.weight, 0)
  const got = items.filter(i => i.passed).reduce((a, b) => a + b.weight, 0)
  const score = Math.round((got / max) * 100)
  return { items, score }
}

export const PUBLIC_READY_THRESHOLD = 90
