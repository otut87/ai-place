// T-130 — 블로그 추천 업체 자동 선정 로직 테스트.
import { describe, it, expect } from 'vitest'
import {
  selectCandidatePlaces,
  type SelectionInput,
} from '@/lib/ai/select-candidate-places'
import type { Place } from '@/lib/types'

function mkPlace(overrides: Partial<Place> & { slug: string }): Place {
  const { slug, ...rest } = overrides
  return {
    slug,
    name: rest.name ?? slug,
    city: rest.city ?? 'cheonan',
    category: rest.category ?? 'dermatology',
    description: '',
    address: '',
    services: [],
    faqs: [],
    tags: [],
    rating: 4.5,
    reviewCount: 50,
    ...rest,
  }
}

describe('T-130 selectCandidatePlaces', () => {
  it('city+category 일치 + 명시적 rating/reviewCount 기준 상위 N곳 반환', () => {
    const places: Place[] = [
      mkPlace({ slug: 'top1', rating: 4.9, reviewCount: 200 }),
      mkPlace({ slug: 'top2', rating: 4.8, reviewCount: 150 }),
      mkPlace({ slug: 'top3', rating: 4.7, reviewCount: 120 }),
      mkPlace({ slug: 'bad-rating', rating: 3.8, reviewCount: 200 }), // 평점 미달
      mkPlace({ slug: 'few-reviews', rating: 4.9, reviewCount: 5 }), // 리뷰 부족
      mkPlace({ slug: 'different-city', city: 'seoul', rating: 5, reviewCount: 300 }),
      mkPlace({ slug: 'different-cat', category: 'dental', rating: 5, reviewCount: 300 }),
    ]
    // T-194: 기본 필터가 0 이므로 품질 필터를 보려면 명시 지정.
    const input: SelectionInput = {
      city: 'cheonan',
      category: 'dermatology',
      places,
      maxCount: 3,
      minRating: 4.0,
      minReviewCount: 10,
    }
    const result = selectCandidatePlaces(input)
    expect(result.places).toHaveLength(3)
    expect(result.places.map(p => p.slug)).toEqual(['top1', 'top2', 'top3'])
    expect(result.reasoning).toMatch(/평점|리뷰|\d개/)
  })

  it('T-194: 기본값(0/0) 에선 평점·리뷰 제약 없이 전체 active 업체가 후보', () => {
    const places: Place[] = [
      mkPlace({ slug: 'high', rating: 4.9, reviewCount: 200 }),
      mkPlace({ slug: 'low', rating: 3.8, reviewCount: 2 }),
      mkPlace({ slug: 'none', rating: null as unknown as number, reviewCount: null as unknown as number }),
    ]
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places, maxCount: 5,
    })
    // 3개 모두 통과 — 정렬만 (rating nulls 뒤로)
    expect(result.places.map(p => p.slug)).toEqual(['high', 'low', 'none'])
    expect(result.warning).toBeUndefined()
  })

  it('T-194: 등록 업체 0개면 외부 업체 참조 필요 warning', () => {
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places: [], maxCount: 5,
    })
    expect(result.places).toHaveLength(0)
    expect(result.warning).toMatch(/외부 업체 참조/)
  })

  it('quality_score 가 더 높은 업체가 평점 같을 때 앞으로', () => {
    const places = [
      mkPlace({ slug: 'lower-quality', rating: 4.5, reviewCount: 100 }),
      mkPlace({ slug: 'higher-quality', rating: 4.5, reviewCount: 100 }),
    ]
    // qualityScore 는 Place interface 에 없으므로 캐스팅하여 주입
    ;(places[0] as unknown as { qualityScore: number }).qualityScore = 60
    ;(places[1] as unknown as { qualityScore: number }).qualityScore = 90
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places, maxCount: 2,
    })
    expect(result.places[0].slug).toBe('higher-quality')
  })

  it('명시 필터에 걸려 0개일 때 warning 반환', () => {
    const places = [mkPlace({ slug: 'bad', rating: 3.0, reviewCount: 2 })]
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places, maxCount: 5,
      minRating: 4.0, minReviewCount: 10,
    })
    expect(result.places).toHaveLength(0)
    expect(result.warning).toMatch(/평점|리뷰/)
  })

  it('minRating/minReviewCount 를 입력으로 덮어쓸 수 있다 (느슨한 경우)', () => {
    const places = [mkPlace({ slug: 'loose', rating: 3.5, reviewCount: 5 })]
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places, maxCount: 5,
      minRating: 3.0, minReviewCount: 3,
    })
    expect(result.places).toHaveLength(1)
  })

  it('의료 카테고리는 compliance 업체만 기본 허용 (placeType 있을 때)', () => {
    const places = [
      mkPlace({ slug: 'clinic1', category: 'dermatology', placeType: '질환치료형' }),
      mkPlace({ slug: 'ambig', category: 'dermatology' }), // placeType 없음
    ]
    const result = selectCandidatePlaces({
      city: 'cheonan', category: 'dermatology', places, maxCount: 5,
      requireComplianceMetadata: true,
    })
    expect(result.places.map(p => p.slug)).toContain('clinic1')
    expect(result.places.map(p => p.slug)).not.toContain('ambig')
  })
})
