// T-050 — 업체 이미지 업로드 검증 + 스토리지 키 헬퍼.
// Supabase Storage 버킷 'places-images' 에 업로드하기 전/후의 순수 로직.
// Server Action 은 이 라이브러리를 사용해 검증하고, 결과를 places.images JSONB 에 병합한다.

export const IMAGE_TYPE_OPTIONS = [
  'exterior',
  'interior',
  'treatment',
  'staff',
  'equipment',
] as const
export type PlaceImageType = (typeof IMAGE_TYPE_OPTIONS)[number]

export const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB — 리사이즈 전 원본 허용 한계
const MIN_ALT_LEN = 5
const MAX_ALT_LEN = 120

export interface ImageUploadInput {
  filename: string
  mimeType: string
  sizeBytes: number
  alt: string
  type: PlaceImageType
}

export type Validation = { ok: true } | { ok: false; errors: string[] }

export function validateAlt(alt: string): Validation {
  const trimmed = alt.trim()
  if (!trimmed) return { ok: false, errors: ['alt 텍스트가 필요합니다.'] }
  if (trimmed.length < MIN_ALT_LEN) {
    return { ok: false, errors: [`alt 텍스트는 최소 ${MIN_ALT_LEN}자 이상이어야 합니다.`] }
  }
  if (trimmed.length > MAX_ALT_LEN) {
    return { ok: false, errors: [`alt 텍스트는 최대 ${MAX_ALT_LEN}자까지 허용됩니다.`] }
  }
  return { ok: true }
}

export function validateImageUpload(input: ImageUploadInput): Validation {
  const errors: string[] = []

  if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(input.mimeType)) {
    errors.push(`허용되지 않은 파일 형식입니다: ${input.mimeType}`)
  }
  if (input.sizeBytes <= 0) errors.push('빈 파일입니다.')
  else if (input.sizeBytes > MAX_IMAGE_BYTES) {
    errors.push(`파일 크기가 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB 를 초과합니다.`)
  }
  if (!(IMAGE_TYPE_OPTIONS as readonly string[]).includes(input.type)) {
    errors.push(`허용되지 않은 이미지 타입입니다: ${input.type}`)
  }

  const altCheck = validateAlt(input.alt)
  if (!altCheck.ok) errors.push(...altCheck.errors)

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

/**
 * 파일 스템(확장자 제외)을 a-z0-9- 만 남기는 ASCII-safe 슬러그로 치환.
 * 한국어·공백·기호는 하이픈으로 정규화되며, 모두 제거되면 fallback "image" 로 대체.
 */
export function sanitizeFilenameStem(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'image'
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  if (dot < 0 || dot === filename.length - 1) return 'jpg'
  return filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

/**
 * Supabase Storage 객체 키 생성 — placeId/timestamp-safeName.ext
 * placeId 에 경로 구분자가 들어있으면 거부하여 디렉터리 이탈을 차단.
 */
export function makeStorageKey(placeId: string, filename: string): string {
  if (!placeId || /[/\\]/.test(placeId) || placeId.includes('..')) {
    throw new Error(`Invalid placeId: ${placeId}`)
  }
  const stem = sanitizeFilenameStem(filename)
  const ext = extensionOf(filename)
  return `${placeId}/${Date.now()}-${stem}.${ext}`
}
