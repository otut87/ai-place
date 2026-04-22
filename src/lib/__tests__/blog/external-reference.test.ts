// T-194 — fetchExternalReferences 테스트.
// 핵심 검증: DB 미저장 + 내부 업체 충분 시 API 호출 생략.
import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock 은 hoisted — top-level const 를 참조하려면 vi.hoisted 로 감싸야 함.
const { mockSearch } = vi.hoisted(() => ({ mockSearch: vi.fn() }))

vi.mock('@/lib/google-places', () => ({
  searchPlaceByText: mockSearch,
}))

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: () => null,
}))

import { fetchExternalReferences } from '@/lib/blog/external-reference'

beforeEach(() => {
  mockSearch.mockReset()
})

describe('fetchExternalReferences', () => {
  it('내부 active 업체가 minReferenceCount 이상이면 API 호출 생략', async () => {
    const r = await fetchExternalReferences({
      sector: 'medical',
      category: 'dermatology',
      cityName: '천안',
      internalActiveCount: 10,
      minReferenceCount: 5,
    })
    expect(r.skipped).toBe(true)
    expect(r.places).toEqual([])
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('내부 부족 시 Google Places 호출, 결과 정규화', async () => {
    mockSearch.mockResolvedValueOnce([
      { placeId: 'p1', name: 'A 피부과', address: '천안시 동남구', rating: 4.6, reviewCount: 120 },
      { placeId: 'p2', name: 'B 피부과', address: '천안시 서북구', rating: 4.3, reviewCount: 45 },
    ])

    const r = await fetchExternalReferences({
      sector: 'medical',
      category: 'dermatology',
      cityName: '천안',
      internalActiveCount: 2,
      minReferenceCount: 5,
    })

    expect(r.skipped).toBe(false)
    expect(r.places.length).toBe(2)
    expect(r.places[0]).toEqual({
      name: 'A 피부과',
      address: '천안시 동남구',
      rating: 4.6,
      reviewCount: 120,
      source: 'google_external',
    })
    expect(r.query).toBe('천안 dermatology')
  })

  it('excludeNames 로 내부 중복 업체 제외', async () => {
    mockSearch.mockResolvedValueOnce([
      { placeId: 'p1', name: '이미 내부 등록', address: 'x', rating: 4.5, reviewCount: 10 },
      { placeId: 'p2', name: '외부만', address: 'y', rating: 4.0, reviewCount: 5 },
    ])

    const r = await fetchExternalReferences({
      sector: 'medical',
      cityName: '천안',
      internalActiveCount: 1,
      minReferenceCount: 5,
      excludeNames: ['이미 내부 등록'],
    })

    expect(r.places.map(p => p.name)).toEqual(['외부만'])
  })

  it('Google 결과 null 일 때 빈 배열 반환 (에러 없음)', async () => {
    mockSearch.mockResolvedValueOnce(null)
    const r = await fetchExternalReferences({
      sector: 'medical', cityName: '천안', internalActiveCount: 0,
    })
    expect(r.places).toEqual([])
    expect(r.skipped).toBe(false)
  })

  it('반환 타입에 slug/id 필드 없음 — DB 저장 방지 설계', async () => {
    mockSearch.mockResolvedValueOnce([
      { placeId: 'p1', name: 'X', address: 'x', rating: 4, reviewCount: 10 },
    ])
    const r = await fetchExternalReferences({
      sector: 'medical', cityName: '천안', internalActiveCount: 0,
    })
    const item = r.places[0] as Record<string, unknown>
    expect('slug' in item).toBe(false)
    expect('id' in item).toBe(false)
    expect('placeId' in item).toBe(false)
    expect(item.source).toBe('google_external')
  })
})
