// T-196 — 일일 토픽 플래너 (Phase 4).
//
// 하루 10편 분배:
//   detail   4 — 업체상세 (verifiedPlace 1개 중심)
//   compare  2 — 비교표 (verifiedPlaces 2~3개)
//   guide    2 — 업종 가이드 (city+category 단위)
//   keyword  2 — 키워드 타깃 (다양한 city+category)
//
// 제약:
//  - 최근 30일 내 (place_id, angle) 조합 중복 금지 (Phase 3 pickAngle 과 같은 원칙)
//  - 같은 (city, category) 조합이 하루에 3번 이상 겹치지 않도록
//  - verifiedPlaces 부족하면 compare → guide/keyword 로 대체

import { getAdminClient } from '@/lib/supabase/admin-client'
import { pickTargetQuery } from './keyword-bank'
import type { AngleKey } from './keyword-generator'
import { ANGLE_KEYS } from './keyword-generator'
import { spreadSchedule } from './schedule-spreader'

export type PostType = 'detail' | 'compare' | 'guide' | 'keyword'

const DEFAULT_DISTRIBUTION: Record<PostType, number> = {
  detail: 4,
  compare: 2,
  guide: 2,
  keyword: 2,
}

export interface PlanDailyTopicsInput {
  plannedDate: string                 // 'YYYY-MM-DD' KST
  distribution?: Partial<Record<PostType, number>>
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
  scheduled_for: string              // ISO (UTC)
}

export interface PlanDailyTopicsResult {
  rows: PlannedTopicRow[]
  skipped: Array<{ reason: string; postType: PostType }>
  cityCategoryUsage: Record<string, number>   // "cheonan/dermatology": 3
}

type PlaceMeta = {
  id: string
  slug: string
  city: string
  category: string
  sector: string | null
}

async function fetchActivePlaces(admin: ReturnType<typeof getAdminClient>): Promise<PlaceMeta[]> {
  if (!admin) return []
  // places 에는 sector 컬럼이 없으므로 categories 조회 → 매핑.
  const [placesRes, categoriesRes] = await Promise.all([
    admin.from('places').select('id, slug, city, category').eq('status', 'active'),
    admin.from('categories').select('slug, sector'),
  ])
  const placeRows = (placesRes.data ?? []) as Array<{ id: string; slug: string; city: string; category: string }>
  const catRows = (categoriesRes.data ?? []) as Array<{ slug: string; sector: string | null }>
  const sectorBySlug = new Map<string, string | null>()
  for (const c of catRows) sectorBySlug.set(c.slug, c.sector)
  return placeRows.map(p => ({
    id: p.id, slug: p.slug, city: p.city, category: p.category,
    sector: sectorBySlug.get(p.category) ?? null,
  }))
}

async function fetchRecentAngleByPlace(
  admin: ReturnType<typeof getAdminClient>,
  days = 30,
): Promise<Map<string, Set<AngleKey>>> {
  const map = new Map<string, Set<AngleKey>>()
  if (!admin) return map
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await admin
    .from('blog_posts')
    .select('related_place_slugs, angle')
    .gte('created_at', since)
    .not('angle', 'is', null)
  const rows = (data ?? []) as Array<{ related_place_slugs: string[] | null; angle: string }>
  for (const r of rows) {
    if (!ANGLE_KEYS.includes(r.angle as AngleKey)) continue
    for (const slug of r.related_place_slugs ?? []) {
      if (!map.has(slug)) map.set(slug, new Set())
      map.get(slug)!.add(r.angle as AngleKey)
    }
  }
  return map
}

/**
 * place 에 대해 최근 30일 미사용 angle 중 하나 선택.
 * 모두 소진된 경우 random-ish (plannedDate + place seed) 로 선택.
 */
function pickAngleForPlace(
  placeSlug: string,
  used: Map<string, Set<AngleKey>>,
  seed: string,
  excludeAngles: AngleKey[] = [],
): AngleKey {
  const usedSet = used.get(placeSlug) ?? new Set<AngleKey>()
  const excludeSet = new Set<AngleKey>([...usedSet, ...excludeAngles])
  const available = ANGLE_KEYS.filter(a => !excludeSet.has(a))
  if (available.length > 0) {
    let h = 0
    for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0
    return available[Math.abs(h) % available.length]
  }
  // 모두 소진 — 제외 목록만 빼고 random
  const fallback = ANGLE_KEYS.filter(a => !excludeAngles.includes(a))
  let h = 0
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0
  return fallback[Math.abs(h) % fallback.length] ?? 'review-deepdive'
}

