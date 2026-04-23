'use server'

// T-229 — 어드민 쿠폰 관리 액션.
//   createCouponAction: 신규 쿠폰 발급
//   deactivateCouponAction: valid_until 을 과거로 당겨 즉시 만료

import { requireAuth } from '@/lib/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'

export interface CreateCouponInput {
  code: string                        // 대문자 영숫자
  discountType: 'percent' | 'fixed'
  discountValue: number               // percent: 1-100, fixed: 원 단위
  validUntil?: string | null          // ISO, null=무제한
  maxUses?: number | null             // null=무제한
  note?: string                       // 관리자 메모 (캠페인명 등)
}

export type CreateCouponResult =
  | { success: true; couponId: string }
  | { success: false; error: string }

export async function createCouponAction(input: CreateCouponInput): Promise<CreateCouponResult> {
  const user = await requireAuth()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  const code = input.code.trim().toUpperCase()
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { success: false, error: '코드 형식 오류 (영대문자·숫자·-·_ 3~32자)' }
  }
  if (!['percent', 'fixed'].includes(input.discountType)) {
    return { success: false, error: 'discountType 이 올바르지 않습니다.' }
  }
  if (input.discountType === 'percent' && (input.discountValue < 1 || input.discountValue > 100)) {
    return { success: false, error: 'percent 할인은 1~100 범위여야 합니다.' }
  }
  if (input.discountType === 'fixed' && input.discountValue < 1) {
    return { success: false, error: 'fixed 할인은 1원 이상이어야 합니다.' }
  }
  if (input.maxUses != null && input.maxUses < 1) {
    return { success: false, error: 'maxUses 는 1 이상이어야 합니다.' }
  }

  const { data, error } = await admin
    .from('coupons')
    .insert({
      code,
      discount_type: input.discountType,
      discount_value: input.discountValue,
      valid_until: input.validUntil ?? null,
      max_uses: input.maxUses ?? null,
      note: input.note?.trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error || !data) {
    if (error?.code === '23505') {
      return { success: false, error: '같은 코드의 쿠폰이 이미 존재합니다.' }
    }
    return { success: false, error: `쿠폰 생성 실패: ${error?.message ?? 'unknown'}` }
  }

  revalidatePath('/admin/coupons')
  return { success: true, couponId: (data as { id: string }).id }
}

export async function deactivateCouponAction(couponId: string): Promise<{ success: boolean; error?: string }> {
  await requireAuth()
  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // valid_until 을 과거 시각으로 당겨 즉시 만료 — 이미 redeem 한 건은 charge 시점에 거부됨.
  const { error } = await admin
    .from('coupons')
    .update({ valid_until: new Date(Date.now() - 1000).toISOString() })
    .eq('id', couponId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/coupons')
  return { success: true }
}
