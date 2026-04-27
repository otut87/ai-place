// AI Place — 표시용 가격 카피 단일 소스.
// 실제 청구 금액 계산은 src/lib/billing/types.ts 의 PLAN_AMOUNT_PER_PLACE +
// calculatePlanAmount() 가 담당. 이 파일은 UI/메타데이터 카피에서 가격 텍스트를
// 직접 박지 않도록 헬퍼만 제공.
//
// 사용 예:
//   import { MONTHLY_PRICE_LABEL, MONTHLY_PRICE_KRW } from '@/lib/pricing'
//   <p>이후 월 {MONTHLY_PRICE_LABEL} 자동 결제.</p>

import { PLAN_AMOUNT_PER_PLACE } from './billing/types'

/** 업체당 월 구독 금액 (KRW). billing/types 단일 상수 재노출. */
export const MONTHLY_PRICE_KRW: number = PLAN_AMOUNT_PER_PLACE

/** "14,900원" — 단위 포함 한국식 표기 */
export const MONTHLY_PRICE_TEXT: string = `${MONTHLY_PRICE_KRW.toLocaleString('ko-KR')}원`

/** "월 14,900원" — 가장 자주 쓰는 풀라벨 */
export const MONTHLY_PRICE_LABEL: string = `월 ${MONTHLY_PRICE_TEXT}`

/** N개 업체 × 단가 — 영수증/요금 브레이크다운에서 사용 */
export function formatMonthlyTotal(activePlaceCount: number): string {
  const total = activePlaceCount * MONTHLY_PRICE_KRW
  return `${total.toLocaleString('ko-KR')}원`
}
