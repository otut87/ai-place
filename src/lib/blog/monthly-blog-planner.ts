// T-205 — 월 블로그 발행 플래너 (단일 요금제 · 업체별 월 5편 할당).
//
// 모델 교체 이력:
//   - T-196 (구): aiplace.kr 공용 풀 하루 10편 (detail 4/compare 2/guide 2/keyword 2)
//   - T-205 (신): 구독 활성 업체별 월 5편. 유형 로테이션 + 5일 분산.
//
// 핵심 설계:
//   1) "할당일" 계산 — 업체별 5일, 월 내 균등 분산 + place.id 해시로 오프셋.
//      매월 재계산(daysInMonth 가 28~31 로 변동).
//   2) 해당 업체의 이번 달 발행 수 < 5 이고 오늘이 할당일이면 큐에 INSERT.
//   3) 유형 로테이션: detail, compare, guide, keyword, detail (n = 이번 달 이미 발행 수).
//      compare 후보 없음(업체 1개뿐인 city/category) → detail 로 fallback.
//   4) 각 토픽은 09~22시 랜덤 시각 spread.

import { getAdminClient } from '@/lib/supabase/admin-client'
import { pickTargetQuery } from './keyword-bank'
import { ANGLE_KEYS, type AngleKey } from './keyword-generator'
import { spreadSchedule } from './schedule-spreader'
import { MONTHLY_BLOG_QUOTA_PER_PLACE } from '@/lib/billing/types'

export type PostType = 'detail' | 'compare' | 'guide' | 'keyword'

/** 5편 로테이션 순서. n=0..4 를 유형에 매핑. */
const TYPE_ROTATION: PostType[] = ['detail', 'compare', 'guide', 'keyword', 'detail']

const DEFAULT_ANGLE_BY_TYPE: Record<PostType, AngleKey> = {
  detail: 'review-deepdive',
  compare: 'comparison-context',
  guide: 'procedure-guide',
  keyword: 'first-visit',
}

export interface PlanMonthlyBlogsInput {
  /** KST YYYY-MM-DD. 이 날짜 기준으로 오늘 할당된 업체들만 큐에 insert. */
  plannedDate: string
  /** 테스트 주입용 — 업체별 월 할당량. 기본 5. */
  monthlyQuotaPerPlace?: number
  /** 테스트 주입용 — 발행 시간 분산 범위. */
  startHour?: number
  endHour?: number
}

export interface PlannedTopicRow {
  planned_date: string
  post_type: PostType
  angle: AngleKey | null
  sector: string
  city: string
  category: string | null
  target_query: string | null
  keyword_id: string | null
  place_id: string | null
  scheduled_for: string             // ISO UTC
}

export interface PlanMonthlyBlogsResult {
  rows: PlannedTopicRow[]
  skipped: Array<{ placeId: string | null; reason: string }>
  /** 업체별 이번 달 누적 발행 수 (이번 run 포함). 디버깅 용. */
  usageByPlace: Array<{ placeId: string; placeName: string; monthTotal: number }>
}

interface SubscribedPlace {
  id: string
  name: string
  slug: string
  city: string
  category: string
  sector: string | null
}

