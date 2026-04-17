/**
 * google-places 매칭 보강 (T-012)
 * matchGooglePlaceByAddress: 이름 + 주소 텍스트쿼리 + 좌표 근접도 검증.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/google-places', async () => {
  const actual = await vi.importActual<typeof import('@/lib/google-places')>('@/lib/google-places')
  return {
    ...actual,
    searchPlaceByText: vi.fn(),
  }
})

import * as gp from '@/lib/google-places'
import { matchGooglePlaceByAddress, distanceMeters } from '@/lib/search/google-match'

const mockSearch = gp.searchPlaceByText as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockSearch.mockReset()
})

describe('distanceMeters (Haversine)', () => {
  it('동일 좌표 → 0m', () => {
    expect(distanceMeters(36.8189, 127.1199, 36.8189, 127.1199)).toBeCloseTo(0, 1)
  })

  it('~50m 이내 (동일 건물 다른 호수 가정)', () => {
    const d = distanceMeters(36.8189, 127.1199, 36.81935, 127.1199)
    expect(d).toBeGreaterThan(40)
    expect(d).toBeLessThan(60)
  })

  it('1km 차이', () => {
    const d = distanceMeters(36.8, 127.1, 36.809, 127.1)
    expect(d).toBeGreaterThan(900)
    expect(d).toBeLessThan(1100)
  })
})

describe('matchGooglePlaceByAddress', () => {
  const base = { latitude: 36.8189, longitude: 127.1199 }

  it('첫 결과가 50m 이내 → 매칭', async () => {
    mockSearch.mockResolvedValue([
      { placeId: 'gp1', name: '차앤박피부과', address: '충남 천안시...', latitude: 36.8189, longitude: 127.1199 },
    ])
    const result = await matchGooglePlaceByAddress('차앤박피부과', '충남 천안시', base)
    expect(result).not.toBeNull()
    expect(result?.placeId).toBe('gp1')
  })

  it('첫 결과가 50m 초과 → null (좌표 불일치)', async () => {
    mockSearch.mockResolvedValue([
      { placeId: 'gp1', name: '차앤박피부과', address: '충남 천안시...', latitude: 36.9, longitude: 127.2 },
    ])
    const result = await matchGooglePlaceByAddress('차앤박피부과', '충남 천안시', base)
    expect(result).toBeNull()
  })

  it('결과 없음 → null', async () => {
    mockSearch.mockResolvedValue([])
    const result = await matchGooglePlaceByAddress('x', 'y', base)
    expect(result).toBeNull()
  })

  it('searchPlaceByText null 반환 → null', async () => {
    mockSearch.mockResolvedValue(null)
    const result = await matchGooglePlaceByAddress('x', 'y', base)
    expect(result).toBeNull()
  })

  it('기준 좌표 없으면 첫 결과 그대로 반환 (매칭 스킵)', async () => {
    mockSearch.mockResolvedValue([
      { placeId: 'gp1', name: '이름', address: '주소', latitude: 36.9, longitude: 127.2 },
    ])
    const result = await matchGooglePlaceByAddress('이름', '주소')
    expect(result?.placeId).toBe('gp1')
  })

  it('후보 중 좌표 없는 항목 건너뛰고 다음 매칭', async () => {
    mockSearch.mockResolvedValue([
      { placeId: 'gp0', name: '이름A', address: '주소A' }, // 좌표 없음
      { placeId: 'gp1', name: '이름B', address: '주소B', latitude: 36.8189, longitude: 127.1199 },
    ])
    const result = await matchGooglePlaceByAddress('이름', '주소', base)
    expect(result?.placeId).toBe('gp1')
  })
})
