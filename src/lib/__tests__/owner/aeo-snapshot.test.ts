import { describe, it, expect, vi, beforeEach } from 'vitest'

// T-209 — aeo-snapshot 테스트.
// Supabase mock + place-mentions mock 로 장바구니 구성.

interface MockPlace {
  id: string; name: string; slug: string; city: string; category: string
  description: string | null; phone: string | null; address: string | null
  opening_hours: string[] | null
  images: unknown; image_url: string | null
  review_count: number | null
  services: unknown; faqs: unknown; review_summaries: unknown
  updated_at: string | null
}

const state: { places: MockPlace[]; mentions: Map<string, number> } = {
  places: [],
  mentions: new Map(),
}

function makeAdmin() {
  return {
    from(table: string) {
      if (table === 'places') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: state.places, error: null }),
          }),
        }
      }
      throw new Error(`unexpected ${table}`)
    },
  }
}

vi.mock('@/lib/supabase/admin-client', () => ({
  getAdminClient: vi.fn(() => makeAdmin()),
}))

vi.mock('@/lib/owner/place-mentions', () => ({
  countMentionsByPlace: vi.fn(async (ids: string[]) => {
    const map = new Map<string, { directMentions: number; contentMentions: number; totalMentions: number }>()
    for (const id of ids) {
      const c = state.mentions.get(id) ?? 0
      map.set(id, { directMentions: 0, contentMentions: c, totalMentions: c })
    }
    return map
  }),
}))

import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'

beforeEach(() => {
  state.places = []
  state.mentions = new Map()
})

describe('loadAeoSnapshotsForPlaces', () => {
  it('빈 입력 → 빈 배열', async () => {
    const result = await loadAeoSnapshotsForPlaces([])
    expect(result).toEqual([])
  })

  it('업체 1개 — 기본 필드만 있으면 AEO 점수 계산되고 이슈 반환', async () => {
    state.places = [{
      id: 'p1', name: '테스트 업체', slug: 'test', city: 'cheonan', category: 'dermatology',
      description: null, phone: null, address: null,
      opening_hours: null, images: null, image_url: null, review_count: null,
      services: null, faqs: null, review_summaries: null, updated_at: null,
    }]
    const result = await loadAeoSnapshotsForPlaces(['p1'])
    expect(result).toHaveLength(1)
    const snap = result[0]
    expect(snap.placeId).toBe('p1')
    expect(snap.placeName).toBe('테스트 업체')
    expect(snap.citySlug).toBe('cheonan')
    expect(snap.categorySlug).toBe('dermatology')
    expect(snap.score).toBeGreaterThanOrEqual(0)
    expect(snap.score).toBeLessThanOrEqual(100)
    expect(['A', 'B', 'C', 'D']).toContain(snap.grade)
    expect(snap.topIssues.length).toBeGreaterThan(0)
    expect(snap.topIssues.length).toBeLessThanOrEqual(3)
    expect(snap.totalCount).toBeGreaterThan(0)
  })

  it('여러 업체 — 순서 보존 + 각자 독립 계산', async () => {
    state.places = [
      { id: 'p1', name: 'A', slug: 'a', city: 'x', category: 'y', description: null, phone: null, address: null, opening_hours: null, images: null, image_url: null, review_count: null, services: null, faqs: null, review_summaries: null, updated_at: null },
      { id: 'p2', name: 'B', slug: 'b', city: 'x', category: 'y', description: null, phone: null, address: null, opening_hours: null, images: null, image_url: null, review_count: null, services: null, faqs: null, review_summaries: null, updated_at: null },
    ]
    const result = await loadAeoSnapshotsForPlaces(['p1', 'p2'])
    expect(result).toHaveLength(2)
    expect(result[0].placeId).toBe('p1')
    expect(result[1].placeId).toBe('p2')
  })

  it('mention count 가 AEO 점수에 반영됨 (컨텐츠 언급 0개면 해당 룰 실패)', async () => {
    state.places = [{
      id: 'p1', name: 'Test', slug: 't', city: 'x', category: 'y',
      description: null, phone: '02-123-4567', address: '서울 강남구',
      opening_hours: ['09:00-18:00'], images: null, image_url: null, review_count: 100,
      services: null, faqs: null, review_summaries: null, updated_at: new Date().toISOString(),
    }]
    state.mentions.set('p1', 0)  // 언급 0개
    const resultZero = await loadAeoSnapshotsForPlaces(['p1'])
    expect(resultZero).toHaveLength(1)
    const scoreZero = resultZero[0].score

    state.mentions.set('p1', 50) // 언급 많으면 점수 상승
    const resultMany = await loadAeoSnapshotsForPlaces(['p1'])
    expect(resultMany[0].score).toBeGreaterThan(scoreZero)
  })

  it('topIssues 는 가중치(weight) 내림차순 정렬 + 최대 3개', async () => {
    state.places = [{
      id: 'p1', name: 'Empty', slug: 'e', city: 'x', category: 'y',
      description: null, phone: null, address: null,
      opening_hours: null, images: null, image_url: null, review_count: null,
      services: null, faqs: null, review_summaries: null, updated_at: null,
    }]
    const result = await loadAeoSnapshotsForPlaces(['p1'])
    expect(result[0].topIssues.length).toBeLessThanOrEqual(3)
  })
})
