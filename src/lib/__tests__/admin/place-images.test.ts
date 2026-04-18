import { describe, it, expect } from 'vitest'
import {
  validateImageUpload,
  validateAlt,
  makeStorageKey,
  sanitizeFilenameStem,
  IMAGE_TYPE_OPTIONS,
  MAX_IMAGE_BYTES,
  ALLOWED_IMAGE_MIME,
  type ImageUploadInput,
} from '@/lib/admin/place-images'

function input(overrides: Partial<ImageUploadInput> = {}): ImageUploadInput {
  return {
    filename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 500_000,
    alt: '닥터에버스 진료실 내부',
    type: 'interior',
    ...overrides,
  }
}

describe('validateAlt', () => {
  it('빈 alt 거부', () => {
    const r = validateAlt('')
    expect(r.ok).toBe(false)
  })
  it('공백만 있는 alt 거부', () => {
    const r = validateAlt('   ')
    expect(r.ok).toBe(false)
  })
  it('5자 미만 거부', () => {
    const r = validateAlt('짧음')
    expect(r.ok).toBe(false)
  })
  it('120자 초과 거부', () => {
    const r = validateAlt('가'.repeat(121))
    expect(r.ok).toBe(false)
  })
  it('적정 길이 허용', () => {
    const r = validateAlt('닥터에버스 여드름 레이저 시술실')
    expect(r.ok).toBe(true)
  })
})

describe('validateImageUpload', () => {
  it('허용 MIME 은 통과', () => {
    const r = validateImageUpload(input({ mimeType: 'image/jpeg' }))
    expect(r.ok).toBe(true)
  })
  it('png/webp 허용', () => {
    expect(validateImageUpload(input({ mimeType: 'image/png' })).ok).toBe(true)
    expect(validateImageUpload(input({ mimeType: 'image/webp' })).ok).toBe(true)
  })
  it('비허용 MIME 거부', () => {
    const r = validateImageUpload(input({ mimeType: 'application/pdf' }))
    expect(r.ok).toBe(false)
  })
  it('크기 초과 거부', () => {
    const r = validateImageUpload(input({ sizeBytes: MAX_IMAGE_BYTES + 1 }))
    expect(r.ok).toBe(false)
  })
  it('빈 파일 거부', () => {
    const r = validateImageUpload(input({ sizeBytes: 0 }))
    expect(r.ok).toBe(false)
  })
  it('type 화이트리스트 외 값 거부', () => {
    const r = validateImageUpload(input({ type: 'hallway' as unknown as ImageUploadInput['type'] }))
    expect(r.ok).toBe(false)
  })
  it('alt 필수', () => {
    const r = validateImageUpload(input({ alt: '' }))
    expect(r.ok).toBe(false)
  })
  it('허용된 5개 타입 모두 통과', () => {
    for (const t of IMAGE_TYPE_OPTIONS) {
      expect(validateImageUpload(input({ type: t })).ok).toBe(true)
    }
  })
})

describe('sanitizeFilenameStem', () => {
  it('한글·공백·특수문자 → 영문 안전 문자', () => {
    expect(sanitizeFilenameStem('닥터 에버스 사진!.jpg')).toMatch(/^[a-z0-9-]+$/)
  })
  it('확장자 제거', () => {
    const r = sanitizeFilenameStem('hello.world.JPG')
    expect(r).not.toContain('.')
  })
  it('빈 입력 → fallback', () => {
    const r = sanitizeFilenameStem('')
    expect(r.length).toBeGreaterThan(0)
  })
})

describe('makeStorageKey', () => {
  it('placeId + 타임스탬프 + 안전 파일명을 조합', () => {
    const k = makeStorageKey('p-1', 'photo.jpg')
    expect(k).toMatch(/^p-1\/\d+-photo\.jpg$/)
  })
  it('한글 파일명은 안전 문자로 변환', () => {
    const k = makeStorageKey('p-1', '내부 사진.JPG')
    expect(k).toMatch(/^p-1\/\d+-[a-z0-9-]+\.jpg$/)
  })
  it('placeId 에 슬래시가 있으면 거부', () => {
    expect(() => makeStorageKey('p-1/../evil', 'a.jpg')).toThrow()
  })
})

describe('constants', () => {
  it('MAX_IMAGE_BYTES 는 10MB 이하', () => {
    expect(MAX_IMAGE_BYTES).toBeLessThanOrEqual(10 * 1024 * 1024)
  })
  it('ALLOWED_IMAGE_MIME 에 jpg/png/webp 포함', () => {
    expect(ALLOWED_IMAGE_MIME).toContain('image/jpeg')
    expect(ALLOWED_IMAGE_MIME).toContain('image/png')
    expect(ALLOWED_IMAGE_MIME).toContain('image/webp')
  })
})
