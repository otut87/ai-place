// T-071 — 어댑터 팩토리. 환경변수에 따라 toss / mock 선택.
//
// 우선순위:
//   1) BILLING_ADAPTER=mock  → 완전 오프라인 mock
//   2) TOSS_SECRET_KEY 존재  → 실 토스 (실 가맹점)
//   3) 그 외                 → 토스 공개 테스트키 (승인 없이 성공 응답)

import { mockAdapter } from './mock'
import { tossAdapter } from './toss'
import type { PgAdapter } from './adapter'

export function getPgAdapter(): PgAdapter {
  if (process.env.BILLING_ADAPTER === 'mock') return mockAdapter
  return tossAdapter
}

export * from './adapter'
export * from './types'
export * from './policy'
export { tossAdapter, isUsingTossTestKey, getTossClientKey, getTossSecretKey } from './toss'
export { mockAdapter } from './mock'
