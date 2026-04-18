'use server'

// T-054 — 사장님 셀프 포털 서버 액션.
// listOwnerPlaces: 로그인 사용자가 소유한 업체 목록 (owner_id 또는 owner_email 매칭).
// updateOwnerPlace: 화이트리스트 필드만 부분 업데이트 + 감사 로그.

import { revalidatePath } from 'next/cache'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { requireOwnerForAction } from '@/lib/owner/auth'
import {
  canOwnerEdit,
  normalizeOwnerPatch,
  validateOwnerPatch,
  type OwnerPatch,
} from '@/lib/owner/permissions'
import { recordUpdateDiffs } from '@/lib/actions/audit-places'

export interface OwnerPlaceRow {
  id: string
  slug: string
  name: string
  city: string
  category: string
  status: string
  description: string | null
  phone: string | null
  opening_hours: string[] | null
  tags: string[] | null
  images: unknown
  updated_at: string | null
}

export async function listOwnerPlaces(): Promise<OwnerPlaceRow[]> {
  const user = await requireOwnerForAction()
  const supabase = getAdminClient()
  if (!supabase) return []

  // owner_id = uid OR owner_email = email (email 없는 계정도 있을 수 있음)
  const filters: string[] = [`owner_id.eq.${user.id}`]
  if (user.email) filters.push(`owner_email.eq.${user.email}`)

  const { data, error } = await supabase
    .from('places')
    .select('id, slug, name, city, category, status, description, phone, opening_hours, tags, images, updated_at')
    .or(filters.join(','))
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data as unknown as OwnerPlaceRow[]
}

export interface UpdateOwnerResponse {
  success: boolean
  error?: string
  fieldsChanged?: number
}

export async function updateOwnerPlace(placeId: string, patchInput: Record<string, unknown>): Promise<UpdateOwnerResponse> {
  const user = await requireOwnerForAction()

  const patch: OwnerPatch = normalizeOwnerPatch(patchInput)
  const validation = validateOwnerPatch(patch)
  if (!validation.ok) return { success: false, error: validation.errors.join(' / ') }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 현재 상태 + 소유권 확인
  const { data: row, error: fetchErr } = await supabase
    .from('places')
    .select('id, city, category, slug, owner_id, owner_email, description, phone, opening_hours, tags, images')
    .eq('id', placeId)
    .single()
  if (fetchErr || !row) return { success: false, error: '업체를 찾을 수 없습니다.' }

  const typed = row as unknown as {
    city: string; category: string; slug: string;
    owner_id: string | null; owner_email: string | null;
    description: string | null; phone: string | null;
    opening_hours: string[] | null; tags: string[] | null; images: unknown;
  }

  if (!canOwnerEdit(typed, { userId: user.id, email: user.email })) {
    return { success: false, error: '본인 소유 업체만 수정할 수 있습니다.' }
  }

  const { error: updateErr } = await supabase
    .from('places')
    .update(patch as Record<string, unknown>)
    .eq('id', placeId)
  if (updateErr) {
    console.error('[owner-places] 업데이트 실패:', updateErr)
    return { success: false, error: '수정에 실패했습니다.' }
  }

  // 감사 로그 (actor = owner user id)
  const beforeSnap: Record<string, unknown> = {
    description: typed.description,
    phone: typed.phone,
    opening_hours: typed.opening_hours,
    tags: typed.tags,
    images: typed.images,
  }
  const afterSnap: Record<string, unknown> = { ...beforeSnap, ...patch }
  const { recorded } = await recordUpdateDiffs(
    placeId,
    user.id,
    beforeSnap,
    afterSnap,
    'owner self-service',
  )

  revalidatePath('/owner')
  revalidatePath(`/${typed.city}/${typed.category}`)
  revalidatePath(`/${typed.city}/${typed.category}/${typed.slug}`)

  return { success: true, fieldsChanged: recorded }
}
