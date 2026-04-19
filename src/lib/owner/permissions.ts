// T-054 — 사장님 셀프 포털 권한/검증 순수 로직.
// 서버 액션은 여기 노출된 화이트리스트와 validator 로만 업데이트를 허용해야 한다.

export const OWNER_EDITABLE_FIELDS = [
  'name_en',
  'description',
  'phone',
  'opening_hours',
  'tags',
  'images',
  'services',
  'faqs',
  'recommended_for',
  'strengths',
  'naver_place_url',
  'kakao_map_url',
  'google_business_url',
  'homepage_url',
  'blog_url',
  'instagram_url',
] as const
export type OwnerEditableField = (typeof OWNER_EDITABLE_FIELDS)[number]

const OWNER_EDITABLE_SET: ReadonlySet<string> = new Set(OWNER_EDITABLE_FIELDS)

export function isOwnerEditableField(value: unknown): value is OwnerEditableField {
  return typeof value === 'string' && OWNER_EDITABLE_SET.has(value)
}

export interface OwnerIdentity {
  userId: string
  email: string | null
}

export interface PlaceOwnershipRow {
  owner_id: string | null
  owner_email: string | null
}

/** 현재 사용자가 해당 업체를 편집할 수 있는지 (owner_id 또는 owner_email 매칭). */
export function canOwnerEdit(place: PlaceOwnershipRow | null, user: OwnerIdentity): boolean {
  if (!place) return false
  if (place.owner_id && place.owner_id === user.userId) return true
  if (place.owner_email && user.email && place.owner_email === user.email) return true
  return false
}

export type OwnerPatch = Partial<{
  name_en: string
  description: string
  phone: string
  opening_hours: string[]
  tags: string[]
  images: Array<{ url: string; alt: string; type: string }>
  services: Array<{ name: string; description?: string; priceRange?: string }>
  faqs: Array<{ question: string; answer: string }>
  recommended_for: string[]
  strengths: string[]
  naver_place_url: string
  kakao_map_url: string
  google_business_url: string
  homepage_url: string
  blog_url: string
  instagram_url: string
}>

/** 입력 객체에서 허용 필드만 뽑아 새 오브젝트로 반환. undefined 는 제외. */
export function normalizeOwnerPatch(input: Record<string, unknown>): OwnerPatch {
  const out: OwnerPatch = {}
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue
    if (!isOwnerEditableField(k)) continue
    ;(out as Record<string, unknown>)[k] = v
  }
  return out
}

const PHONE_RE = /^[\d\s\-+()]*$/
const URL_RE = /^https?:\/\/[^\s]+$/
const MAX_TAGS = 10
const DESC_MIN = 10
const DESC_MAX = 300
const MAX_FAQS = 20
const MAX_SERVICES = 30
const MAX_IMAGES = 20

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] }

export function validateOwnerPatch(patch: OwnerPatch): ValidationResult {
  const errors: string[] = []
  if (Object.keys(patch).length === 0) errors.push('변경할 내용이 없습니다.')

  if (patch.description !== undefined) {
    const d = patch.description.trim()
    if (d.length < DESC_MIN) errors.push(`소개 문구는 최소 ${DESC_MIN}자 이상이어야 합니다.`)
    else if (d.length > DESC_MAX) errors.push(`소개 문구는 최대 ${DESC_MAX}자까지 허용됩니다.`)
  }

  if (patch.phone !== undefined && patch.phone !== '' && !PHONE_RE.test(patch.phone)) {
    errors.push('전화번호 형식이 올바르지 않습니다.')
  }

  if (patch.tags !== undefined) {
    if (!Array.isArray(patch.tags)) errors.push('태그는 배열이어야 합니다.')
    else if (patch.tags.length > MAX_TAGS) errors.push(`태그는 최대 ${MAX_TAGS}개까지 입력할 수 있습니다.`)
  }

  if (patch.opening_hours !== undefined && !Array.isArray(patch.opening_hours)) {
    errors.push('영업시간은 문자열 배열이어야 합니다.')
  }

  if (patch.images !== undefined) {
    if (!Array.isArray(patch.images)) errors.push('이미지는 배열이어야 합니다.')
    else if (patch.images.length > MAX_IMAGES) errors.push(`이미지는 최대 ${MAX_IMAGES}장까지 허용됩니다.`)
  }

  if (patch.services !== undefined) {
    if (!Array.isArray(patch.services)) errors.push('서비스는 배열이어야 합니다.')
    else if (patch.services.length > MAX_SERVICES) errors.push(`서비스는 최대 ${MAX_SERVICES}개까지 허용됩니다.`)
  }

  if (patch.faqs !== undefined) {
    if (!Array.isArray(patch.faqs)) errors.push('FAQ 는 배열이어야 합니다.')
    else if (patch.faqs.length > MAX_FAQS) errors.push(`FAQ 는 최대 ${MAX_FAQS}개까지 허용됩니다.`)
  }

  // 외부 URL 검증
  for (const field of ['naver_place_url', 'kakao_map_url', 'google_business_url', 'homepage_url', 'blog_url', 'instagram_url'] as const) {
    const v = patch[field]
    if (v !== undefined && v !== '' && !URL_RE.test(v)) {
      errors.push(`${field} 는 올바른 URL 이어야 합니다.`)
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
