'use server'

// T-062 — 검수 큐 개별 승인/반려 액션.
// 기존 bulk-places 의 status 업데이트 + audit 로깅 + notify 재사용.

import { requireAuthForAction } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/actions/audit-places'
import { dispatchNotify } from '@/lib/actions/notify'
import { isRejectReason, type RejectReason } from '@/lib/admin/review-queue'

export interface ReviewResult {
  success: boolean
  error?: string
}

function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://aiplace.kr'
}

async function loadPlaceMeta(supabase: NonNullable<ReturnType<typeof getAdminClient>>, placeId: string) {
  const { data } = await supabase
    .from('places')
    .select('city, category, slug, name, owner_email, status')
    .eq('id', placeId)
    .single()
  return data as { city: string; category: string; slug: string; name: string; owner_email: string | null; status: string } | null
}

function revalidate(row: { city: string; category: string; slug: string }) {
  revalidatePath('/admin/places')
  revalidatePath('/admin/review')
  revalidatePath(`/${row.city}/${row.category}`)
  revalidatePath(`/${row.city}/${row.category}/${row.slug}`)
}

export async function approvePlace(placeId: string): Promise<ReviewResult> {
  const user = await requireAuthForAction()
  if (!placeId) return { success: false, error: 'placeId 누락' }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const row = await loadPlaceMeta(supabase, placeId)
  if (!row) return { success: false, error: '업체를 찾을 수 없습니다.' }

  const { error } = await supabase.from('places').update({ status: 'active' }).eq('id', placeId)
  if (error) {
    console.error('[review] approve 실패:', error)
    return { success: false, error: '승인 처리 실패' }
  }

  const actorId = (user as { id?: string } | null)?.id ?? null
  await recordAudit({
    placeId, actorId, action: 'status',
    field: 'status', before: row.status, after: 'active',
  })

  await dispatchNotify({
    type: 'place.approved',
    placeName: row.name,
    placeUrl: `${siteUrl()}/${row.city}/${row.category}/${row.slug}`,
    ownerEmail: row.owner_email ?? undefined,
  })

  revalidate(row)
  return { success: true }
}

export interface RejectInput {
  placeId: string
  reason: RejectReason
  note?: string
}

export async function rejectPlace({ placeId, reason, note }: RejectInput): Promise<ReviewResult> {
  const user = await requireAuthForAction()
  if (!placeId) return { success: false, error: 'placeId 누락' }
  if (!isRejectReason(reason)) return { success: false, error: '허용되지 않은 반려 사유' }

  const supabase = getAdminClient()
  if (!supabase) return { success: false, error: 'Admin 클라이언트 초기화 실패' }

  const row = await loadPlaceMeta(supabase, placeId)
  if (!row) return { success: false, error: '업체를 찾을 수 없습니다.' }

  const { error } = await supabase.from('places').update({ status: 'rejected' }).eq('id', placeId)
  if (error) {
    console.error('[review] reject 실패:', error)
    return { success: false, error: '반려 처리 실패' }
  }

  const actorId = (user as { id?: string } | null)?.id ?? null
  await recordAudit({
    placeId, actorId, action: 'status',
    field: 'status', before: row.status, after: 'rejected',
    reason: note ? `${reason}: ${note}` : reason,
  })

  await dispatchNotify({
    type: 'place.rejected',
    placeName: row.name,
    placeUrl: `${siteUrl()}/${row.city}/${row.category}/${row.slug}`,
    ownerEmail: row.owner_email ?? undefined,
    reason: note ? `${reason}: ${note}` : reason,
  })

  revalidate(row)
  return { success: true }
}
