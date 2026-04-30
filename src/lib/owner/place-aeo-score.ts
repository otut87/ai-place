// Sprint D-1 / T-200 — Place AEO 점수 (OWNER_DASHBOARD_PLAN.md §5.5).
//
// 결정론 8룰 · 100점 만점. 모두 순수 함수 — 입력이 같으면 결과도 같음.
// 외부 API·LLM 호출 없음. 페이지 로드마다 다시 계산해도 안전.

import type { Place } from '@/lib/types'

export type AeoGrade = 'A' | 'B' | 'C' | 'D'

export interface AeoRuleResult {
  id: string
  label: string
  weight: number
  passed: boolean
  /** UI 에 노출할 간단한 사유 (ex. "FAQ 2개 · 3개 이상 필요"). */
  detail?: string
}

/**
 * T-233 — 8룰 라벨·가중치 카탈로그 (단일 소스).
 * scorePlaceAeo 내부의 rules.push 와 1:1 매칭.
 * UI 컴포넌트(aeo-gauge, dash-place-list)는 라벨을 직접 박지 말고 여기서 import.
 */
export const AEO_RULES = [
  { id: 'jsonld-basics',        label: 'JSON-LD 기본 (이름·주소·연락처)', weight: 20 },
  { id: 'faq-count',            label: 'FAQ 3~10개',                      weight: 20 },
  { id: 'freshness',            label: '최근 갱신 표시 (180일 이내)',      weight: 10 },
  { id: 'review-summary',       label: '리뷰 표시/수집',                  weight: 10 },
  { id: 'photos-3',             label: '대표 사진 3장 이상',               weight: 10 },
  { id: 'opening-hours',        label: '영업시간 정확',                   weight: 10 },
  { id: 'services-min',         label: '서비스 1가지 이상',                weight: 10 },
  { id: 'mentioned-in-content', label: '내부 콘텐츠 자동 언급 (블로그·비교·가이드)', weight: 10 },
] as const

export type AeoRuleId = (typeof AEO_RULES)[number]['id']

export const AEO_RULE_LABEL: Record<AeoRuleId, string> = Object.fromEntries(
  AEO_RULES.map(r => [r.id, r.label]),
) as Record<AeoRuleId, string>

export interface PlaceAeoScore {
  score: number        // 0~100
  grade: AeoGrade
  rules: AeoRuleResult[]
  /** 감점 총합 (100 - score). 할 일 우선순위 정렬용. */
  missingTotal: number
}

export interface PlaceAeoInput {
  place: Pick<
    Place,
    | 'name' | 'address' | 'phone'
    | 'lastUpdated'
    | 'faqs'
    | 'reviewSummaries' | 'reviewCount'
    | 'images' | 'imageUrl'
    | 'openingHours'
    | 'services'
  >
  /**
   * 비교/블로그/가이드/키워드 페이지에서 이 업체가 언급된 횟수 (업체 상세 URL 제외).
   * place_mentions 테이블에서 `page_type != 'place'` 로 COUNT.
   */
  mentionCount: number
  /** 지금 기준 시각 (테스트 주입용). */
  now?: Date
}

const FRESHNESS_MAX_DAYS = 180
const DAY_MS = 86_400_000

function isFreshEnough(lastUpdated: string | undefined | null, now: Date): boolean {
  if (!lastUpdated) return false
  const ts = Date.parse(lastUpdated)
  if (!Number.isFinite(ts)) return false
  const diffDays = Math.floor((now.getTime() - ts) / DAY_MS)
  return diffDays >= 0 && diffDays <= FRESHNESS_MAX_DAYS
}

function countImages(place: PlaceAeoInput['place']): number {
  const detailed = place.images?.length ?? 0
  // imageUrl 만 있는 과거 데이터 보정 — 대표 1장으로 계산.
  if (detailed > 0) return detailed
  return place.imageUrl ? 1 : 0
}

