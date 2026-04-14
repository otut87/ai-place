// AI Place — JSON-LD Structured Data Generation
// AI 크롤러가 구조적으로 읽을 수 있는 Schema.org 데이터 생성

import type { Place, FAQ } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonLd = Record<string, any>

const CATEGORY_SCHEMA_MAP: Record<string, string> = {
  dermatology: 'MedicalClinic',
  dentistry: 'Dentist',
  hairsalon: 'HairSalon',
  interior: 'HomeAndConstructionBusiness',
}

export function generateLocalBusiness(place: Place): JsonLd {
  const schemaType = CATEGORY_SCHEMA_MAP[place.category] ?? 'LocalBusiness'

  const jsonld: JsonLd = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    name: place.name,
    description: place.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address,
      addressLocality: place.city,
      addressCountry: 'KR',
    },
  }

  if (place.nameEn) {
    jsonld.alternateName = place.nameEn
  }

  if (place.phone) {
    jsonld.telephone = place.phone
  }

  if (place.latitude != null && place.longitude != null) {
    jsonld.geo = {
      '@type': 'GeoCoordinates',
      latitude: place.latitude,
      longitude: place.longitude,
    }
  }

  if (place.openingHours) {
    jsonld.openingHours = place.openingHours
  }

  if (place.imageUrl) {
    jsonld.image = place.imageUrl
  }

  if (place.rating != null && place.reviewCount != null) {
    jsonld.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: place.rating,
      reviewCount: place.reviewCount,
      bestRating: 5,
    }
  }

  if (place.services.length > 0) {
    jsonld.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: '제공 서비스',
      itemListElement: place.services.map(s => ({
        '@type': 'Offer',
        itemOffered: {
          '@type': 'Service',
          name: s.name,
          ...(s.description && { description: s.description }),
        },
        ...(s.priceRange && { priceRange: s.priceRange }),
      })),
    }
  }

  const sameAs: string[] = []
  if (place.naverPlaceUrl) sameAs.push(place.naverPlaceUrl)
  if (place.kakaoMapUrl) sameAs.push(place.kakaoMapUrl)
  if (sameAs.length > 0) {
    jsonld.sameAs = sameAs
  }

  return jsonld
}

export function generateItemList(places: Place[], title: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: places.length,
    itemListElement: places.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': CATEGORY_SCHEMA_MAP[place.category] ?? 'LocalBusiness',
        name: place.name,
        description: place.description,
        address: place.address,
        ...(place.rating != null && {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: place.rating,
            reviewCount: place.reviewCount,
          },
        }),
      },
    })),
  }
}

export function generateFAQPage(faqs: FAQ[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}