// ── 날짜 유틸 ───────────────────────────────────────────────────
function parseKstDate(iso: string): { year: number; month: number; day: number; daysInMonth: number } {
  const [ys, ms, ds] = iso.split('-').map((n) => parseInt(n, 10))
  const daysInMonth = new Date(ys, ms, 0).getDate()       // JS: month 1-based → 다음달 0일 = 이번달 마지막 일
  return { year: ys, month: ms, day: ds, daysInMonth }
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * place 에 대해 이번 달의 할당일 5개를 계산.
 * 예: daysInMonth=30, quota=5 → 기본 6일 간격 [1, 7, 13, 19, 25].
 * place.id 해시로 0~5 오프셋을 주어 업체마다 다른 날 발행되도록 분산.
 * 결과는 항상 1..daysInMonth 범위 내에 clamp.
 */
export function computeAssignedDays(
  placeId: string,
  daysInMonth: number,
  quota: number = MONTHLY_BLOG_QUOTA_PER_PLACE,
): number[] {
  if (quota <= 0 || daysInMonth <= 0) return []
  const stride = daysInMonth / quota
  const offset = hashString(placeId) % Math.max(1, Math.floor(stride))
  const days = new Set<number>()
  for (let n = 0; n < quota; n += 1) {
    const raw = Math.floor(stride * n) + 1 + offset
    const day = Math.min(daysInMonth, Math.max(1, raw))
    days.add(day)
  }
  // 중복 제거로 개수가 줄었을 경우 남은 일을 앞에서부터 채움.
  while (days.size < quota) {
    for (let d = 1; d <= daysInMonth && days.size < quota; d += 1) {
      if (!days.has(d)) days.add(d)
    }
  }
  return Array.from(days).sort((a, b) => a - b)
}

/** n 번째 발행 (0-based) 의 유형 결정. compare 불가능하면 detail 로 fallback. */
export function pickPostTypeForN(n: number, canCompare: boolean): PostType {
  const t = TYPE_ROTATION[n % TYPE_ROTATION.length]
  if (t === 'compare' && !canCompare) return 'detail'
  return t
}

// ── Supabase 조회 ───────────────────────────────────────────────
async function fetchSubscribedPlaces(): Promise<SubscribedPlace[]> {
  const admin = getAdminClient()
  if (!admin) return []

  // 구독 '활성' 또는 '결제 임박(pending/past_due)' 고객의 업체 전부.
  // trial 만 돌고 있는 고객도 구독(subscriptions row)은 pending 으로 보유 중이면 발행 대상.
  // 구독 없이 파일럿만 돌고 있는 신규 고객(가입 직후)은 customers 에서 trial 상 active 만 봐도 된다.
  // T-205 단순화: subscriptions row 가 존재(해지 제외) = 발행 대상.
  const { data: subs } = await admin
    .from('subscriptions')
    .select('customer_id, status')
    .in('status', ['pending', 'active', 'past_due', 'pending_cancellation'])
  const subCustomerIds = new Set(((subs ?? []) as Array<{ customer_id: string }>).map((r) => r.customer_id))

  // 파일럿 기간인 고객도 발행 대상(가입만 해도 블로그 시작). trial_ends_at 이 있는 customer.
  const { data: pilots } = await admin
    .from('customers')
    .select('id, trial_ends_at')
    .not('trial_ends_at', 'is', null)
  const trialCustomerIds = new Set(
    ((pilots ?? []) as Array<{ id: string; trial_ends_at: string | null }>)
      .filter((c) => c.trial_ends_at && Date.parse(c.trial_ends_at) > Date.now() - 24 * 60 * 60 * 1000)
      .map((c) => c.id),
  )

  const eligibleCustomerIds = new Set<string>([...subCustomerIds, ...trialCustomerIds])
  if (eligibleCustomerIds.size === 0) return []

  const { data: places } = await admin
    .from('places')
    .select('id, name, slug, city, category, customer_id, owner_id')
    .eq('status', 'active')
    .in('customer_id', Array.from(eligibleCustomerIds))
  const placeRows = (places ?? []) as Array<{
    id: string; name: string; slug: string; city: string; category: string
    customer_id: string | null; owner_id: string | null
  }>

  // customer_id 가 비어있어도 owner_id 로 연결된 케이스는 별도 처리(운영 초기 보완).
  // 여기선 customer_id 기준만.

  const { data: cats } = await admin.from('categories').select('slug, sector')
  const sectorBySlug = new Map<string, string | null>()
  for (const c of (cats ?? []) as Array<{ slug: string; sector: string | null }>) {
    sectorBySlug.set(c.slug, c.sector)
  }

  return placeRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    city: p.city,
    category: p.category,
    sector: sectorBySlug.get(p.category) ?? null,
  }))
}

async function fetchMonthlyUsage(
  placeIds: string[],
  monthStartIso: string,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  for (const id of placeIds) result.set(id, 0)

  if (placeIds.length === 0) return result
  const admin = getAdminClient()
  if (!admin) return result

  // blog_posts.places_mentioned 가 해당 place_id 를 포함하는 이번 달 레코드 수.
  // status draft/active 모두 할당 사용으로 간주 (이미 생성 시점에 quota 소비).
  const { data } = await admin
    .from('blog_posts')
    .select('places_mentioned, created_at, status')
    .gte('created_at', monthStartIso)
    .in('status', ['draft', 'active'])
  for (const row of (data ?? []) as Array<{ places_mentioned: string[] | null; status: string }>) {
    for (const pid of row.places_mentioned ?? []) {
      if (result.has(pid)) result.set(pid, (result.get(pid) ?? 0) + 1)
    }
  }
  return result
}

async function fetchRecentAnglesByPlace(
  placeIds: string[],
  days = 30,
): Promise<Map<string, Set<AngleKey>>> {
  const result = new Map<string, Set<AngleKey>>()
  for (const id of placeIds) result.set(id, new Set())
  if (placeIds.length === 0) return result

  const admin = getAdminClient()
  if (!admin) return result

  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await admin
    .from('blog_posts')
    .select('places_mentioned, angle')
    .gte('created_at', since)
    .not('angle', 'is', null)
  for (const row of (data ?? []) as Array<{ places_mentioned: string[] | null; angle: string }>) {
    if (!ANGLE_KEYS.includes(row.angle as AngleKey)) continue
    for (const pid of row.places_mentioned ?? []) {
      const set = result.get(pid)
      if (set) set.add(row.angle as AngleKey)
    }
  }
  return result
}

