'use server'

import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export async function getPlaceById(placeId: string) {
  await requireAuth()

  const supabase = getAdminClient()
  if (!supabase) return null

  const { data } = await supabase.from('places')
    .select('*')
    .eq('id' as never, placeId as never)
    .single()

  return data
}

export async function updatePlaceStatus(placeId: string, status: 'active' | 'rejected') {
  await requireAuth()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const { error } = await supabase.from('places')
    .update({ status } as never)
    .eq('id' as never, placeId as never)

  if (error) {
    console.error('[manage-place] Status update failed:', error)
    return { success: false, error: '상태 변경에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  return { success: true }
}

export async function updatePlace(placeId: string, data: {
  name?: string; description?: string; phone?: string; opening_hours?: string[];
  services?: unknown[]; faqs?: unknown[]; tags?: string[];
  naver_place_url?: string; kakao_map_url?: string;
}) {
  await requireAuth()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const { error } = await supabase.from('places')
    .update(data as never)
    .eq('id' as never, placeId as never)

  if (error) {
    console.error('[manage-place] Update failed:', error)
    return { success: false, error: '수정에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  return { success: true }
}

export async function deletePlace(placeId: string) {
  await requireAuth()

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const { error } = await supabase.from('places')
    .delete()
    .eq('id' as never, placeId as never)

  if (error) {
    console.error('[manage-place] Delete failed:', error)
    return { success: false, error: '삭제에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  return { success: true }
}
