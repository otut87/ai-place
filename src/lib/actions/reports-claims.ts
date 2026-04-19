'use server'

// 신고 접수 + 소유권 이관 문의 서버 액션.
// Rate limit: 동일 IP/user 15분 5건, 24시간 20건 초과 시 거부.

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getUser } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'

export type ReportReason = 'closed' | 'wrong_info' | 'spam' | 'duplicate' | 'inappropriate' | 'other'

export interface SubmitReportInput {
  placeId: string
  reason: ReportReason
  detail?: string
  reporterEmail?: string
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

async function clientIp(): Promise<string> {
  const hh = await headers()
  return (
    hh.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? hh.get('x-real-ip')
    ?? 'unknown'
  )
}

async function checkRateLimit(
  admin: ReturnType<typeof getAdminClient>,
  table: 'place_reports' | 'ownership_claims',
  key: string,
  keyCol: 'reporter_ip' | 'claimant_user_id',
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!admin) return { ok: true }
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [r15, r24] = await Promise.all([
    admin.from(table).select('id', { count: 'exact', head: true }).eq(keyCol, key).gte('created_at', since15),
    admin.from(table).select('id', { count: 'exact', head: true }).eq(keyCol, key).gte('created_at', since24),
  ])
  if ((r15.count ?? 0) >= 5) return { ok: false, error: '15분 내 5건 초과 — 잠시 후 다시 시도해 주세요.' }
  if ((r24.count ?? 0) >= 20) return { ok: false, error: '24시간 내 20건 초과 — 내일 다시 시도해 주세요.' }
  return { ok: true }
}

// ============================================================
// 신고 접수 — 로그인 안해도 제출 가능
// ============================================================
export async function submitReport(input: SubmitReportInput): Promise<ActionResult<{ id: string }>> {
  if (!input.placeId?.trim()) return { success: false, error: '대상 업체 ID 누락' }
  const validReasons: ReportReason[] = ['closed', 'wrong_info', 'spam', 'duplicate', 'inappropriate', 'other']
  if (!validReasons.includes(input.reason)) return { success: false, error: '잘못된 신고 사유' }
  if (input.detail && input.detail.length > 1000) return { success: false, error: '상세 설명은 1000자 이내' }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 업체 존재 확인
  const { data: place } = await admin
    .from('places')
    .select('id, city, category, slug')
    .eq('id', input.placeId)
    .maybeSingle()
  if (!place) return { success: false, error: '존재하지 않는 업체입니다.' }

  const user = await getUser()
  const ip = await clientIp()
  const limitKey = user?.id ?? ip

  const rate = await checkRateLimit(admin, 'place_reports', limitKey, 'reporter_ip')
  if (!rate.ok) return { success: false, error: rate.error }

  const { data: inserted, error } = await admin
    .from('place_reports')
    .insert({
      place_id: input.placeId,
      reporter_user_id: user?.id ?? null,
      reporter_email: input.reporterEmail?.trim() || user?.email || null,
      reporter_ip: ip,
      reason: input.reason,
      detail: input.detail?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !inserted) {
    console.error('[submitReport] insert failed:', error)
    return { success: false, error: '신고 접수 실패' }
  }

  // admin 목록 갱신
  revalidatePath('/admin/reports')

  return { success: true, data: { id: (inserted as { id: string }).id } }
}

// ============================================================
// 소유권 이관 문의 — 로그인 필수
// ============================================================
export interface SubmitClaimInput {
  placeId: string
  reason?: string
  evidenceUrl?: string
  contactPhone?: string
}

export async function submitClaim(input: SubmitClaimInput): Promise<ActionResult<{ id: string }>> {
  const user = await getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }
  if (!input.placeId?.trim()) return { success: false, error: '대상 업체 ID 누락' }
  if (input.reason && input.reason.length > 2000) return { success: false, error: '사유는 2000자 이내' }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 업체 존재 + 현재 owner 조회
  const { data: place } = await admin
    .from('places')
    .select('id, name, owner_email')
    .eq('id', input.placeId)
    .maybeSingle()
  if (!place) return { success: false, error: '존재하지 않는 업체입니다.' }
  const placeRow = place as { id: string; name: string; owner_email: string | null }

  // 본인이 이미 owner 면 차단
  if (placeRow.owner_email && user.email && placeRow.owner_email === user.email) {
    return { success: false, error: '이미 이 업체의 등록자입니다.' }
  }

  const rate = await checkRateLimit(admin, 'ownership_claims', user.id, 'claimant_user_id')
  if (!rate.ok) return { success: false, error: rate.error }

  // 중복 pending 클레임 방지 (DB unique index 이중 방어)
  const { data: existing } = await admin
    .from('ownership_claims')
    .select('id')
    .eq('place_id', input.placeId)
    .eq('claimant_user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) {
    return { success: false, error: '이미 이 업체에 대해 접수된 문의가 있습니다 — 관리자 검토 중입니다.' }
  }

  const { data: inserted, error } = await admin
    .from('ownership_claims')
    .insert({
      place_id: input.placeId,
      claimant_user_id: user.id,
      claimant_email: user.email ?? null,
      current_owner_email: placeRow.owner_email,
      reason: input.reason?.trim() || null,
      evidence_url: input.evidenceUrl?.trim() || null,
      contact_phone: input.contactPhone?.trim() || null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error || !inserted) {
    console.error('[submitClaim] insert failed:', error)
    return { success: false, error: '문의 접수 실패' }
  }

  revalidatePath('/admin/claims')

  return { success: true, data: { id: (inserted as { id: string }).id } }
}

// ============================================================
// Admin — 상태 업데이트
// ============================================================
import { requireAuthForAction } from '@/lib/auth'

export async function updateReportStatus(
  reportId: string,
  status: 'reviewed' | 'resolved' | 'dismissed',
  note?: string,
): Promise<ActionResult> {
  const user = await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const { error } = await admin
    .from('place_reports')
    .update({
      status,
      admin_note: note?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq('id', reportId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/reports')
  return { success: true, data: undefined }
}

export async function resolveClaim(
  claimId: string,
  decision: 'approved' | 'rejected',
  note?: string,
): Promise<ActionResult> {
  const user = await requireAuthForAction()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 승인 시: place 의 owner_id / owner_email / customer_id 를 claimant 로 재할당
  if (decision === 'approved') {
    const { data: claim } = await admin
      .from('ownership_claims')
      .select('place_id, claimant_user_id, claimant_email')
      .eq('id', claimId)
      .maybeSingle()
    const claimRow = claim as { place_id: string; claimant_user_id: string; claimant_email: string | null } | null
    if (!claimRow) return { success: false, error: '클레임을 찾을 수 없습니다.' }

    // claimant 의 customer_id 조회 (없으면 null)
    const { data: customer } = await admin
      .from('customers')
      .select('id')
      .eq('user_id', claimRow.claimant_user_id)
      .maybeSingle()
    const customerId = (customer as { id: string } | null)?.id ?? null

    const { error: updErr } = await admin
      .from('places')
      .update({
        owner_id: claimRow.claimant_user_id,
        owner_email: claimRow.claimant_email,
        customer_id: customerId,
      })
      .eq('id', claimRow.place_id)
    if (updErr) return { success: false, error: `owner 재할당 실패: ${updErr.message}` }
  }

  const { error } = await admin
    .from('ownership_claims')
    .update({
      status: decision,
      admin_note: note?.trim() || null,
      resolution_note: note?.trim() || null,
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
    })
    .eq('id', claimId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/claims')
  return { success: true, data: undefined }
}
