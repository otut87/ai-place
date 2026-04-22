// Sprint D-1 / T-200 — 할 일 7규칙 엔진 (OWNER_DASHBOARD_PLAN.md §5.7).
//
// 순수 결정론 함수 — 입력이 같으면 결과 같음. 외부 API 호출 없음.
// 7규칙 평가 후 우선순위 정렬된 OwnerTodo[] 반환.

import type { FAQ, PlaceImage, ReviewSummary } from '@/lib/types'

export type TodoPriority = 'HIGH' | 'MID' | 'LOW'

export type OwnerTodoId =
  | 'billing-card-missing'
  | 'photos-few'
  | 'faq-missing'
  | 'hours-missing'
  | 'description-weak'
  | 'reviews-stale'
  | 'medical-check'

export interface OwnerTodo {
  id: OwnerTodoId
  priority: TodoPriority
  /** 업체 단위 할일이면 업체 UUID, 전역(결제·파일럿)이면 null. */
  placeId: string | null
  placeName: string | null
  title: string
  description: string
  actionHref?: string
}

export interface OwnerTodoPlaceInput {
  id?: string
  name: string
  city: string
  category: string
  slug: string
  /** sector slug. 'medical' 이면 medical-check 룰 평가. */
  sector?: string
  description?: string
  faqs?: FAQ[]
  images?: PlaceImage[]
  imageUrl?: string
  openingHours?: string[] | null
  reviewSummaries?: ReviewSummary[]
  /** 리뷰 요약의 lastChecked 중 가장 최신 (ISO). */
  lastReviewCheckedAt?: string | null
}

export interface OwnerTodoBilling {
  hasCard: boolean
  pilotRemainingDays: number        // 음수 가능 (파일럿 만료 후)
}

export interface OwnerTodoInput {
  places: ReadonlyArray<OwnerTodoPlaceInput>
  billing: OwnerTodoBilling
  /** medical sector 업체의 금칙어 감지 결과 — 외부 스캐너가 주입. */
  medicalViolations?: ReadonlyArray<{ placeId: string; phrases: string[] }>
  now?: Date
}

const DESCRIPTION_MIN_LENGTH = 40
const FAQ_MIN = 3
const PHOTOS_MIN = 3
const REVIEWS_STALE_DAYS = 60
const BILLING_WARN_WITHIN_DAYS = 7
const DAY_MS = 86_400_000

function ownerEditHref(placeId: string | undefined): string | undefined {
  return placeId ? `/owner/places/${placeId}` : undefined
}

function countImages(p: OwnerTodoPlaceInput): number {
  const detailed = p.images?.length ?? 0
  if (detailed > 0) return detailed
  return p.imageUrl ? 1 : 0
}