export function scorePlaceAeo(input: PlaceAeoInput): PlaceAeoScore {
  const now = input.now ?? new Date()
  const { place, mentionCount } = input

  const rules: AeoRuleResult[] = []

  // 1. JSON-LD 기본 — name · address · phone 3요소 모두 채워져야 LocalBusiness 로 유효.
  const name = (place.name ?? '').trim()
  const address = (place.address ?? '').trim()
  const phone = (place.phone ?? '').trim()
  const jsonldOk = name.length > 0 && address.length > 0 && phone.length > 0
  rules.push({
    id: 'jsonld-basics',
    label: 'JSON-LD 기본 (이름·주소·연락처)',
    weight: 20,
    passed: jsonldOk,
    detail: jsonldOk ? undefined : `누락: ${[!name && '이름', !address && '주소', !phone && '연락처'].filter(Boolean).join(' · ')}`,
  })

  // 2. FAQ 적정성 — 3~10개. (remix 디자인 순서 기준 2번째)
  const faqCount = place.faqs?.length ?? 0
  const faqOk = faqCount >= 3 && faqCount <= 10
  rules.push({
    id: 'faq-count',
    label: 'FAQ 3~10개',
    weight: 20,
    passed: faqOk,
    detail: faqOk ? undefined : `현재 ${faqCount}개`,
  })

  // 3. 출처·lastChecked — lastUpdated 가 있고 180일 이내.
  const fresh = isFreshEnough(place.lastUpdated, now)
  rules.push({
    id: 'freshness',
    label: '최근 갱신 표시 (180일 이내)',
    weight: 10,
    passed: fresh,
    detail: place.lastUpdated ? (fresh ? undefined : '180일 초과 — 갱신 필요') : '갱신일 없음',
  })

  // 4. 리뷰 표시/수집 — reviewSummaries 1건 이상 또는 reviewCount>0.
  const summaryCount = place.reviewSummaries?.length ?? 0
  const reviewOk = summaryCount > 0 || (place.reviewCount ?? 0) > 0
  rules.push({
    id: 'review-summary',
    label: '리뷰 표시/수집',
    weight: 10,
    passed: reviewOk,
    detail: reviewOk ? undefined : '리뷰 요약 없음',
  })

  // 5. 대표 사진 ≥3.
  const imgCount = countImages(place)
  const photosOk = imgCount >= 3
  rules.push({
    id: 'photos-3',
    label: '대표 사진 3장 이상',
    weight: 10,
    passed: photosOk,
    detail: photosOk ? undefined : `${imgCount}장`,
  })

  // 6. 영업시간.
  const hoursCount = place.openingHours?.length ?? 0
  const hoursOk = hoursCount > 0
  rules.push({
    id: 'opening-hours',
    label: '영업시간 정확',
    weight: 10,
    passed: hoursOk,
    detail: hoursOk ? undefined : '영업시간 없음',
  })

  // 7. 서비스 목록 ≥1.
  const serviceCount = place.services?.length ?? 0
  const servicesOk = serviceCount >= 1
  rules.push({
    id: 'services-min',
    label: '서비스 1가지 이상',
    weight: 10,
    passed: servicesOk,
    detail: servicesOk ? undefined : '서비스 없음',
  })

  // 8. 내부 콘텐츠 자동 언급 — 비교/가이드/블로그/키워드 페이지에 이 업체가 등장 (mentionCount >= 1).
  //    owner 가 직접 처리하는 룰이 아님. 카드 등록 후 자동 발행 파이프라인이 가동되면
  //    이 업체를 본문에서 언급하기 시작 → 누적되며 +10 회복.
  const mentionedOk = mentionCount >= 1
  rules.push({
    id: 'mentioned-in-content',
    label: '내부 콘텐츠 자동 언급 (블로그·비교·가이드)',
    weight: 10,
    passed: mentionedOk,
    detail: mentionedOk
      ? `${mentionCount}회 언급`
      : '카드 등록 후 자동 발행되는 블로그·비교·가이드·키워드 페이지가 이 업체를 언급할 때 누적됩니다 (owner 직접 작성 불필요)',
  })

  const score = rules.reduce((sum, r) => sum + (r.passed ? r.weight : 0), 0)
  return {
    score,
    grade: toGrade(score),
    rules,
    missingTotal: 100 - score,
  }
}

export function toGrade(score: number): AeoGrade {
  if (score >= 85) return 'A'
  if (score >= 75) return 'B'
  if (score >= 60) return 'C'
  return 'D'
}
