// T-112 — 의료 카테고리 JSON-LD 상세 속성 테스트.
// SCHEMA_DATA_DICTIONARY §2.1 구현 검증.

import { describe, it, expect } from 'vitest'
import { generateLocalBusiness } from '@/lib/jsonld'
import { getCityAddressRegion } from '@/lib/jsonld/address-region'
import type { Place } from '@/lib/types'

function makeMedical(overrides: Partial<Place> = {}): Place {
  return {
    slug: 'test-clinic',
    name: '테스트 피부과',
    city: 'cheonan',
    category: 'dermatology',
    description: '테스트 설명',
    address: '충청남도 천안시 동남구 충절로 123',
    services: [],
    faqs: [],
    tags: [],
    ...overrides,
  } as Place
}

describe('T-112 의료 카테고리 JSON-LD', () => {
  it('address.addressLocality 는 한글 도시명, addressRegion 은 도/광역시', () => {
    const jsonld = generateLocalBusiness(makeMedical())
    expect(jsonld.address.addressLocality).toBe('천안시')
    expect(jsonld.address.addressRegion).toBe('충청남도')
    expect(jsonld.address.addressCountry).toBe('KR')
  })

  it('medicalSpecialty 가 ITU 표준 값 (T-121)', () => {
    expect(generateLocalBusiness(makeMedical({ category: 'dermatology' })).medicalSpecialty).toBe('Dermatology')
    expect(generateLocalBusiness(makeMedical({ category: 'dental' })).medicalSpecialty).toBe('Dentistry')
    expect(generateLocalBusiness(makeMedical({ category: 'korean-medicine' })).medicalSpecialty).toBe('TraditionalChineseMedicine')
  })

  it('aggregateRating 은 rating + reviewCount 가 모두 있을 때만', () => {
    const withBoth = generateLocalBusiness(makeMedical({ rating: 4.5, reviewCount: 100 }))
    expect(withBoth.aggregateRating).toMatchObject({
      '@type': 'AggregateRating',
      ratingValue: 4.5,
      reviewCount: 100,
      bestRating: 5,
    })

    const noRating = generateLocalBusiness(makeMedical({ rating: null, reviewCount: 100 }))
    expect(noRating.aggregateRating).toBeUndefined()

    const noCount = generateLocalBusiness(makeMedical({ rating: 4.5, reviewCount: null }))
    expect(noCount.aggregateRating).toBeUndefined()
  })

  it('hasOfferCatalog 는 services 가 있을 때만 + Offer 배열', () => {
    const withServices = generateLocalBusiness(
      makeMedical({
        services: [
          { name: '여드름 치료', description: '전문 시술', priceRange: '10만원~' },
          { name: '레이저 토닝', description: '' },
        ],
      }),
    )
    expect(withServices.hasOfferCatalog).toBeDefined()
    expect(withServices.hasOfferCatalog.itemListElement).toHaveLength(2)

    const noServices = generateLocalBusiness(makeMedical({ services: [] }))
    expect(noServices.hasOfferCatalog).toBeUndefined()
  })

  it('openingHoursSpecification 는 openingHours 가 있을 때만 배열 형태', () => {
    const withHours = generateLocalBusiness(
      makeMedical({ openingHours: ['Mo-Fr 09:00-18:00'] }),
    )
    expect(Array.isArray(withHours.openingHoursSpecification)).toBe(true)
    expect(withHours.openingHoursSpecification.length).toBeGreaterThan(0)
  })

  it('geo 는 위경도가 모두 있을 때만', () => {
    const withGeo = generateLocalBusiness(makeMedical({ latitude: 36.8, longitude: 127.15 }))
    expect(withGeo.geo).toMatchObject({
      '@type': 'GeoCoordinates',
      latitude: 36.8,
      longitude: 127.15,
    })

    const noLat = generateLocalBusiness(makeMedical({ latitude: undefined, longitude: 127.15 }))
    expect(noLat.geo).toBeUndefined()
  })

  it('image 는 imageUrl 이 있을 때만 (거짓 데이터 금지)', () => {
    expect(generateLocalBusiness(makeMedical({ imageUrl: undefined })).image).toBeUndefined()
    expect(generateLocalBusiness(makeMedical({ imageUrl: 'https://ex.com/a.jpg' })).image).toBe('https://ex.com/a.jpg')
  })
})

describe('getCityAddressRegion', () => {
  it('천안 → 충청남도', () => {
    expect(getCityAddressRegion('cheonan')).toBe('충청남도')
  })

  it('서울 → 서울특별시', () => {
    expect(getCityAddressRegion('seoul')).toBe('서울특별시')
  })

  it('미등록 city → null', () => {
    expect(getCityAddressRegion('unknown-city')).toBeNull()
  })
})
