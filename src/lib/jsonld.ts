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

/** openingHours 문자열을 OpeningHoursSpecification으로 변환 (§9.1) */
const DAY_MAP: Record<string, string> = {
  Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday',
  Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday',
}

function parseOpeningHours(hours: string[]): JsonLd[] {
  const specs: JsonLd[] = []
  for (const entry of hours) {
    const match = entry.match(/^([A-Za-z,-]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/)
    if (!match) continue
    const [, daysPart, opens, closes] = match
    // Handle "Mo-Fr" or "Mo" or "Mo,We,Fr"
    const dayRangeMatch = daysPart.match(/^(\w{2})-(\w{2})$/)
    if (dayRangeMatch) {
      const dayKeys = Object.keys(DAY_MAP)
      const start = dayKeys.indexOf(dayRangeMatch[1])
      const end = dayKeys.indexOf(dayRangeMatch[2])
      if (start >= 0 && end >= 0) {
        for (let i = start; i <= end; i++) {
          specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: DAY_MAP[dayKeys[i]], opens, closes })
        }
      }
    } else {
      // Single day like "Sa" or "Th"
      const day = DAY_MAP[daysPart]
      if (day) {
        specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens, closes })
      }
    }
  }
  return specs
}

export function generateLocalBusiness(place: Place, pageUrl?: string): JsonLd {
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

  // CRITICAL 5: @id + mainEntityOfPage (§5.3)
  if (pageUrl) {
    jsonld['@id'] = pageUrl
    jsonld.mainEntityOfPage = pageUrl
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
    const specs = parseOpeningHours(place.openingHours)
    if (specs.length > 0) {
      jsonld.openingHoursSpecification = specs
    }
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
        ...(s.priceRange && { description: `가격: ${s.priceRange}` }),
      })),
    }
  }

  // dateModified는 CreativeWork 계열에서만 유효 — MedicalClinic 등 LocalBusiness에서는 사용 불가
  // lastUpdated는 페이지 HTML에만 표시

  const sameAs: string[] = []
  if (place.naverPlaceUrl) sameAs.push(place.naverPlaceUrl)
  if (place.kakaoMapUrl) sameAs.push(place.kakaoMapUrl)
  if (place.googleBusinessUrl) sameAs.push(place.googleBusinessUrl)
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

/** Article schema — 비교/가이드 페이지용 (GEO §4.1 E-E-A-T) */
export function generateArticle(opts: {
  title: string
  description: string
  lastUpdated: string
  url: string
}): JsonLd {
  const org = {
    '@type': 'Organization',
    name: 'AI 플레이스',
    url: 'https://aiplace.kr',
  }
  const author = {
    '@type': 'Person',
    name: '이지수',
    jobTitle: 'AI Place 큐레이터',
    url: 'https://aiplace.kr',
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': opts.url,
    headline: opts.title,
    description: opts.description,
    dateModified: opts.lastUpdated,
    author,
    publisher: org,
    mainEntityOfPage: opts.url,
  }
}

/** WebSite schema — 메인 페이지용 */
export function generateWebSite(baseUrl: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${baseUrl}/#website`,
    name: 'AI Place',
    url: baseUrl,
    description: 'AI가 추천하는 로컬 업체 디렉토리',
  }
}

/** WebPage schema — E-E-A-T author/publisher 래퍼 */
export function generateWebPage(opts: {
  url: string
  name: string
  description: string
  lastUpdated?: string
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': opts.url,
    name: opts.name,
    description: opts.description,
    ...(opts.lastUpdated && { dateModified: opts.lastUpdated }),
    author: {
      '@type': 'Person',
      name: '이지수',
      jobTitle: 'AI Place 큐레이터',
      url: 'https://aiplace.kr',
    },
    publisher: {
      '@type': 'Organization',
      '@id': 'https://aiplace.kr/#organization',
      name: 'AI 플레이스',
      url: 'https://aiplace.kr',
    },
  }
}
