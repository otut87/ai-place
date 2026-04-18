// T-062 — 검수 큐 순수 로직.
// 반려 사유 enum + 쿼리 파라미터 파서.

export const REJECT_REASONS = ['fact_error', 'tone', 'seo', 'duplicate', 'other'] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

const REJECT_REASON_SET: ReadonlySet<string> = new Set(REJECT_REASONS)

export function isRejectReason(value: unknown): value is RejectReason {
  return typeof value === 'string' && REJECT_REASON_SET.has(value)
}

export function rejectReasonLabel(reason: RejectReason): string {
  switch (reason) {
    case 'fact_error': return '사실 오류'
    case 'tone': return '톤매너 부적합'
    case 'seo': return 'SEO 부적합'
    case 'duplicate': return '중복'
    case 'other': return '기타'
  }
}

/**
 * 검수 큐 URL 쿼리 파서 — 현재 pending 업체 ID 위치 지정 등에 사용.
 * ?place=<id> 로 특정 업체를 선택한 상태로 진입.
 */
export function parseReviewParams(raw: Record<string, string | string[] | undefined>): { placeId?: string } {
  const p = raw.place
  const id = Array.isArray(p) ? p[0] : p
  if (!id) return {}
  // placeId 는 uuid 또는 short-id 허용. 경로 이탈 방지.
  if (/[\\/..]/.test(id)) return {}
  return { placeId: id }
}
