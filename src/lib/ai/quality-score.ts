// 품질 스코어링 게이트 (T-027)
// LLM 이 생성한 업체 콘텐츠를 0-100 스코어로 평가.
// <70 이면 재생성 권장. 어드민 대시보드에도 노출 예정.
//
// 스코어 브레이크다운 (총 100점):
//   - descLength     : 15점 (80~160자 권장 · 2~3문장 · 특징·강점 포함)
//   - keywordDensity : 15점 (description 이 지역·업종 키워드 포함)
//   - stats          : 20점 (서비스 가격, FAQ 수치 인용 등 구체 수치)
//   - faqDiversity   : 20점 (FAQ 5개 이상 + 질문 첫 단어 다양)
//   - generic        : 15점 (일반론 금칙어 없으면 가점, 있으면 감점)
//   - categoryFit    : 15점 (카테고리 추정 키워드 포함)
//
// 설계 주의: description 에 업체명은 보통 들어가지 않는다 (페이지 H1 이 담당).
//           따라서 keywordDensity 는 지역·업종 매칭만 평가한다.

export interface GeneratedContent {
  description: string
  services: Array<{ name: string; description?: string; priceRange?: string }>
  faqs: Array<{ question: string; answer: string }>
  tags: string[]
}

export interface QualityScoreInput extends GeneratedContent {
  businessName: string
  city?: string        // 도시 표시명 (예: "천안시")
  categoryKeyword?: string // 업종 키워드 (예: "피부과", "치과")
}

export interface QualityScoreResult {
  score: number
  breakdown: {
    descLength: number
    keywordDensity: number
    stats: number
    faqDiversity: number
    generic: number
    categoryFit: number
  }
  suggestions: string[]
}

// 일반론 금칙어 — 있으면 감점.
const GENERIC_BAD_WORDS = [
  '다양한',
  '전문적인',
  '최고의',
  '최상의',
  '친절하고',
  '편안한',
  '쾌적한',
  '고객 만족',
  '최선을 다',
]

// 수치 신호 — 숫자 포함 여부로 구체성 판단.
const NUMERIC_RE = /\d/

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

function scoreDescLength(desc: string): number {
  const len = desc.length
  // 80~160자(2~3문장)를 권장 — 첫 문장 "{지역} 위치. {전문} 전문." + 특징/강점 2~3문장.
  if (len < 30) return 0
  if (len <= 40) return 4
  if (len < 60) return 8
  if (len < 80) return 12
  if (len <= 160) return 15
  if (len <= 220) return 10
  if (len <= 300) return 4
  return 0
}

function scoreKeywordDensity(input: QualityScoreInput): number {
  const { description, city, categoryKeyword } = input
  let pts = 0
  // 지역 (도시명 또는 도시명 앞 2자) 포함 시 7점
  if (city) {
    const short = city.endsWith('시') || city.endsWith('군') || city.endsWith('구')
      ? city.slice(0, -1) : city
    if (description.includes(city) || description.includes(short)) pts += 7
  } else {
    pts += 3
  }
  // 업종 키워드 포함 시 8점
  if (categoryKeyword && description.includes(categoryKeyword)) pts += 8
  else if (!categoryKeyword) pts += 4
  return clamp(pts, 0, 15)
}

function scoreStats(input: QualityScoreInput): number {
  let pts = 0
  // priceRange 에 숫자 있는 서비스 수
  const priced = input.services.filter(s => s.priceRange && NUMERIC_RE.test(s.priceRange)).length
  pts += Math.min(priced * 3, 10) // 최대 10점
  // 답변에 숫자(시간·가격·횟수) 포함 FAQ 수
  const numericFaqs = input.faqs.filter(f => NUMERIC_RE.test(f.answer)).length
  pts += Math.min(numericFaqs * 2, 10) // 최대 10점
  return clamp(pts, 0, 20)
}

function scoreFaqDiversity(input: QualityScoreInput): number {
  const { faqs } = input
  if (faqs.length === 0) return 0
  let pts = 0
  if (faqs.length >= 5) pts += 10
  else if (faqs.length >= 3) pts += 5

  // 질문 첫 단어 유니크 비율
  const firstWords = faqs.map(f => f.question.trim().split(/\s+/)[0])
  const uniqueFirst = new Set(firstWords).size
  const ratio = uniqueFirst / faqs.length
  pts += Math.round(ratio * 10)
  return clamp(pts, 0, 20)
}

function scoreGeneric(input: QualityScoreInput): number {
  const blob = [
    input.description,
    ...input.services.map(s => `${s.name} ${s.description ?? ''}`),
    ...input.faqs.map(f => f.answer),
  ].join(' ')
  let hits = 0
  for (const w of GENERIC_BAD_WORDS) {
    if (blob.includes(w)) hits += 1
  }
  // hits 0 → 15점, hits 1~2 → 10점, 3~4 → 5점, 5+ → 0점
  if (hits === 0) return 15
  if (hits <= 2) return 10
  if (hits <= 4) return 5
  return 0
}

function scoreCategoryFit(input: QualityScoreInput): number {
  const { categoryKeyword, services, tags } = input
  if (!categoryKeyword) return 10 // 판단 불가 → 중립
  const blob = [
    ...services.map(s => `${s.name} ${s.description ?? ''}`),
    ...tags,
  ].join(' ')
  if (blob.includes(categoryKeyword)) return 15
  // 부분 매칭 (2자 이상 겹침)
  for (let i = 0; i + 2 <= categoryKeyword.length; i += 1) {
    const chunk = categoryKeyword.slice(i, i + 2)
    if (blob.includes(chunk)) return 8
  }
  return 0
}

export function scoreQuality(input: QualityScoreInput): QualityScoreResult {
  const breakdown = {
    descLength: scoreDescLength(input.description),
    keywordDensity: scoreKeywordDensity(input),
    stats: scoreStats(input),
    faqDiversity: scoreFaqDiversity(input),
    generic: scoreGeneric(input),
    categoryFit: scoreCategoryFit(input),
  }
  const score =
    breakdown.descLength +
    breakdown.keywordDensity +
    breakdown.stats +
    breakdown.faqDiversity +
    breakdown.generic +
    breakdown.categoryFit

  const suggestions: string[] = []
  if (breakdown.descLength < 15) suggestions.push('description 을 80~160자로, 특징·강점 2~3가지를 포함해 2~3문장으로 작성하세요.')
  if (breakdown.keywordDensity < 10) suggestions.push('description 에 업체명·지역·업종을 모두 포함하세요.')
  if (breakdown.stats < 12) suggestions.push('서비스 가격과 FAQ 답변에 구체 수치(시간·횟수·가격)를 추가하세요.')
  if (breakdown.faqDiversity < 15) suggestions.push('FAQ 5개 이상, 서로 다른 질문 유형으로 다양화하세요.')
  if (breakdown.generic < 10) suggestions.push('"다양한", "전문적인", "친절하고" 등 일반 표현을 구체 사실로 교체하세요.')
  if (breakdown.categoryFit < 10) suggestions.push('서비스·태그에 실제 업종 핵심 키워드를 반영하세요.')

  return { score, breakdown, suggestions }
}

export const QUALITY_SCORE_THRESHOLD = 70