function pickAngleForPlace(placeId: string, used: Set<AngleKey>, seed: string, fallback: AngleKey): AngleKey {
  const available = ANGLE_KEYS.filter((a) => !used.has(a))
  const pool = available.length > 0 ? available : ANGLE_KEYS
  const h = hashString(`${placeId}-${seed}`)
  return pool[h % pool.length] ?? fallback
}

/** 같은 city+category 에 active 업체 2곳 이상이면 compare 가능. */
function buildCompareMap(places: SubscribedPlace[]): Set<string> {
  const counts = new Map<string, number>()
  for (const p of places) {
    const k = `${p.city}/${p.category}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const ok = new Set<string>()
  for (const [k, n] of counts.entries()) if (n >= 2) ok.add(k)
  return ok
}

// ── 메인 ────────────────────────────────────────────────────────
export async function planMonthlyBlogs(input: PlanMonthlyBlogsInput): Promise<PlanMonthlyBlogsResult> {
  const { year, month, day, daysInMonth } = parseKstDate(input.plannedDate)
  const quota: number = input.monthlyQuotaPerPlace ?? MONTHLY_BLOG_QUOTA_PER_PLACE

  const places = await fetchSubscribedPlaces()
  if (places.length === 0) {
    return { rows: [], skipped: [{ placeId: null, reason: '구독 활성 업체 없음' }], usageByPlace: [] }
  }

  const placeIds = places.map((p) => p.id)
  // KST 월 1일 00:00 을 UTC 로 환산: KST = UTC+9 → UTC 15일 전날 15:00
  const monthStartUtc = new Date(Date.UTC(year, month - 1, 1) - 9 * 3_600_000).toISOString()

  const [usage, usedAngles] = await Promise.all([
    fetchMonthlyUsage(placeIds, monthStartUtc),
    fetchRecentAnglesByPlace(placeIds, 30),
  ])

  const compareOk = buildCompareMap(places)

  const rows: PlannedTopicRow[] = []
  const skipped: PlanMonthlyBlogsResult['skipped'] = []

  // 오늘 할당된 업체들만 필터 → 필요 편수 계산 → 시간 spread.
  const todaysPlaces: Array<{ place: SubscribedPlace; usedN: number }> = []
  for (const place of places) {
    const assigned = computeAssignedDays(place.id, daysInMonth, quota)
    const usedN = usage.get(place.id) ?? 0
    if (!assigned.includes(day)) continue
    if (usedN >= quota) {
      skipped.push({ placeId: place.id, reason: `월 ${quota}편 완료` })
      continue
    }
    todaysPlaces.push({ place, usedN })
  }

  if (todaysPlaces.length === 0) {
    return {
      rows: [],
      skipped: skipped.length > 0 ? skipped : [{ placeId: null, reason: '오늘 할당된 업체 없음' }],
      usageByPlace: places.map((p) => ({
        placeId: p.id,
        placeName: p.name,
        monthTotal: usage.get(p.id) ?? 0,
      })),
    }
  }

  const slots = spreadSchedule({
    count: todaysPlaces.length,
    plannedDate: input.plannedDate,
    startHour: input.startHour,
    endHour: input.endHour,
  })

  for (let i = 0; i < todaysPlaces.length; i += 1) {
    const { place, usedN } = todaysPlaces[i]
    const canCompare = compareOk.has(`${place.city}/${place.category}`)
    const postType = pickPostTypeForN(usedN, canCompare)

    const angle = postType === 'compare'
      ? 'comparison-context'
      : pickAngleForPlace(place.id, usedAngles.get(place.id) ?? new Set(), `${input.plannedDate}-${postType}`, DEFAULT_ANGLE_BY_TYPE[postType])

    const tq = await pickTargetQuery({
      sector: place.sector ?? 'medical',
      city: place.city,
      angle,
    })

    rows.push({
      planned_date: input.plannedDate,
      post_type: postType,
      angle,
      sector: place.sector ?? 'medical',
      city: place.city,
      category: place.category,
      target_query: tq?.keyword ?? null,
      keyword_id: tq?.id ?? null,
      // keyword 유형도 이 플래너에선 "해당 업체 주인공" 을 유지 (content 안에 업체 강조).
      place_id: place.id,
      scheduled_for: slots[i]?.scheduledForUtc ?? slots[slots.length - 1].scheduledForUtc,
    })
  }

  return {
    rows,
    skipped,
    usageByPlace: places.map((p) => {
      const base = usage.get(p.id) ?? 0
      const addedToday = rows.filter((r) => r.place_id === p.id).length
      return { placeId: p.id, placeName: p.name, monthTotal: base + addedToday }
    }),
  }
}
