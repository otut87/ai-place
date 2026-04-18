/**
 * actions/upload-place-image.ts 테스트 (T-050)
 * 검증·스토리지·DB 경로 mock. 실제 네트워크 호출 없음.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  requireAuthForAction: vi.fn().mockResolvedValue({ id: 'u1' }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const mockSingle = vi.fn()
const mockUpdateEq = vi.fn()
const mockFrom = vi.fn()

const mockStorageUpload = vi.fn()
const mockStorageRemove = vi.fn()
const mockGetPublicUrl = vi.fn()
const mockStorageFrom = vi.fn()

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}))

beforeEach(() => {
  mockSingle.mockReset()
  mockUpdateEq.mockReset()
  mockFrom.mockReset()
  mockStorageUpload.mockReset()
  mockStorageRemove.mockReset()
  mockGetPublicUrl.mockReset()
  mockStorageFrom.mockReset()

  mockSingle.mockResolvedValue({
    data: { city: 'cheonan', category: 'dermatology', slug: 'x', images: [] },
    error: null,
  })
  mockUpdateEq.mockResolvedValue({ error: null })
  mockStorageUpload.mockResolvedValue({ error: null })
  mockStorageRemove.mockResolvedValue({ error: null })
  mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.example.com/places-images/p-1/123-photo.jpg' } })

  mockFrom.mockImplementation(() => ({
    select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
    update: vi.fn(() => ({ eq: mockUpdateEq })),
  }))
  mockStorageFrom.mockImplementation(() => ({
    upload: mockStorageUpload,
    getPublicUrl: mockGetPublicUrl,
    remove: mockStorageRemove,
  }))
})

const VALID_INPUT = {
  placeId: 'p-1',
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  alt: '닥터에버스 진료실 내부',
  type: 'interior' as const,
  body: new Uint8Array(500),
}

describe('uploadPlaceImage — 검증', () => {
  it('빈 바디 거부', async () => {
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage({ ...VALID_INPUT, body: new Uint8Array(0) })
    expect(r.success).toBe(false)
  })

  it('허용되지 않은 MIME 거부', async () => {
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage({ ...VALID_INPUT, mimeType: 'application/pdf' })
    expect(r.success).toBe(false)
  })

  it('alt 누락 거부', async () => {
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage({ ...VALID_INPUT, alt: '' })
    expect(r.success).toBe(false)
  })
})

describe('uploadPlaceImage — 스토리지/DB', () => {
  it('admin 클라이언트 null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage(VALID_INPUT)
    expect(r.success).toBe(false)
  })

  it('업체 조회 실패 → error', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'nf' } })
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage(VALID_INPUT)
    expect(r.success).toBe(false)
  })

  it('Storage upload 실패 → error', async () => {
    mockStorageUpload.mockResolvedValueOnce({ error: { message: 'fail' } })
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage(VALID_INPUT)
    expect(r.success).toBe(false)
  })

  it('성공 경로 — URL + alt/type 반환', async () => {
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage(VALID_INPUT)
    expect(r.success).toBe(true)
    expect(r.image?.url).toContain('places-images')
    expect(r.image?.alt).toBe('닥터에버스 진료실 내부')
    expect(r.image?.type).toBe('interior')
    expect(mockStorageUpload).toHaveBeenCalled()
  })

  it('ArrayBuffer body 도 정상 처리', async () => {
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const buf = new ArrayBuffer(300)
    const r = await uploadPlaceImage({ ...VALID_INPUT, body: buf })
    expect(r.success).toBe(true)
  })

  it('images 메타 업데이트 실패 → error', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'up' } })
    const { uploadPlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await uploadPlaceImage(VALID_INPUT)
    expect(r.success).toBe(false)
  })
})

describe('removePlaceImage', () => {
  it('필수 파라미터 없으면 error', async () => {
    const { removePlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await removePlaceImage('', 'u')
    expect(r.success).toBe(false)
  })

  it('admin client null → error', async () => {
    const { getAdminClient } = await import('@/lib/supabase/admin-client')
    vi.mocked(getAdminClient).mockReturnValueOnce(null)
    const { removePlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await removePlaceImage('p-1', 'https://cdn/places-images/p-1/x.jpg')
    expect(r.success).toBe(false)
  })

  it('정상 삭제 — Storage remove + DB update', async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        city: 'cheonan', category: 'dermatology', slug: 'x',
        images: [{ url: 'https://cdn/places-images/p-1/x.jpg', alt: 'a', type: 'interior' }],
      },
      error: null,
    })
    const { removePlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await removePlaceImage('p-1', 'https://cdn/places-images/p-1/x.jpg')
    expect(r.success).toBe(true)
    expect(mockStorageRemove).toHaveBeenCalledWith(['p-1/x.jpg'])
  })

  it('URL 이 풀에 없어도 DB 업데이트는 수행', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { city: 'c', category: 'd', slug: 'x', images: [] },
      error: null,
    })
    const { removePlaceImage } = await import('@/lib/actions/upload-place-image')
    const r = await removePlaceImage('p-1', 'https://cdn/places-images/p-1/ghost.jpg')
    expect(r.success).toBe(true)
    expect(mockStorageRemove).not.toHaveBeenCalled()
  })
})
