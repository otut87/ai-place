// T-195 — image-generator 테스트 (OpenAI fetch mock + Supabase storage mock).
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase storage mock — upload 호출 기록용
const { mockUpload, mockGetPublicUrl } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockGetPublicUrl: vi.fn(),
}))
vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => ({
    storage: {
      from: () => ({ upload: mockUpload, getPublicUrl: mockGetPublicUrl }),
    },
  }),
}))

// Google Places photoUrl mock
vi.mock('@/lib/google-places', () => ({
  getPhotoUrl: (ref: string) => `https://places.googleapis.com/fake/${ref}`,
}))

import { generateMainThumbnail, fetchPlacePhotos } from '@/lib/ai/agents/image-generator'
import type { Place } from '@/lib/types'

beforeEach(() => {
  mockUpload.mockReset()
  mockGetPublicUrl.mockReset()
})

describe('generateMainThumbnail', () => {
  it('OpenAI key 없으면 graceful degrade', async () => {
    const original = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY
    const r = await generateMainThumbnail({
      title: 'x', summary: 's', categoryName: '피부과', cityName: '천안',
      sector: 'medical', angle: 'review-deepdive', slug: 's',
    })
    expect(r.url).toBeNull()
    expect(r.error).toContain('OPENAI_API_KEY')
    if (original) process.env.OPENAI_API_KEY = original
  })

  it('b64_json 응답 → upload → public url 반환', async () => {
    mockUpload.mockResolvedValueOnce({ error: null })
    mockGetPublicUrl.mockReturnValueOnce({ data: { publicUrl: 'https://cdn/x.png' } })

    const pngB64 = Buffer.from('fake png bytes').toString('base64')
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: pngB64 }] }),
    })) as unknown as typeof fetch

    const r = await generateMainThumbnail({
      title: 'x', summary: 's', categoryName: '피부과', cityName: '천안',
      sector: 'medical', angle: 'review-deepdive', slug: 'abc',
      apiKey: 'sk-test',
      fetchImpl: fakeFetch,
    })

    expect(r.url).toBe('https://cdn/x.png')
    expect(r.model).toBe('gpt-image-2')
    expect(mockUpload).toHaveBeenCalledWith('abc.png', expect.any(Uint8Array), expect.any(Object))
  })

  it('OpenAI 4xx 응답 → error 반환, url null', async () => {
    const fakeFetch = vi.fn(async () => ({
      ok: false,
      status: 400,
      text: async () => 'bad request',
    })) as unknown as typeof fetch

    const r = await generateMainThumbnail({
      title: 'x', summary: 's', categoryName: '피부과', cityName: '천안',
      sector: 'medical', angle: 'review-deepdive', slug: 's',
      apiKey: 'sk-test',
      fetchImpl: fakeFetch,
    })

    expect(r.url).toBeNull()
    expect(r.error).toContain('OpenAI 400')
  })

  it('skipUpload=true 는 업로드 건너뜀', async () => {
    const pngB64 = Buffer.from('x').toString('base64')
    const fakeFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [{ b64_json: pngB64 }] }),
    })) as unknown as typeof fetch

    const r = await generateMainThumbnail({
      title: 'x', summary: 's', categoryName: '피부과', cityName: '천안',
      sector: 'medical', angle: 'review-deepdive', slug: 's',
      apiKey: 'sk-test',
      fetchImpl: fakeFetch,
      skipUpload: true,
    })

    expect(mockUpload).not.toHaveBeenCalled()
    expect(r.url).toContain('data:image/png')
  })
})

describe('fetchPlacePhotos', () => {
  function mkPlace(slug: string, photoRefs: string[] = []): Place & { photoRefs: string[] } {
    return {
      slug, name: slug, city: 'cheonan', category: 'dermatology',
      description: '', address: '', services: [], faqs: [], tags: [],
      rating: 4.5, reviewCount: 10,
      photoRefs,
    }
  }

  it('photoRefs 에서 URL 생성', () => {
    const r = fetchPlacePhotos({
      places: [
        mkPlace('a', ['ref1', 'ref2', 'ref3']),
        mkPlace('b', ['ref4']),
      ],
      maxPerPlace: 2,
      maxTotal: 5,
    })
    expect(r.count).toBe(3)  // a 2장 + b 1장
    expect(r.photos[0].url).toContain('ref1')
  })

  it('maxTotal 상한 적용', () => {
    const r = fetchPlacePhotos({
      places: [mkPlace('a', ['r1', 'r2', 'r3', 'r4', 'r5'])],
      maxPerPlace: 5,
      maxTotal: 3,
    })
    expect(r.count).toBe(3)
  })

  it('photoRefs 없으면 빈 결과', () => {
    const r = fetchPlacePhotos({ places: [mkPlace('a', [])] })
    expect(r.count).toBe(0)
  })
})
