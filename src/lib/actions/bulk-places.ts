'use server'

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { parseBulkAction, type BulkAction } from '@/lib/admin/places-bulk'

interface BulkResponse {
  success: boolean
  processed?: number
  error?: string
}

async function loadAffectedPaths(ids: string[]): Promise<Array<{ city: string; category: string; slug: string }>> {
  const supabase = getAdminClient()
  if (!supabase) return []
  const { data } = await supabase.from('places').select('city, category, slug').in('id', ids)
  return (data ?? []) as Array<{ city: string; category: string; slug: string }>
}

function revalidateAffected(rows: Array<{ city: string; category: string; slug: string }>) {
  revalidatePath('/admin/places')
  revalidatePath('/')
  const seen = new Set<string>()
  for (const r of rows) {
    const cat = `/${r.city}/${r.category}`
    if (!seen.has(cat)) {
      revalidatePath(cat)
      seen.add(cat)
    }
    revalidatePath(`/${r.city}/${r.category}/${r.slug}`)
  }
}

export async function bulkUpdateStatus(ids: string[], action: BulkAction): Promise<BulkResponse> {
  await requireAuthForAction()
  if (ids.length === 0) return { success: false, error: '선택된 업체가 없습니다.' }

  const parsed = parseBulkAction(action)
  if (!parsed || parsed === 'delete') {
    return { success: false, error: '잘못된 액션입니다.' }
  }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const nextStatus = parsed === 'activate' ? 'active' : 'rejected'
  const affected = await loadAffectedPaths(ids)

  const { error, count } = await supabase
    .from('places')
    .update({ status: nextStatus }, { count: 'exact' })
    .in('id', ids)

  if (error) {
    console.error('[bulk-places] Status update failed:', error)
    return { success: false, error: '일괄 상태 변경에 실패했습니다.' }
  }

  revalidateAffected(affected)
  return { success: true, processed: count ?? ids.length }
}

export async function bulkDeletePlaces(ids: string[]): Promise<BulkResponse> {
  await requireAuthForAction()
  if (ids.length === 0) return { success: false, error: '선택된 업체가 없습니다.' }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const affected = await loadAffectedPaths(ids)

  const { error, count } = await supabase
    .from('places')
    .delete({ count: 'exact' })
    .in('id', ids)

  if (error) {
    console.error('[bulk-places] Delete failed:', error)
    return { success: false, error: '일괄 삭제에 실패했습니다.' }
  }

  revalidateAffected(affected)
  return { success: true, processed: count ?? ids.length }
}
