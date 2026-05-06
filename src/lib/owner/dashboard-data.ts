// Sprint D-1 / T-200 — 오너 대시보드 데이터 로더.
// /owner 페이지가 이 함수 1회 호출로 모든 섹션 데이터를 받는다.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { requireOwnerUser, type OwnerUser } from '@/lib/owner/auth'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { listOwnerPlaces } from '@/lib/actions/owner-places'
import { scorePlaceAeo, type AeoGrade, type AeoRuleResult } from '@/lib/owner/place-aeo-score'
import { getMeasurementWindow, type MeasurementWindow } from '@/lib/owner/measurement-window'
import { countMentionsByPlace } from '@/lib/owner/place-mentions'
import {
  listOwnerBotVisits,
  fetchOwnerPathMap,
  type OwnerBotSummary, type OwnerDailyTrendRow, type OwnerBotVisit,
} from '@/lib/owner/bot-stats'
// T-264: getOwnerBotSummary / getOwnerDailyTrend 는 raw bot_visits 5중 페이지네이션 →
// 1.17M rows 위에서 5+ 라운드트립으로 hang. *Daily 버전이 053 사전집계 + today RPC 로
// <100ms 안에 동일 결과 반환.
// T-269: getOwnerBotSummaryDaily/getOwnerDailyTrendDaily 가 같은 RPC 두 개를 각자 호출하던 중복
// 발사 제거 — fetchOwnerStatsBundle 1회 후 bundle 을 두 aggregator 에 전달.
// T-270: listOwnerBotVisitsDaily 의 owner_recent_bot_visits RPC 가 8초 hang (plan 미스).
// 054 (path, visited_at desc) 인덱스 + 작은 paths 셋(보통 < 50개)이라 raw .order().limit()
// 가 충분히 빠름 → bot-stats.ts:listOwnerBotVisits 사용. RPC dispatch 오버헤드 회피.
import {
  fetchOwnerStatsBundle, getOwnerBotSummaryFromBundle, getOwnerDailyTrendFromBundle,
} from '@/lib/owner/bot-stats-daily'
import { detectOwnerTodos, type OwnerTodo } from '@/lib/owner/todos'
import type { FAQ, PlaceImage, ReviewSummary, Service } from '@/lib/types'

export interface OwnerPlaceSummary {
  id: string
  slug: string
  name: string
  city: string
  category: string
  sector: string | null
  status: string
  createdAt: string | null
  updatedAt: string | null
  aeoScore: number
  aeoGrade: AeoGrade
  missingCount: number
  aeoDeficiencies: string[]
  aeoRules: AeoRuleResult[]
  mentionCount: number
}

export interface OwnerBillingState {
  hasCard: boolean
  pilotRemainingDays: number
  pilotStartedAt: string | null
  pilotEndsAt: string | null
}

export interface OwnerDashboardData {
  user: OwnerUser
  places: OwnerPlaceSummary[]
  window: MeasurementWindow
  botSummary: OwnerBotSummary
  /** Sprint D-2 — 30일 일자별 추이 (차트용). 최신 날짜가 배열 마지막. */
  dailyTrend: OwnerDailyTrendRow[]
  /** Sprint D-2 — 최근 AI 봇 방문 10건 (ai-search/ai-training). */
  recentBotVisits: OwnerBotVisit[]
  todos: OwnerTodo[]
  billing: OwnerBillingState
  averageAeoScore: number | null
  /** 이 로드에서 사용된 기간 (기본 30일). */
  trendDays: number
  /** T-266: 관리자 계정 여부 — true 면 owner page 에서 결제 게이트(BillingBanner/
   *  PilotEndingBanner)를 노출하지 않음. 데이터 게이트는 loadBillingState 가 이미 우회. */
  isAdmin: boolean
  /** T-268: 함수별 elapsed ms — admin 진단 용. 일반 owner 에는 빈 객체. */
  debugTiming?: Record<string, number>
}

interface PlaceDbRow {
  id: string
  slug: string
  name: string
  city: string
  category: string
  status: string
  description: string | null
  phone: string | null
  address: string | null
  opening_hours: string[] | null
  tags: string[] | null
  images: unknown
  image_url: string | null
  rating: number | null
  review_count: number | null
  services: unknown
  faqs: unknown
  review_summaries: unknown
  updated_at: string | null
  created_at: string | null
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  return []
}

/** customers + billing_keys + trial 정보로 파일럿/카드 상태 계산.
 *
 * T-266: ADMIN_EMAILS 의 운영자 계정은 owner UI 를 결제 게이트 없이 사용해야 함 (테스트·데모·
 * 사후 점검 목적). hasCard=true + pilotRemainingDays=∞ 로 강제해 owner-register-place
 * (status='active' 자동 진입), todos.ts (billing-required todo 비생성), BillingBanner/
 * PilotEndingBanner (owner/page.tsx 가 isAdmin 으로 직접 숨김) 모두 한 번에 처리.
 */
