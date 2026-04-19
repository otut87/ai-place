'use server'

// T-151/T-152/T-153 — Owner 자체 업체 등록.
// Draft → auto-approve 조건 충족 시 바로 active.

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export interface OwnerPlaceDraft {
  name: string
  city: string          // slug
  category: string      // slug
  address: string
  phone?: string
  website?: string
  openingHours?: string
  description?: string
  tags?: string[]
  services?: Array<{ name: string; description?: string; priceRange?: string }>
  recommendedFor?: string[]
  strengths?: string[]
  images?: string[]
  naverPlaceUrl?: string
  kakaoMapUrl?: string
  googleBusinessUrl?: string
}

export type RegisterOutcome =
  | { success: true; placeId: string; slug: string; status: 'draft' | 'active'; autoApproved: boolean }
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

  // 2) customer 조회
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!customer) return { success: false, error: 'customer 레코드 없음 — 회원가입을 다시 완료해 주세요' }
  const customerId = (customer as { id: string }).id

  // 3) 중복 검사 — 같은 city+category 내 이름 유사도 0.8+
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

  // 4) slug 생성 (중복 회피)
  let slug = generateSlug(draft.name)
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

  // 5) 자동 승인 조건: 필수 + 이미지 1장 이상 + (전화번호 or 영업시간)
  const imagesOk = Array.isArray(draft.images) && draft.images.length >= 1
  const contactOk = Boolean(draft.phone?.trim() || draft.openingHours?.trim())
  const autoApproved = imagesOk && contactOk
  const status = autoApproved ? 'active' : 'draft'

  // 6) insert
  const { data: inserted, error: insertError } = await admin
    .from('places')
    .insert({
      name: draft.name.trim(),
      slug,
      city: draft.city,
      category: draft.category,
      address: draft.address.trim(),
      phone: draft.phone ? normalizePhone(draft.phone) : null,
      website: draft.website?.trim() || null,
      opening_hours: draft.openingHours?.trim() || null,
      description: draft.description?.trim() || null,
      tags: draft.tags ?? [],
      services: draft.services ?? [],
      recommended_for: draft.recommendedFor ?? [],
      strengths: draft.strengths ?? [],
      images: draft.images ?? [],
      naver_place_url: draft.naverPlaceUrl ?? null,
      kakao_map_url: draft.kakaoMapUrl ?? null,
      google_business_url: draft.googleBusinessUrl ?? null,
      customer_id: customerId,
      status,
      owner_id: user.id,
      owner_email: user.email ?? null,
    })
    .select('id')
    .single()
  if (insertError || !inserted) {
    return { success: false, error: insertError?.message ?? 'places insert 실패' }
  }

  const placeId = (inserted as { id: string }).id
  revalidatePath('/owner')
  if (status === 'active') {
    revalidatePath(`/${draft.city}/${draft.category}`)
    revalidatePath(`/${draft.city}/${draft.category}/${slug}`)
  }

  return { success: true, placeId, slug, status, autoApproved }
}
