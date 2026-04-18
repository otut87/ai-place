// T-055 — 업체 변경 감사 로그.
// 순수 diff·판별 로직. 실제 DB insert 는 actions/audit-places.ts 가 담당.

export const AUDIT_ACTIONS = ['create', 'update', 'status', 'delete', 'restore'] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDITABLE_FIELDS = [
  'name',
  'name_en',
  'slug',
  'city',
  'category',
  'description',
  'address',
  'phone',
  'opening_hours',
  'status',
  'tags',
  'services',
  'faqs',
  'images',
  'rating',
  'review_count',
  'recommended_for',
  'strengths',
  'place_type',
  'recommendation_note',
  'naver_place_url',
  'kakao_map_url',
  'google_business_url',
] as const
export type AuditableField = (typeof AUDITABLE_FIELDS)[number]

const AUDITABLE_SET: ReadonlySet<string> = new Set(AUDITABLE_FIELDS)

export function isAuditableField(value: unknown): value is AuditableField {
  return typeof value === 'string' && AUDITABLE_SET.has(value)
}

export interface FieldDiff {
  field: AuditableField
  before: unknown
  after: unknown
}

function jsonEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a == null || b == null) return a === b
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * 두 상태 오브젝트를 비교해 변경된 화이트리스트 필드 목록을 반환.
 * 누락된 필드는 무시 (PATCH 의미).
 */
export function diffUpdate(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff[] {
  const out: FieldDiff[] = []
  for (const key of Object.keys(after)) {
    if (!isAuditableField(key)) continue
    const b = before[key]
    const a = after[key]
    if (!jsonEquals(b, a)) {
      out.push({ field: key, before: b ?? null, after: a ?? null })
    }
  }
  return out
}

/**
 * 감사 로그 엔트리를 한국어 한 줄로 요약. 어드민 UI 타임라인에서 사용.
 */
export function summarizeAction(
  action: AuditAction,
  ctx: { field?: string; before?: unknown; after?: unknown } = {},
): string {
  switch (action) {
    case 'create':
      return '업체 등록'
    case 'delete':
      return '업체 삭제'
    case 'restore':
      return '삭제 복구'
    case 'status':
      return `상태 변경: ${String(ctx.before ?? '?')} → ${String(ctx.after ?? '?')}`
    case 'update':
      return ctx.field ? `필드 수정: ${ctx.field}` : '필드 수정'
    default:
      return String(action)
  }
}

// T-068: 변경 주체 종류. 'human' = 사람 어드민, 'pipeline' = 자동화 파이프라인,
// 'system' = 크론·웹훅 등. 기본값은 'human' (마이그레이션 default).
export const ACTOR_TYPES = ['human', 'pipeline', 'system'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

const ACTOR_TYPE_SET: ReadonlySet<string> = new Set(ACTOR_TYPES)

export function isActorType(value: unknown): value is ActorType {
  return typeof value === 'string' && ACTOR_TYPE_SET.has(value)
}

export function normalizeActorType(value: unknown): ActorType {
  return isActorType(value) ? value : 'human'
}

export function actorTypeLabel(type: ActorType): string {
  switch (type) {
    case 'human': return '사람'
    case 'pipeline': return '자동화'
    case 'system': return '시스템'
  }
}

export interface AuditInsert {
  placeId: string | null
  actorId: string | null
  action: AuditAction
  actorType?: ActorType
  field?: string | null
  before?: unknown
  after?: unknown
  reason?: string | null
}
