// T-072 — 결제 정책 문구 단일 소스.
// 4 곳(결제 화면 / 이용약관 / 영수증 이메일 / FAQ)에서 동일 상수를 import.
// 설계안 §3.11: "카드매출전표가 부가세 적격증빙…" 4곳 일괄 반영.

import { STANDARD_PLAN_AMOUNT } from './types'

export const BILLING_COMPANY = {
  name: 'AI Place',
  representative: '-',                 // 가맹점 가입 후 갱신
  businessNumber: '-',                 // 사업자등록번호
  address: '충청남도 천안시',
  email: 'support@aiplace.kr',
  phone: '070-0000-0000',
} as const

export const BILLING_PRODUCT = {
  name: 'AI Place 월 구독 (Standard)',
  amount: STANDARD_PLAN_AMOUNT,
  amountText: `${STANDARD_PLAN_AMOUNT.toLocaleString('ko-KR')}원`,
  billingCycle: '월 1회 자동결제',
} as const

/**
 * 결제 화면·이용약관·영수증·FAQ 에서 공통 노출.
 * "카드매출전표(영수증)가 부가세 적격증빙" — 설계안 §3.11.
 */
export const BILLING_POLICY_TEXTS = {
  proofOfTax: `${BILLING_COMPANY.name} 월 구독은 신용카드 정기결제로 청구되며, 발송되는 카드매출전표(영수증)가 부가세법상 적격증빙으로 간주됩니다. 별도의 세금계산서는 발행되지 않습니다.`,
  refundRule: '이미 납부된 월 구독료는 환불되지 않으며, 해지 시 당월 만료일까지 서비스가 유지됩니다.',
  retryPolicy: '결제에 실패하면 다음 날·3일 후·7일 후 총 3회 자동 재시도됩니다. 3회 모두 실패하면 구독이 일시 중단됩니다.',
  cardUpdate: '카드 정보를 갱신하려면 "내 업체" 페이지의 결제 수단 관리에서 새 카드로 변경할 수 있습니다.',
  cancelRule: '언제든지 해지할 수 있으며, 해지 후에도 현재 결제 주기가 끝날 때까지는 서비스를 계속 이용하실 수 있습니다.',
} as const

export type BillingPolicyKey = keyof typeof BILLING_POLICY_TEXTS

/** 영수증 이메일 본문에 삽입할 법적 고지 블록 (다중 줄). */
export function buildReceiptFooter(): string {
  return [
    BILLING_POLICY_TEXTS.proofOfTax,
    BILLING_POLICY_TEXTS.refundRule,
    `문의: ${BILLING_COMPANY.email}`,
  ].join('\n\n')
}

/** 결제 결과 화면·대시보드에 쓰는 한 줄 요약. */
export function summarizeBillingCycle(): string {
  return `${BILLING_PRODUCT.billingCycle} · ${BILLING_PRODUCT.amountText}`
}
