'use server'

// T-229 — 오너 쿠폰 등록 액션.
//
// 검증 단계:
//   1. 코드 정규화 (대소문자 → 대문자, trim, whitespace 금지)
//   2. coupons 테이블에서 code lookup
//   3. validateCouponForUse — 만료/잔여횟수 확인
//   4. 이미 redeem 한 기록 있으면 reject (UNIQUE constraint 사전 방어)
//   5. 스태킹 금지 — 미적용 redemption 이 이미 있으면 reject
//   6. INSERT coupon_redemptions — UNIQUE 위반 시 race 로 간주하고 재검증

import { requireOwnerForAction } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { revalidatePath } from 'next/cache'
import { validateCouponForUse, type CouponDef, type DiscountType } from '@/lib/billing/coupon'

export type RedeemCouponResult =
  | { success: true; couponCode: string; discountType: DiscountType; discountValue: number }
  | { success: false; error: string }

export async function redeemCouponAction(rawCode: string): Promise<RedeemCouponResult> {
  const user = await requireOwnerForAction()
  const code = (rawCode ?? '').trim().toUpperCase()
  if (!code) return { success: false, error: '쿠폰 코드를 입력해 주세요.' }
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { success: false, error: '쿠폰 코드 형식이 올바르지 않습니다.' }
  }

  const admin = getAdminClient()
  if (!admin) return { success: false, error: 'admin_unavailable' }

  // 1) customer 확인
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  const c = customer as { id: string } | null
  if (!c) return { success: false, error: '고객 정보가 없습니다. 카드 등록을 먼저 완료해 주세요.' }

  // 2) 쿠폰 조회
  const { data: couponRow } = await admin
    .from('coupons')
    .select('id, code, discount_type, discount_value, valid_from, valid_until, max_uses, uses_count')
    .eq('code', code)
    .maybeSingle()
  const coupon = couponRow as {
    id: string; code: string; discount_type: DiscountType; discount_value: number
    valid_from: string; valid_until: string | null
    max_uses: number | null; uses_count: number
  } | null
  if (!coupon) return { success: false, error: '존재하지 않는 쿠폰 코드입니다.' }

  const def: CouponDef = {
    id: coupon.id,
    code: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    validFrom: coupon.valid_from,
    validUntil: coupon.valid_until,
    maxUses: coupon.max_uses,
    usesCount: coupon.uses_count,
  }
  const validationErr = validateCouponForUse(def)
  if (validationErr) return { success: false, error: validationErr }

  // 3) 이미 같은 쿠폰을 redeem 한 적 있으면 reject
  const { data: existing } = await admin
    .from('coupon_redemptions')
    .select('id, applied_payment_id')
    .eq('coupon_id', coupon.id)
    .eq('customer_id', c.id)
    .maybeSingle()
  const ex = existing as { id: string; applied_payment_id: string | null } | null
  if (ex) {
    return {
      success: false,
      error: ex.applied_payment_id
        ? '이미 사용한 쿠폰입니다.'
        : '이미 등록된 쿠폰입니다. 다음 결제 시 자동 적용됩니다.',
    }
  }

  // 4) 스태킹 금지 — 미적용 redemption 이 이미 있으면 reject (다른 쿠폰이어도)
  const { data: pending } = await admin
    .from('coupon_redemptions')
    .select('id')
    .eq('customer_id', c.id)
    .is('applied_payment_id', null)
    .maybeSingle()
  if (pending) {
    return { success: false, error: '이미 미적용 쿠폰이 있습니다. 다음 결제 후 새 쿠폰을 등록할 수 있습니다.' }
  }

  // 5) INSERT — UNIQUE 위반은 동시 요청 race 신호. 중복 에러 메시지 fallback.
  const { error: insErr } = await admin
    .from('coupon_redemptions')
    .insert({ coupon_id: coupon.id, customer_id: c.id })
  if (insErr) {
    if (insErr.code === '23505') {
      return { success: false, error: '이미 등록된 쿠폰입니다.' }
    }
    return { success: false, error: `쿠폰 등록 실패: ${insErr.message}` }
  }

  revalidatePath('/owner/billing')
  return {
    success: true,
    couponCode: coupon.code,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
  }
}
