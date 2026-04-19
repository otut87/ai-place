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

  // 매칭 우선순위: owner_id → owner_email → customer_id (회원가입 시 연결된 customers row 기준).
  const results = new Map<string, OwnerPlaceRow>()
  const cols = 'id, slug, name, city, category, status, description, phone, opening_hours, tags, images, updated_at'

  const byOwnerId = await supabase.from('places').select(cols).eq('owner_id', user.id)
  if (byOwnerId.error) console.error('[listOwnerPlaces] owner_id 조회 실패:', byOwnerId.error)
  for (const row of (byOwnerId.data ?? []) as unknown as OwnerPlaceRow[]) results.set(row.id, row)

  if (user.email) {
    const byEmail = await supabase.from('places').select(cols).eq('owner_email', user.email)
    if (byEmail.error) console.error('[listOwnerPlaces] owner_email 조회 실패:', byEmail.error)
    for (const row of (byEmail.data ?? []) as unknown as OwnerPlaceRow[]) results.set(row.id, row)
  }

  // customer_id 경로 — 과거 owner_id/owner_email 이 비어있는 케이스 대비.
  const { data: customer } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
  const cid = (customer as { id: string } | null)?.id
  if (cid) {
    const byCustomer = await supabase.from('places').select(cols).eq('customer_id', cid)
    if (byCustomer.error) console.error('[listOwnerPlaces] customer_id 조회 실패:', byCustomer.error)
    for (const row of (byCustomer.data ?? []) as unknown as OwnerPlaceRow[]) results.set(row.id, row)
  }

  const out = [...results.values()].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
  console.log(`[listOwnerPlaces] user=${user.id} email=${user.email} found=${out.length}`)
  return out
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
