'use server'

import { requireAuth } from '@/lib/auth'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updatePlaceStatus(placeId: string, status: 'active' | 'rejected') {
  await requireAuth()

  const supabase = await createServerClient()
  const { error } = await (supabase.from('places') as ReturnType<typeof supabase.from>)
    .update({ status } as never)
    .eq('id' as never, placeId as never)

  if (error) {
    console.error('[manage-place] Status update failed:', error)
    return { success: false, error: '상태 변경에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  return { success: true }
}

export async function deletePlace(placeId: string) {
  await requireAuth()

  const supabase = await createServerClient()
  const { error } = await (supabase.from('places') as ReturnType<typeof supabase.from>)
    .delete()
    .eq('id' as never, placeId as never)

  if (error) {
    console.error('[manage-place] Delete failed:', error)
    return { success: false, error: '삭제에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  return { success: true }
}