function incCityCategory(
  usage: Record<string, number>,
  city: string,
  category: string | null,
): void {
  const k = `${city}/${category ?? '-'}`
  usage[k] = (usage[k] ?? 0) + 1
}

function okCityCategory(
  usage: Record<string, number>,
  city: string,
  category: string | null,
  max = 3,
): boolean {
  const k = `${city}/${category ?? '-'}`
  return (usage[k] ?? 0) < max
}

/**
 * 하루치 10편 토픽 계획.
 * 반환 rows 는 blog_topic_queue 에 그대로 INSERT 가능한 형태.
 */
export async function planDailyTopics(
  input: PlanDailyTopicsInput,
): Promise<PlanDailyTopicsResult> {
  const admin = getAdminClient()
  if (!admin) {
    return {
      rows: [],
      skipped: [{ reason: 'admin client 미초기화', postType: 'detail' }],
      cityCategoryUsage: {},
    }
  }

  const dist = { ...DEFAULT_DISTRIBUTION, ...(input.distribution ?? {}) }
  const totalCount = (Object.keys(dist) as PostType[]).reduce((s, k) => s + (dist[k] ?? 0), 0)
  const slots = spreadSchedule({
    count: totalCount,
    plannedDate: input.plannedDate,
    startHour: input.startHour,
    endHour: input.endHour,
  })

  const places = await fetchActivePlaces(admin)
  const usedAngles = await fetchRecentAngleByPlace(admin, 30)

  const rows: PlannedTopicRow[] = []
  const skipped: PlanDailyTopicsResult['skipped'] = []
  const cityCategoryUsage: Record<string, number> = {}
  let slotIdx = 0

  const nextSlot = () => slots[slotIdx++]?.scheduledForUtc ?? slots[slots.length - 1].scheduledForUtc

  // ─── detail × N ─────────────────────────────────────────
  // 업체별로 순회하며 최근 30일에 안 쓴 angle 있는 업체 우선.
  const freshPlaces = [...places].sort((a, b) => {
    const ua = usedAngles.get(a.slug)?.size ?? 0
    const ub = usedAngles.get(b.slug)?.size ?? 0
    return ua - ub
  })
  for (let i = 0; i < (dist.detail ?? 0); i += 1) {
    const place = freshPlaces[i]
    if (!place) {
      skipped.push({ reason: '업체 풀 부족 → guide 로 대체', postType: 'detail' })
      // guide 로 fallback (keyword 뱅크에서 target 찾아 게재)
      const gp = places[0]
      if (!gp) {
        skipped.push({ reason: '전체 업체 0곳', postType: 'detail' })
        continue
      }
      const tq = await pickTargetQuery({
        sector: gp.sector ?? 'medical', city: gp.city, angle: null,
      })
      rows.push({
        planned_date: input.plannedDate,
        post_type: 'guide',
        angle: null,
        sector: gp.sector ?? 'medical',
        city: gp.city,
        category: gp.category,
        target_query: tq?.keyword ?? null,
        keyword_id: tq?.id ?? null,
        place_id: null,
        scheduled_for: nextSlot(),
      })
      incCityCategory(cityCategoryUsage, gp.city, gp.category)
      continue
    }

    if (!okCityCategory(cityCategoryUsage, place.city, place.category)) {
      skipped.push({ reason: `${place.city}/${place.category} 일일 한도 초과`, postType: 'detail' })
      continue
    }

    const angle = pickAngleForPlace(place.slug, usedAngles, `${input.plannedDate}-detail-${i}`)
    // postType 은 pickTargetQuery 에 넘기지 않음 — seed 된 키워드의 post_type 이 null 이어도 매칭되도록.
    const tq = await pickTargetQuery({
      sector: place.sector ?? 'medical', city: place.city, angle,
    })
    rows.push({
      planned_date: input.plannedDate,
      post_type: 'detail',
      angle,
      sector: place.sector ?? 'medical',
      city: place.city,
      category: place.category,
      target_query: tq?.keyword ?? null,
      keyword_id: tq?.id ?? null,
      place_id: place.id,
      scheduled_for: nextSlot(),
    })
    incCityCategory(cityCategoryUsage, place.city, place.category)
  }

  // ─── compare × N ─────────────────────────────────────────
  // city+category 조합에 active 업체 2+ 필요.
  const byCityCategory = new Map<string, PlaceMeta[]>()
  for (const p of places) {
    const k = `${p.city}/${p.category}`
    if (!byCityCategory.has(k)) byCityCategory.set(k, [])
    byCityCategory.get(k)!.push(p)
  }
  const comparablePairs = Array.from(byCityCategory.entries())
    .filter(([_, ps]) => ps.length >= 2)
    .map(([k, ps]) => ({ key: k, places: ps }))

  for (let i = 0; i < (dist.compare ?? 0); i += 1) {
    const pair = comparablePairs[i]
    if (!pair) {
      skipped.push({ reason: '비교 가능한 city+category 부족', postType: 'compare' })
      continue
    }
    const first = pair.places[0]
    if (!okCityCategory(cityCategoryUsage, first.city, first.category)) {
      skipped.push({ reason: `${pair.key} 일일 한도 초과`, postType: 'compare' })
      continue
    }
    const tq = await pickTargetQuery({
      sector: first.sector ?? 'medical', city: first.city, angle: 'comparison-context',
    })
    rows.push({
      planned_date: input.plannedDate,
      post_type: 'compare',
      angle: 'comparison-context',  // compare 는 항상 고정 (angles.ts 와 일관)
      sector: first.sector ?? 'medical',
      city: first.city,
      category: first.category,
      target_query: tq?.keyword ?? null,
      keyword_id: tq?.id ?? null,
      place_id: null,
      scheduled_for: nextSlot(),
    })
    incCityCategory(cityCategoryUsage, first.city, first.category)
  }

  // ─── guide × N ─────────────────────────────────────────
  // city+category 가이드 — 업체 1곳 이상이면 가능.
  const guideCandidates = Array.from(byCityCategory.entries()).map(([k, ps]) => ({ key: k, places: ps }))
  for (let i = 0; i < (dist.guide ?? 0); i += 1) {
    const cand = guideCandidates[i]
    if (!cand) {
      skipped.push({ reason: 'guide 후보 부족', postType: 'guide' })
      continue
    }
    const first = cand.places[0]
    if (!okCityCategory(cityCategoryUsage, first.city, first.category)) continue
    const angle = pickAngleForPlace('__guide__', usedAngles, `${input.plannedDate}-guide-${i}`, ['comparison-context'])
    const tq = await pickTargetQuery({
      sector: first.sector ?? 'medical', city: first.city, angle,
    })
    rows.push({
      planned_date: input.plannedDate,
      post_type: 'guide',
      angle,
      sector: first.sector ?? 'medical',
      city: first.city,
      category: first.category,
      target_query: tq?.keyword ?? null,
      keyword_id: tq?.id ?? null,
      place_id: null,
      scheduled_for: nextSlot(),
    })
    incCityCategory(cityCategoryUsage, first.city, first.category)
  }

  // ─── keyword × N ─────────────────────────────────────────
  // 키워드 뱅크에서 다양한 city+category 조합으로 pop.
  const citySectorSeen = new Set<string>()
  const sectorCityPool: Array<{ sector: string; city: string }> = []
  for (const p of places) {
    const key = `${p.sector ?? 'medical'}/${p.city}`
    if (!citySectorSeen.has(key)) {
      citySectorSeen.add(key)
      sectorCityPool.push({ sector: p.sector ?? 'medical', city: p.city })
    }
  }

  for (let i = 0; i < (dist.keyword ?? 0); i += 1) {
    const combo = sectorCityPool[i % Math.max(1, sectorCityPool.length)]
    if (!combo) {
      skipped.push({ reason: 'keyword city+sector 조합 부족', postType: 'keyword' })
      continue
    }
    const angle = pickAngleForPlace('__keyword__', usedAngles, `${input.plannedDate}-keyword-${i}`)
    const tq = await pickTargetQuery({
      sector: combo.sector, city: combo.city, angle,
    })
    if (!tq) {
      skipped.push({ reason: `${combo.sector}/${combo.city} 키워드 풀 없음`, postType: 'keyword' })
      continue
    }
    rows.push({
      planned_date: input.plannedDate,
      post_type: 'keyword',
      angle,
      sector: combo.sector,
      city: combo.city,
      category: null,
      target_query: tq.keyword,
      keyword_id: tq.id,
      place_id: null,
      scheduled_for: nextSlot(),
    })
    incCityCategory(cityCategoryUsage, combo.city, null)
  }

  return { rows, skipped, cityCategoryUsage }
}
