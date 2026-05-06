'use server'

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { recordAudit, recordUpdateDiffs } from '@/lib/actions/audit-places'
import { AUDITABLE_FIELDS } from '@/lib/admin/audit'

export async function getPlaceById(placeId: string) {
  await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return null

  const { data, error } = await supabase.from('places')
    .select('*')
    .eq('id', placeId)
    .single()

  if (error) {
    console.error('[manage-place] getPlaceById failed:', error)
    return null
  }
  return data
}

export async function updatePlaceStatus(placeId: string, status: 'active' | 'rejected') {
  const user = await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 업체 정보 먼저 조회 (revalidate 경로 + subscription sync + audit before-value)
  const { data: place } = await supabase.from('places')
    .select('city, category, slug, customer_id, status')
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .update({ status })
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Status update failed:', error)
    return { success: false, error: '상태 변경에 실패했습니다.' }
  }

  const p = place as { city: string; category: string; slug: string; customer_id: string | null; status: string } | null
  const actorId = (user as { id?: string } | null)?.id ?? null

  // T-263: status 변경 감사 로그.
  if (p && p.status !== status) {
    await recordAudit({
      placeId, actorId, action: 'status',
      field: 'status', before: p.status, after: status,
    })
  }

  // T-210: status 전환이 활성 업체 수를 바꾸므로 subscription amount 동기화.
  if (p?.customer_id) {
    try {
      const { syncSubscriptionAmount } = await import('@/lib/billing/sync-subscription-amount')
      await syncSubscriptionAmount(p.customer_id)
    } catch (e) {
      console.error('[manage-place] subscription amount sync 실패:', e)
    }
  }

  revalidatePath('/admin/places')
  if (p) {
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath(`/${p.city}/${p.category}/${p.slug}`)
    revalidatePath('/')
  }
  return { success: true }
}

export async function updatePlace(placeId: string, data: {
  name?: string; description?: string; phone?: string; opening_hours?: string[];
  services?: unknown[]; faqs?: unknown[]; tags?: string[];
  naver_place_url?: string; kakao_map_url?: string;
  // Phase 11 — 외부 채널 링크만 수동 입력 허용. 리뷰수·평점 필드는 여기서 받지 않음(크롤러 전용).
  homepage_url?: string; blog_url?: string; instagram_url?: string;
}) {
  const user = await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 수정 전 업체 정보 조회 — revalidate + audit diff 양쪽에 사용.
  // audit 대상 필드 전체를 가져와야 diff 비교 가능.
  const auditCols = AUDITABLE_FIELDS.join(', ')
  const { data: place } = await supabase.from('places')
    .select(`city, category, slug, ${auditCols}`)
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .update(data)
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Update failed:', error)
    return { success: false, error: '수정에 실패했습니다.' }
  }

  const actorId = (user as { id?: string } | null)?.id ?? null

  if (place) {
    const p = place as unknown as { city: string; category: string; slug: string } & Record<string, unknown>

    // T-263: 변경 필드 diff 감사 로그. data 에 들어온 키만 비교.
    const beforeSubset: Record<string, unknown> = {}
    const afterSubset: Record<string, unknown> = {}
    for (const key of Object.keys(data)) {
      beforeSubset[key] = p[key] ?? null
      afterSubset[key] = (data as Record<string, unknown>)[key] ?? null
    }
    await recordUpdateDiffs(placeId, actorId, beforeSubset, afterSubset)

    revalidatePath('/admin/places')
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath(`/${p.city}/${p.category}/${p.slug}`)
  } else {
    revalidatePath('/admin/places')
  }
  return { success: true }
}

export async function deletePlace(placeId: string) {
  const user = await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 삭제 전 업체 정보 조회 — revalidate + audit before-snapshot 양쪽에 사용.
  // place_audit_log.place_id 는 ON DELETE SET NULL 이라 삭제 후엔 분쟁 추적 불가 → snapshot 보존 중요.
  const { data: place } = await supabase.from('places')
    .select('*')
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .delete()
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Delete failed:', error)
    return { success: false, error: '삭제에 실패했습니다.' }
  }

  const actorId = (user as { id?: string } | null)?.id ?? null

  // T-263: 삭제 감사 로그 — 전체 row 를 before snapshot 으로 보존.
  if (place) {
    await recordAudit({
      placeId, actorId, action: 'delete',
      before: place, after: null,
    })

    const p = place as { city: string; category: string; slug: string }
    revalidatePath('/admin/places')
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath('/')
  } else {
    revalidatePath('/admin/places')
  }
  return { success: true }
}
