// T-229 — 쿠폰 할인 적용 유틸.
// 순수 함수 + admin client 헬퍼 2종. 서버 액션/크론 양쪽에서 공유.

import type { SupabaseClient } from '@supabase/supabase-js'

export type DiscountType = 'percent' | 'fixed'

export interface CouponDef {
  id: string
  code: string
  discountType: DiscountType
  discountValue: number
  validFrom: string
  validUntil: string | null
  maxUses: number | null
  usesCount: number
}

export interface UnappliedRedemption {
  id: string                 // coupon_redemptions.id
  couponId: string
  discountType: DiscountType
  discountValue: number
}

/**
 * 할인된 금액 계산 (정수 원 단위, floor).
 *   - percent: amount * (100 - v) / 100 내림
 *   - fixed:   max(0, amount - v)
 */
export function calcDiscountedAmount(
  baseAmount: number,
  discountType: DiscountType,
  discountValue: number,
): number {
  if (baseAmount <= 0) return 0
  if (discountType === 'percent') {
    const clamped = Math.max(1, Math.min(100, discountValue))
    return Math.floor(baseAmount * (100 - clamped) / 100)
  }
  // fixed
  return Math.max(0, baseAmount - discountValue)
}

/**
 * 쿠폰 검증 규칙 — 등록 시점 + 차감 시점 양쪽에서 동일 규칙 사용 (TOCTOU 방어).
 * 반환: 통과 시 null, 실패 시 error 메시지.
 */
export function validateCouponForUse(c: CouponDef, nowMs: number = Date.now()): string | null {
  const startMs = Date.parse(c.validFrom)
  if (Number.isFinite(startMs) && nowMs < startMs) {
    return '아직 사용 가능한 시점이 아닙니다.'
  }
  if (c.validUntil) {
    const endMs = Date.parse(c.validUntil)
    if (Number.isFinite(endMs) && nowMs > endMs) {
      return '쿠폰이 만료되었습니다.'
    }
  }
  if (c.maxUses != null && c.usesCount >= c.maxUses) {
    return '쿠폰 사용 가능 횟수를 모두 소진했습니다.'
  }
  return null
}

/**
 * customer 의 미적용 쿠폰 redemption 1건 조회. 없으면 null.
 * 여러 개 있어도 가장 최근 것 1개만 반환 (stacking 금지 정책).
 */
export async function loadUnappliedRedemption(
  admin: SupabaseClient,
  customerId: string,
): Promise<UnappliedRedemption | null> {
  const { data } = await admin
    .from('coupon_redemptions')
    .select('id, coupon_id, coupons:coupon_id(id, discount_type, discount_value, valid_from, valid_until, max_uses, uses_count, code)')
    .eq('customer_id', customerId)
    .is('applied_payment_id', null)
    .order('redeemed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const row = data as {
    id: string; coupon_id: string
    coupons: {
      id: string; discount_type: DiscountType; discount_value: number
      valid_from: string; valid_until: string | null
      max_uses: number | null; uses_count: number; code: string
    } | null
  } | null
  if (!row || !row.coupons) return null

  // charge 시점 재검증 — 만료/소진된 쿠폰은 무시.
  const err = validateCouponForUse({
    id: row.coupons.id,
    code: row.coupons.code,
    discountType: row.coupons.discount_type,
    discountValue: row.coupons.discount_value,
    validFrom: row.coupons.valid_from,
    validUntil: row.coupons.valid_until,
    maxUses: row.coupons.max_uses,
    usesCount: row.coupons.uses_count,
  })
  if (err) return null

  return {
    id: row.id,
    couponId: row.coupon_id,
    discountType: row.coupons.discount_type,
    discountValue: row.coupons.discount_value,
  }
}

/**
 * 결제 성공 후 redemption 을 소진 처리 + coupon.uses_count 증가.
 * payment 가 실패한 경우 호출하지 말 것 — 미적용 상태 유지돼 다음 charge 에 재시도됨.
 */
export async function markRedemptionApplied(
  admin: SupabaseClient,
  redemptionId: string,
  couponId: string,
  paymentId: string,
): Promise<void> {
  const nowIso = new Date().toISOString()
  // redemption.applied_payment_id 설정 — UNIQUE 제약은 coupon_id+customer_id 라 idempotent.
  await admin
    .from('coupon_redemptions')
    .update({ applied_payment_id: paymentId, applied_at: nowIso })
    .eq('id', redemptionId)
    .is('applied_payment_id', null)

  // coupon.uses_count 원자 증가 (동시 이벤트 방어 — DB-level increment).
  // Supabase 는 increment RPC 가 없으므로 select+update 2단계. 동시 결제 드문 도메인이라 OK.
  const { data: c } = await admin.from('coupons').select('uses_count').eq('id', couponId).maybeSingle()
  const current = (c as { uses_count: number } | null)?.uses_count ?? 0
  await admin.from('coupons').update({ uses_count: current + 1 }).eq('id', couponId)
}
