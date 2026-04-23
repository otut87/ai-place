'use server'

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

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
  await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 업체 정보 먼저 조회 (revalidate 경로 생성용 + customer_id for subscription sync)
  const { data: place } = await supabase.from('places')
    .select('city, category, slug, customer_id')
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .update({ status })
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Status update failed:', error)
    return { success: false, error: '상태 변경에 실패했습니다.' }
  }

  // T-210: status 전환이 활성 업체 수를 바꾸므로 subscription amount 동기화.
  const p = place as { city: string; category: string; slug: string; customer_id: string | null } | null
  if (p?.customer_id) {
    try {
      const { syncSubscriptionAmount } = await import('@/lib/billing/sync-subscription-amount')
      await syncSubscriptionAmount(p.customer_id)
    } catch (e) {
      console.error('[manage-place] subscription amount sync 실패:', e)
    }
  }

  revalidatePath('/admin/places')
  // 공개 페이지도 갱신
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
  await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 수정 전 업체 정보 조회 (revalidate용)
  const { data: place } = await supabase.from('places')
    .select('city, category, slug')
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .update(data)
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Update failed:', error)
    return { success: false, error: '수정에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  if (place) {
    const p = place as { city: string; category: string; slug: string }
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath(`/${p.city}/${p.category}/${p.slug}`)
  }
  return { success: true }
}

export async function deletePlace(placeId: string) {
  await requireAuthForAction()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 삭제 전 업체 정보 조회 (revalidate용)
  const { data: place } = await supabase.from('places')
    .select('city, category, slug')
    .eq('id', placeId)
    .single()

  const { error } = await supabase.from('places')
    .delete()
    .eq('id', placeId)

  if (error) {
    console.error('[manage-place] Delete failed:', error)
    return { success: false, error: '삭제에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  if (place) {
    const p = place as { city: string; category: string; slug: string }
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath('/')
  }
  return { success: true }
}
