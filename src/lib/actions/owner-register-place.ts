'use server'

// T-151/T-152/T-153 — Owner 자체 업체 등록.
// Draft → auto-approve 조건 충족 시 바로 active.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export interface OwnerPlaceDraft {
  name: string
  nameEn?: string
  slug?: string         // 미지정 시 자동 생성
  city: string          // slug
  category: string      // slug
  address: string
  roadAddress?: string
  jibunAddress?: string
  latitude?: number
  longitude?: number
  phone?: string
  website?: string
  openingHours?: string | string[]   // 문자열(기존) 또는 admin 포맷 배열(["Mo 09:00-18:00", ...])
  description?: string
  tags?: string[]
  services?: Array<{ name: string; description?: string; priceRange?: string }>
  faqs?: Array<{ question: string; answer: string }>
  recommendedFor?: string[]
  strengths?: string[]
  images?: Array<{ url: string; alt: string; type: 'exterior' | 'interior' | 'treatment' | 'staff' | 'equipment' }>
  naverPlaceUrl?: string
  kakaoMapUrl?: string
  googleBusinessUrl?: string
  googlePlaceId?: string
  rating?: number
  reviewCount?: number
}

export type RegisterOutcome =
  | { success: true; placeId: string; slug: string; status: 'pending' | 'active'; autoApproved: boolean }
  | { success: false; error: string; duplicatePlaceId?: string }

const SLUG_PATTERN = /^[a-z0-9-]+$/
const NAME_SIMILARITY_THRESHOLD = 0.8

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
}

