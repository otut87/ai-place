// T-079 — 자동발행 안전장치.
// 정책: 카테고리별 autopublish_enabled + review_delay_hours 유예.
// 생성 시점부터 review_delay_hours 가 경과하지 않았다면 pending 유지.

export interface CategoryPolicy {
  slug: string
  autopublishEnabled: boolean
  reviewDelayHours: number
}

export function canAutopublish(
  policy: CategoryPolicy,
  generatedAt: Date,
  now: Date = new Date(),
): boolean {
  if (!policy.autopublishEnabled) return false
  const delayMs = policy.reviewDelayHours * 60 * 60 * 1000
  return now.getTime() - generatedAt.getTime() >= delayMs
}

export function hoursUntilPublishable(
  policy: CategoryPolicy,
  generatedAt: Date,
  now: Date = new Date(),
): number {
  if (!policy.autopublishEnabled) return Infinity
  const delayMs = policy.reviewDelayHours * 60 * 60 * 1000
  const remainMs = (generatedAt.getTime() + delayMs) - now.getTime()
  if (remainMs <= 0) return 0
  return Math.ceil(remainMs / (60 * 60 * 1000))
}
