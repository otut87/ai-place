'use server'

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { isInlineField, validateInlineField, type InlineField } from '@/lib/admin/inline-edit'
import { recordUpdateDiffs } from '@/lib/actions/audit-places'

interface Response {
  success: boolean
  error?: string
  value?: string | string[]
}

export async function updatePlaceInlineField(
  placeId: string,
  field: InlineField,
  raw: string,
): Promise<Response> {
  const user = await requireAuthForAction()

  if (!isInlineField(field)) return { success: false, error: '허용되지 않은 필드입니다.' }

  const validated = validateInlineField(field, raw)
  if (!validated.ok) return { success: false, error: validated.error }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  // 감사 로그용 이전 값 조회
  const { data: place } = await supabase.from('places')
    .select(`city, category, slug, ${field}`)
    .eq('id', placeId)
    .single()

  const patch: Record<string, unknown> = { [field]: validated.value }
  const { error } = await supabase.from('places').update(patch).eq('id', placeId)

  if (error) {
    console.error('[inline-edit-place] Update failed:', error)
    return { success: false, error: '수정에 실패했습니다.' }
  }

  revalidatePath('/admin/places')
  if (place) {
    const p = place as { city: string; category: string; slug: string } & Record<string, unknown>
    await recordUpdateDiffs(
      placeId,
      (user as { id?: string } | null)?.id ?? null,
      { [field]: p[field] ?? null },
      { [field]: validated.value },
    )
    revalidatePath(`/${p.city}/${p.category}`)
    revalidatePath(`/${p.city}/${p.category}/${p.slug}`)
  }
  return { success: true, value: validated.value }
}