async function loadBillingState(userId: string, now: Date, userEmail: string | null): Promise<OwnerBillingState> {
  if (isAdminEmail(userEmail)) {
    return { hasCard: true, pilotRemainingDays: 9999, pilotStartedAt: null, pilotEndsAt: null }
  }

  const admin = getAdminClient()
  if (!admin) {
    return { hasCard: false, pilotRemainingDays: 30, pilotStartedAt: null, pilotEndsAt: null }
  }

  const { data: customer } = await admin
    .from('customers')
    .select('id, trial_started_at, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()
  const c = customer as { id: string; trial_started_at: string | null; trial_ends_at: string | null } | null

  if (!c) {
    return { hasCard: false, pilotRemainingDays: 30, pilotStartedAt: null, pilotEndsAt: null }
  }

  const { data: keys } = await admin
    .from('billing_keys')
    .select('id')
    .eq('customer_id', c.id)
    .eq('status', 'active')
    .maybeSingle()
  const hasCard = !!keys

  let pilotRemainingDays = 30
  if (c.trial_ends_at) {
    const ends = Date.parse(c.trial_ends_at)
    if (Number.isFinite(ends)) {
      pilotRemainingDays = Math.floor((ends - now.getTime()) / 86_400_000)
    }
  } else if (c.trial_started_at) {
    const start = Date.parse(c.trial_started_at)
    if (Number.isFinite(start)) {
      const elapsed = Math.floor((now.getTime() - start) / 86_400_000)
      pilotRemainingDays = 30 - elapsed
    }
  }

  return {
    hasCard,
    pilotRemainingDays,
    pilotStartedAt: c.trial_started_at,
    pilotEndsAt: c.trial_ends_at,
  }
}

/** listOwnerPlaces 의 기본 row 에 AEO 점수 계산에 필요한 필드를 추가 조회. */
async function loadFullPlacesForOwner(
  placeIds: string[],
): Promise<Map<string, PlaceDbRow>> {
  const map = new Map<string, PlaceDbRow>()
  if (placeIds.length === 0) return map

  const admin = getAdminClient()
  if (!admin) return map

  const { data, error } = await admin
    .from('places')
    .select(`
      id, slug, name, city, category, status, description, phone, address,
      opening_hours, tags, images, image_url, rating, review_count,
      services, faqs, review_summaries, updated_at, created_at
    `)
    .in('id', placeIds)

  if (error) {
    console.error('[owner-dashboard] places 조회 실패:', error.message)
    return map
  }

  for (const row of (data ?? []) as PlaceDbRow[]) map.set(row.id, row)
  return map
}

async function loadSectorMap(): Promise<Map<string, string>> {
  const admin = getAdminClient()
  if (!admin) return new Map()
  const { data } = await admin
    .from('category_sector')
    .select('category_slug, sector_slug')
  const map = new Map<string, string>()
  for (const row of (data ?? []) as Array<{ category_slug: string; sector_slug: string }>) {
    map.set(row.category_slug, row.sector_slug)
  }
  return map
}

export interface LoadOwnerDashboardOptions {
  /** 일자별 추이 기간 (기본 30일). 7/30/90 권장. */
  trendDays?: number
}

// T-268: 임시 timing 측정. /owner ~10초 hang 의 함수별 병목 식별 — 사용자 측정 후 제거.
function makeTimed(timing: Record<string, number>) {
  return async function timed<T>(label: string, promise: Promise<T>): Promise<T> {
    const start = Date.now()
    try {
      const r = await promise
      timing[label] = Date.now() - start
      return r
    } catch (e) {
      timing[label] = Date.now() - start
      timing[`${label}_FAILED`] = 1
      throw e
    }
  }
}

export async function loadOwnerDashboard(
  now: Date = new Date(),
  opts: LoadOwnerDashboardOptions = {},
): Promise<OwnerDashboardData> {
  const debugTiming: Record<string, number> = {}
  const timed = makeTimed(debugTiming)

  const dashStart = Date.now()
  const user = await timed('requireOwnerUser', requireOwnerUser())
  const trendDays = opts.trendDays ?? 30

  // 1. 오너 업체 목록 (owner_id / owner_email / customer_id 매칭)
  const ownerRows = await timed('listOwnerPlaces', listOwnerPlaces())
  const placeIds = ownerRows.map((r) => r.id)
  debugTiming.placeIds_count = placeIds.length

  // T-270: listOwnerBotVisits 가 pathMap 받으면 fetchOwnerPathMap 재호출 안 함. listOwnerPlaces
  // 결과 받은 직후에만 호출 가능 (placeIds 의존). 다른 7개 함수와 병렬로 묶음.
  const pathMap = await timed('fetchOwnerPathMap', fetchOwnerPathMap(placeIds))

  // 2. 병렬 로드 — 모두 daily 사전집계 / RPC 기반 (T-264 + T-269 + T-270).
  // T-269: bot stats bundle 1회 fetch (snapshot RPC + today RPC) → summary / trend 둘에 prop drill.
  // T-270: listOwnerBotVisits raw .order().limit() 으로 복원 — owner_recent_bot_visits RPC 8초 회피.
  const [fullPlaces, mentionMap, statsBundle, recentBotVisits, billing, sectorMap] = await Promise.all([
    timed('loadFullPlacesForOwner', loadFullPlacesForOwner(placeIds)),
    timed('countMentionsByPlace', countMentionsByPlace(placeIds)),
    timed('fetchOwnerStatsBundle', fetchOwnerStatsBundle(placeIds, trendDays, now)),
    timed('listOwnerBotVisits', listOwnerBotVisits(placeIds, 10, trendDays, now, pathMap)),
    timed('loadBillingState', loadBillingState(user.id, now, user.email)),
    timed('loadSectorMap', loadSectorMap()),
  ])
  // 동기 aggregate — DB 호출 없음. timing 측정 의미 없으므로 즉시 변환.
  const botSummary = getOwnerBotSummaryFromBundle(statsBundle, placeIds)
  const dailyTrend = getOwnerDailyTrendFromBundle(statsBundle)
  debugTiming.TOTAL_loadOwnerDashboard = Date.now() - dashStart

  // 3. 각 place 에 대해 AEO 점수 계산.
  const places: OwnerPlaceSummary[] = []
  for (const p of ownerRows) {
    const full = fullPlaces.get(p.id)
    const mc = mentionMap.get(p.id)
    const contentMentions = mc?.contentMentions ?? 0

    const aeo = scorePlaceAeo({
      place: {
        name: full?.name ?? p.name,
        address: full?.address ?? '',
        phone: full?.phone ?? undefined,
        lastUpdated: full?.updated_at ?? undefined,
        faqs: parseJsonArray<FAQ>(full?.faqs),
        reviewSummaries: parseJsonArray<ReviewSummary>(full?.review_summaries),
        reviewCount: full?.review_count ?? undefined,
        images: parseJsonArray<PlaceImage>(full?.images),
        imageUrl: full?.image_url ?? undefined,
        openingHours: full?.opening_hours ?? undefined,
        services: parseJsonArray<Service>(full?.services),
      },
      mentionCount: contentMentions,
      now,
    })

    places.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      city: p.city,
      category: p.category,
      sector: sectorMap.get(p.category) ?? null,
      status: p.status,
      createdAt: full?.created_at ?? null,
      updatedAt: p.updated_at,
      aeoScore: aeo.score,
      aeoGrade: aeo.grade,
      missingCount: aeo.rules.filter((r) => !r.passed).length,
      aeoDeficiencies: aeo.rules.filter((r) => !r.passed).map((r) => r.label),
      aeoRules: aeo.rules,
      mentionCount: contentMentions,
    })
  }

  // 4. 측정 윈도 (운영/테스트 계정은 measurement-window 에서 우회)
  const window = getMeasurementWindow(
    places.map((p) => p.createdAt),
    now,
    { ownerEmail: user.email },
  )

  // 5. 할 일 (full place 정보를 todos 입력으로 변환)
  const todos = detectOwnerTodos({
    places: places.map((p) => {
      const full = fullPlaces.get(p.id)
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        city: p.city,
        category: p.category,
        sector: p.sector ?? undefined,
        description: full?.description ?? undefined,
        faqs: parseJsonArray<FAQ>(full?.faqs),
        images: parseJsonArray<PlaceImage>(full?.images),
        imageUrl: full?.image_url ?? undefined,
        openingHours: full?.opening_hours ?? null,
        reviewSummaries: parseJsonArray<ReviewSummary>(full?.review_summaries),
        lastReviewCheckedAt: full?.updated_at ?? null,
      }
    }),
    billing: {
      hasCard: billing.hasCard,
      pilotRemainingDays: billing.pilotRemainingDays,
    },
    medicalViolations: [],          // Phase 3 검증기 연계 후 채움
    now,
  })

  // 6. 평균 AEO 점수
  const averageAeoScore = places.length === 0
    ? null
    : Math.round(places.reduce((s, p) => s + p.aeoScore, 0) / places.length)

  const isAdmin = isAdminEmail(user.email)
  return {
    user,
    places,
    window,
    botSummary,
    dailyTrend,
    recentBotVisits,
    todos,
    billing,
    averageAeoScore,
    trendDays,
    isAdmin,
    debugTiming: isAdmin ? debugTiming : undefined,
  }
}