/** Levenshtein 기반 유사도 (0~1). */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0
  const an = normalize(a)
  const bn = normalize(b)
  if (an === bn) return 1
  const maxLen = Math.max(an.length, bn.length)
  if (maxLen === 0) return 0
  // 간이 Levenshtein
  const dp: number[][] = Array.from({ length: an.length + 1 }, () => new Array(bn.length + 1).fill(0))
  for (let i = 0; i <= an.length; i++) dp[i][0] = i
  for (let j = 0; j <= bn.length; j++) dp[0][j] = j
  for (let i = 1; i <= an.length; i++) {
    for (let j = 1; j <= bn.length; j++) {
      dp[i][j] = an[i - 1] === bn[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return 1 - dp[an.length][bn.length] / maxLen
}

function generateSlug(name: string): string {
  const base = name.toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
  // ASCII 강제 (한글 포함 시 랜덤 suffix)
  if (/[가-힣]/.test(base)) {
    const ascii = base.replace(/[가-힣]/g, '')
    const suffix = Math.random().toString(36).slice(2, 6)
    return (ascii || 'place') + '-' + suffix
  }
  return base || `place-${Math.random().toString(36).slice(2, 6)}`
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (/^010\d{8}$/.test(digits)) return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
  if (/^02\d{7,8}$/.test(digits)) return `02-${digits.slice(2, -4)}-${digits.slice(-4)}`
  return raw
}

export async function registerOwnerPlaceAction(draft: OwnerPlaceDraft): Promise<RegisterOutcome> {
  const user = await requireOwnerForAction()

  // 1) 필수 필드 검증
  if (!draft.name?.trim()) return { success: false, error: '업체명은 필수입니다' }
  if (!draft.city?.trim()) return { success: false, error: '도시를 선택해 주세요' }
  if (!draft.category?.trim()) return { success: false, error: '업종을 선택해 주세요' }
  if (!draft.address?.trim()) return { success: false, error: '주소를 입력해 주세요' }
  if (!SLUG_PATTERN.test(draft.city) || !SLUG_PATTERN.test(draft.category)) {
    return { success: false, error: 'city/category slug 가 올바르지 않습니다' }
  }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 2) customer 조회 + 자동 복구
  // 과거 버그로 auth user 는 생성됐지만 customers row 가 없는 케이스 대응.
  // 또는 email 로만 등록된 기존 고객의 user_id 연결.
  let customerId: string | null = null
  const { data: customerByUser } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (customerByUser) {
    customerId = (customerByUser as { id: string }).id
  } else if (user.email) {
    // 이메일로 찾고 user_id 연결
    const { data: customerByEmail } = await admin
      .from('customers')
      .select('id, user_id')
      .eq('email', user.email)
      .maybeSingle()
    const byEmail = customerByEmail as { id: string; user_id: string | null } | null
    if (byEmail) {
      if (!byEmail.user_id) {
        await admin.from('customers').update({ user_id: user.id }).eq('id', byEmail.id)
      }
      customerId = byEmail.id
    }
  }
  if (!customerId) {
    // 완전 신규: 파일럿 30일로 customers row 생성
    const now = new Date()
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    const { data: created, error: createErr } = await admin
      .from('customers')
      .insert({
        email: user.email ?? `${user.id}@placeholder.local`,
        user_id: user.id,
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnd.toISOString(),
      })
      .select('id')
      .single()
    if (createErr || !created) {
      return { success: false, error: `customer 자동 생성 실패: ${createErr?.message ?? 'unknown'}` }
    }
    customerId = (created as { id: string }).id
  }

  // 3) 중복 검사 — 3단계 방어 (googlePlaceId → 좌표 근접 → 이름+주소 유사도)
  // 3-a) googlePlaceId 유니크: 같은 Google 업체 ID 는 절대 중복 불가.
  if (draft.googlePlaceId) {
    const { data: byGoogle } = await admin
      .from('places')
      .select('id, slug, city, category, name')
      .eq('google_place_id', draft.googlePlaceId)
      .maybeSingle()
    const match = byGoogle as { id: string; slug: string; city: string; category: string; name: string } | null
    if (match) {
      return {
        success: false,
        error: `이미 등록된 업체입니다: "${match.name}" (/${match.city}/${match.category}/${match.slug})`,
        duplicatePlaceId: match.id,
      }
    }
  }
  // 3-b) 좌표 근접성: ±0.0001도 (~10m) + 이름 약간 일치 → 동일 업체로 간주.
  if (draft.latitude != null && draft.longitude != null) {
    const COORD_DELTA = 0.0001
    const { data: nearby } = await admin
      .from('places')
      .select('id, slug, city, category, name, latitude, longitude')
      .gte('latitude', draft.latitude - COORD_DELTA)
      .lte('latitude', draft.latitude + COORD_DELTA)
      .gte('longitude', draft.longitude - COORD_DELTA)
      .lte('longitude', draft.longitude + COORD_DELTA)
    const nearbyList = (nearby ?? []) as Array<{ id: string; slug: string; city: string; category: string; name: string; latitude: number | null; longitude: number | null }>
    const normalize = (s: string) => s.replace(/\s|[^\p{L}\p{N}]/gu, '').toLowerCase()
    const draftNorm = normalize(draft.name)
    const nameMatch = nearbyList.find(p => {
      const n = normalize(p.name)
      return n === draftNorm || n.includes(draftNorm) || draftNorm.includes(n)
    })
    if (nameMatch) {
      return {
        success: false,
        error: `같은 위치에 이미 등록된 업체가 있습니다: "${nameMatch.name}" (/${nameMatch.city}/${nameMatch.category}/${nameMatch.slug})`,
        duplicatePlaceId: nameMatch.id,
      }
    }
  }
  // 3-c) 기존 이름+주소 유사도 검사 (fallback — 좌표 없는 케이스)
  const { data: existing } = await admin
    .from('places')
    .select('id, name, address, slug')
    .eq('city', draft.city)
    .eq('category', draft.category)

  const existingList = (existing ?? []) as Array<{ id: string; name: string; address: string; slug: string }>
  for (const p of existingList) {
    const nameScore = similarity(p.name, draft.name)
    const addrScore = similarity(p.address, draft.address)
    if (nameScore >= NAME_SIMILARITY_THRESHOLD && addrScore >= 0.6) {
      return {
        success: false,
        error: `이미 등록된 업체가 있습니다: "${p.name}" (/${draft.city}/${draft.category}/${p.slug})`,
        duplicatePlaceId: p.id,
      }
    }
  }

  // 4) slug 생성 (owner override > 자동 생성, 중복 회피)
  const initialSlug = (draft.slug && SLUG_PATTERN.test(draft.slug))
    ? draft.slug
    : generateSlug(draft.name)
  let slug = initialSlug
  let attempts = 0
  while (attempts < 5) {
    const { data: dup } = await admin
      .from('places')
      .select('id')
      .eq('city', draft.city)
      .eq('category', draft.category)
      .eq('slug', slug)
      .maybeSingle()
    if (!dup) break
    slug = generateSlug(draft.name)
    attempts += 1
  }

  // 5) opening_hours 정규화 — 문자열 → string[] 로 저장 (줄바꿈 또는 쉼표 기준).
  const hoursArray: string[] | null = Array.isArray(draft.openingHours)
    ? (draft.openingHours.filter(Boolean).length > 0 ? draft.openingHours.filter(Boolean) : null)
    : (draft.openingHours?.trim()
      ? draft.openingHours.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
      : null)

  // 6) 자동 승인 — "업체 실재" 신호 기반 (소유권 검증이 아닌 실재 검증)
  //   - Naver Local Search 결과 = 네이버 플레이스 등록 = 실재 영업중인 업체
  //   - googlePlaceId = Google 이 독립 확인한 업체 = 이중 검증
  //   - 둘 다 없으면 (순수 수동 등록) = admin 눈 한번 거침
  // 파일럿 구간 리스크: 경쟁사 악의 등록은 좌표 유니크 + googlePlaceId 유니크로 사전 차단됨 (위 3-a/3-b).
  const hasNaverMatch = Boolean(draft.naverPlaceUrl?.trim())
  const hasGoogleMatch = Boolean(draft.googlePlaceId?.trim())
  const autoApproved = hasNaverMatch || hasGoogleMatch
  // places.status 체크 제약: 'active' | 'pending' | 'rejected'. 실재 증거 없으면 pending.
  const status: 'active' | 'pending' = autoApproved ? 'active' : 'pending'

  // 7) insert
  // description/address 는 DB NOT NULL — 빈 문자열로 폴백.
  const descriptionSafe = draft.description?.trim() || `${draft.name.trim()} — ${draft.address.trim()}`
  const { data: inserted, error: insertError } = await admin
    .from('places')
    .insert({
      name: draft.name.trim(),
      name_en: draft.nameEn?.trim() || null,
      slug,
      city: draft.city,
      category: draft.category,
      address: draft.address.trim(),
      road_address: draft.roadAddress?.trim() || null,
      jibun_address: draft.jibunAddress?.trim() || null,
      latitude: draft.latitude ?? null,
      longitude: draft.longitude ?? null,
      phone: draft.phone ? normalizePhone(draft.phone) : null,
      homepage_url: draft.website?.trim() || null,
      opening_hours: hoursArray,
      description: descriptionSafe,
      tags: draft.tags ?? [],
      services: draft.services ?? [],
      faqs: draft.faqs ?? [],
      recommended_for: draft.recommendedFor ?? [],
      strengths: draft.strengths ?? [],
      images: draft.images ?? [],
      naver_place_url: draft.naverPlaceUrl ?? null,
      kakao_map_url: draft.kakaoMapUrl ?? null,
      google_business_url: draft.googleBusinessUrl ?? null,
      google_place_id: draft.googlePlaceId ?? null,
      rating: draft.rating ?? null,
      review_count: draft.reviewCount ?? 0,
      customer_id: customerId,
      status,
      owner_id: user.id,
      owner_email: user.email ?? null,
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    console.error('[registerOwnerPlaceAction] places insert 실패:', insertError, { slug, city: draft.city, category: draft.category })
    return { success: false, error: insertError?.message ?? 'places insert 실패' }
  }

  const placeId = (inserted as { id: string }).id

  // Phase 11 — googlePlaceId 가 있으면 Google 재수집 + Haiku 리뷰 요약을 백그라운드 큐잉.
  // 프로덕션 Vercel Cron 5분 주기로 pipeline-consume 가 처리.
  if (draft.googlePlaceId) {
    try {
      const { enqueuePlaceRefresh } = await import('@/lib/admin/pipeline-jobs')
      await enqueuePlaceRefresh(placeId, [
        'place.enrich_google',
        'place.summarize_google_reviews',
      ])
    } catch (e) {
      console.error('[registerOwnerPlaceAction] enqueue refresh failed:', e)
    }
  }

  revalidatePath('/owner')
  if (status === 'active') {
    revalidatePath(`/${draft.city}/${draft.category}`)
    revalidatePath(`/${draft.city}/${draft.category}/${slug}`)
  }

  return { success: true, placeId, slug, status, autoApproved }
}
