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
  type OwnerBotSummary, type OwnerDailyTrendRow, type OwnerBotVisit,
} from '@/lib/owner/bot-stats'
// T-264: getOwnerBotSummary / getOwnerDailyTrend 는 raw bot_visits 5중 페이지네이션 →
// 1.17M rows 위에서 5+ 라운드트립으로 hang. *Daily 버전이 053 사전집계 + today RPC 로
// <100ms 안에 동일 결과 반환.
// T-265: listOwnerBotVisits 도 paths IN (수천) 으로 raw 1.17M 에서 path 인덱스 부재 →
// 수만 row 스캔으로 수십초 hang. 054 RPC + (path, visited_at) composite 인덱스로 교체.
import {
  getOwnerBotSummaryDaily, getOwnerDailyTrendDaily, listOwnerBotVisitsDaily,
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

export async function loadOwnerDashboard(
  now: Date = new Date(),
  opts: LoadOwnerDashboardOptions = {},
): Promise<OwnerDashboardData> {
  const user = await requireOwnerUser()
  const trendDays = opts.trendDays ?? 30

  // 1. 오너 업체 목록 (owner_id / owner_email / customer_id 매칭)
  const ownerRows = await listOwnerPlaces()
  const placeIds = ownerRows.map((r) => r.id)

  // 2. 병렬 로드 — 모두 daily 사전집계 / RPC 기반 (T-264 + T-265).
  // 기존 fetchOwnerPathMap 사전 호출은 listOwnerBotVisits 가 paths IN 으로 raw bot_visits 를
  // 두드릴 때 prop drill 용이었음. 054 RPC 로 server-side INNER JOIN 처리 후 불필요.
  const [fullPlaces, mentionMap, botSummary, dailyTrend, recentBotVisits, billing, sectorMap] = await Promise.all([
    loadFullPlacesForOwner(placeIds),
    countMentionsByPlace(placeIds),
    getOwnerBotSummaryDaily(placeIds, trendDays, now),
    getOwnerDailyTrendDaily(placeIds, trendDays, now),
    listOwnerBotVisitsDaily(placeIds, 10, trendDays, now),
    loadBillingState(user.id, now, user.email),
    loadSectorMap(),
  ])

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
    isAdmin: isAdminEmail(user.email),
  }
}