export function detectOwnerTodos(input: OwnerTodoInput): OwnerTodo[] {
  const now = input.now ?? new Date()
  const todos: OwnerTodo[] = []

  // ── 전역 규칙 ─────────────────────────────────────────────────
  // 1. billing-card-missing: D-7 이내(파일럿 잔여 ≤7일 OR 이미 만료) AND 카드 미등록.
  if (!input.billing.hasCard && input.billing.pilotRemainingDays <= BILLING_WARN_WITHIN_DAYS) {
    todos.push({
      id: 'billing-card-missing',
      priority: 'HIGH',
      placeId: null,
      placeName: null,
      title: '결제 카드 등록 필요',
      description: input.billing.pilotRemainingDays < 0
        ? '파일럿이 종료됐어요. 카드 등록을 완료하면 구독이 재개됩니다.'
        : `파일럿 종료까지 ${input.billing.pilotRemainingDays}일 · 카드 등록 후 자동 결제 전환.`,
      actionHref: '/owner/billing',
    })
  }

  // ── 업체별 규칙 ───────────────────────────────────────────────
  const medicalMap = new Map<string, string[]>()
  for (const v of input.medicalViolations ?? []) {
    medicalMap.set(v.placeId, v.phrases)
  }

  for (const p of input.places) {
    const placeId = p.id ?? null
    const placeName = p.name
    const href = ownerEditHref(p.id)

    // 2. photos-few
    if (countImages(p) < PHOTOS_MIN) {
      todos.push({
        id: 'photos-few',
        priority: 'HIGH',
        placeId, placeName,
        title: `${placeName} — 대표 사진 부족`,
        description: `사진 ${countImages(p)}장 · 최소 ${PHOTOS_MIN}장 권장 (AEO 점수 +10)`,
        actionHref: href,
      })
    }

    // 3. faq-missing
    const faqCount = p.faqs?.length ?? 0
    if (faqCount < FAQ_MIN) {
      todos.push({
        id: 'faq-missing',
        priority: 'HIGH',
        placeId, placeName,
        title: `${placeName} — FAQ 부족`,
        description: `FAQ ${faqCount}개 · 3~10개 채워야 AI 답변 인용률이 올라갑니다.`,
        actionHref: href,
      })
    }

    // 4. hours-missing
    const hoursCount = p.openingHours?.length ?? 0
    if (hoursCount === 0) {
      todos.push({
        id: 'hours-missing',
        priority: 'MID',
        placeId, placeName,
        title: `${placeName} — 영업시간 미등록`,
        description: '영업시간이 없으면 "지금 영업 중인 곳" 쿼리에서 누락됩니다.',
        actionHref: href,
      })
    }

    // 5. description-weak
    const desc = (p.description ?? '').trim()
    if (desc.length < DESCRIPTION_MIN_LENGTH) {
      todos.push({
        id: 'description-weak',
        priority: 'MID',
        placeId, placeName,
        title: `${placeName} — 소개 문구 보강`,
        description: `현재 ${desc.length}자 · 40자 이상 쓰면 검색 인용에 유리합니다.`,
        actionHref: href,
      })
    }

    // 6. reviews-stale
    if (isReviewsStale(p, now)) {
      todos.push({
        id: 'reviews-stale',
        priority: 'LOW',
        placeId, placeName,
        title: `${placeName} — 리뷰 갱신 필요`,
        description: `${REVIEWS_STALE_DAYS}일 이상 리뷰 수집 기록이 없어요. 최신 후기 반영 권장.`,
        actionHref: href,
      })
    }

    // 7. medical-check — sector='medical' 에서 금칙어 감지.
    if (p.sector === 'medical' && p.id && medicalMap.has(p.id)) {
      const phrases = medicalMap.get(p.id) ?? []
      if (phrases.length > 0) {
        todos.push({
          id: 'medical-check',
          priority: 'HIGH',
          placeId, placeName,
          title: `${placeName} — 의료광고법 점검 필요`,
          description: `과장/금칙어 ${phrases.length}건 감지: ${phrases.slice(0, 3).join(' · ')}`,
          actionHref: href,
        })
      }
    }
  }

  return sortTodos(todos)
}

function isReviewsStale(p: OwnerTodoPlaceInput, now: Date): boolean {
  const summaries = p.reviewSummaries ?? []
  if (summaries.length === 0 && !p.lastReviewCheckedAt) return true

  let mostRecent: number | null = null
  for (const s of summaries) {
    const ts = Date.parse(s.lastChecked ?? '')
    if (Number.isFinite(ts)) {
      if (mostRecent === null || ts > mostRecent) mostRecent = ts
    }
  }
  if (p.lastReviewCheckedAt) {
    const ts = Date.parse(p.lastReviewCheckedAt)
    if (Number.isFinite(ts)) {
      if (mostRecent === null || ts > mostRecent) mostRecent = ts
    }
  }

  if (mostRecent === null) return true
  const diffDays = Math.floor((now.getTime() - mostRecent) / DAY_MS)
  return diffDays > REVIEWS_STALE_DAYS
}

function sortTodos(todos: OwnerTodo[]): OwnerTodo[] {
  const weight: Record<TodoPriority, number> = { HIGH: 3, MID: 2, LOW: 1 }
  return [...todos].sort((a, b) => {
    const wd = weight[b.priority] - weight[a.priority]
    if (wd !== 0) return wd
    // 같은 우선순위면 전역 먼저, 그 다음 placeName 사전순.
    if (a.placeId === null && b.placeId !== null) return -1
    if (a.placeId !== null && b.placeId === null) return 1
    return (a.placeName ?? '').localeCompare(b.placeName ?? '')
  })
}
