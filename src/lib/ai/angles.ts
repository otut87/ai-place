// T-195 — 6 Angle 로테이션 (Phase 3).
// AngleKey 타입은 Phase 2 keyword-generator.ts 에 정의됨 (단일 소스).
// 이 모듈은 writer 프롬프트용 상세 hint + place/postType 기반 pickAngle 로테이션만.

import { ANGLE_KEYS, type AngleKey } from '@/lib/blog/keyword-generator'
import { getAdminClient } from '@/lib/supabase/admin-client'

export { ANGLE_KEYS, type AngleKey }

/** Writer system prompt 에 주입될 앵글별 가이드. */
export const ANGLE_PROMPT: Record<AngleKey, string> = {
  'review-deepdive': [
    '리뷰·평판 중심. 실제 방문자 경험·평점·리뷰 수를 근거로 서술.',
    '좋은 점·아쉬운 점 양쪽을 중립 서술. 비방/과장 금지.',
  ].join(' '),
  'price-transparency': [
    '가격·비용 투명성. 가격대·견적·보험 적용 여부를 정보로 정리.',
    '정확한 금액 단언 금지 — "대략", "상담 필요" 서술.',
  ].join(' '),
  'procedure-guide': [
    '시술/서비스 과정. 절차·준비물·회복 기간·주의사항 단계별.',
    '의료/법률/세무 카테고리는 면책 강화.',
  ].join(' '),
  'first-visit': [
    '첫 방문 가이드. 예약·준비·소요 시간·결제 방법 기초 정보.',
    '지역 초행자 관점.',
  ].join(' '),
  'comparison-context': [
    '비교·대안 맥락. A vs B 대신 "어떤 경우 어떤 곳이 맞을지" 조건부 추천.',
    '업체 간 특징 차이 객관 서술.',
  ].join(' '),
  'seasonal': [
    '계절성/시기성. 현재 시즌 또는 가까운 이벤트에 맞춘 관리 포인트.',
    '연말/연초/여름/겨울 맥락 활용.',
  ].join(' '),
}

export interface PickAngleInput {
  /** post 유형 — detail/compare/guide/keyword. compare 는 comparison-context 가 강제. */
  postType: 'detail' | 'compare' | 'guide' | 'keyword' | 'general'
  /** 같은 업체에 같은 앵글이 최근 N일 내 이미 있으면 제외 (기본 30). */
  placeId?: string | null
  city?: string
  category?: string
  excludeDays?: number
  /** 테스트 override — 특정 앵글 강제. */
  prefer?: AngleKey
}

/**
 * 로테이션 규칙:
 *  1. postType=compare 는 comparison-context 고정.
 *  2. 같은 place_id × angle 조합이 최근 excludeDays 내 있으면 해당 angle 제외.
 *  3. place_id 없으면 city+category 단위로 로테이션.
 *  4. 남은 후보 중 가장 최근에 쓰인 시점이 오래된 angle 선택.
 *  5. 모두 최근 썼다면 random.
 */
export async function pickAngle(input: PickAngleInput): Promise<AngleKey> {
  if (input.prefer) return input.prefer
  if (input.postType === 'compare') return 'comparison-context'

  const admin = getAdminClient()
  if (!admin) return 'review-deepdive'

  const excludeDays = input.excludeDays ?? 30
  const since = new Date(Date.now() - excludeDays * 24 * 60 * 60 * 1000).toISOString()

  let q = admin
    .from('blog_posts')
    .select('angle, created_at')
    .gte('created_at', since)
    .not('angle', 'is', null)

  // place_id 로 related_place_slugs 검색 불가 (text[]) — 간단히 city/category 기준으로 로테이션.
  if (input.city) q = q.eq('city', input.city)
  if (input.category) q = q.eq('category', input.category)

  const { data } = await q
  const rows = (data ?? []) as Array<{ angle: string | null; created_at: string }>

  // angle → 최근 사용 시점 map
  const latestByAngle = new Map<AngleKey, number>()
  for (const r of rows) {
    const a = r.angle as AngleKey | null
    if (!a || !ANGLE_KEYS.includes(a)) continue
    const t = new Date(r.created_at).getTime()
    const prev = latestByAngle.get(a) ?? 0
    if (t > prev) latestByAngle.set(a, t)
  }

  // 한 번도 안 쓴 angle 우선, 그 다음 가장 오래된 사용 시점
  const ranked = [...ANGLE_KEYS].sort((a, b) => {
    const ta = latestByAngle.get(a) ?? 0
    const tb = latestByAngle.get(b) ?? 0
    return ta - tb
  })

  return ranked[0] ?? 'review-deepdive'
}
