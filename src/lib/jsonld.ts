// AI Place — JSON-LD Structured Data Generation
// AI 크롤러가 구조적으로 읽을 수 있는 Schema.org 데이터 생성

import type { Place, FAQ, BlogPostSummary } from './types'
import { toSchemaOrgHours } from './format/hours'
import { getCategorySchemaType, getMedicalSpecialty } from './jsonld/category-schema'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonLd = Record<string, any>

export function generateLocalBusiness(place: Place, pageUrl?: string, schemaType?: string): JsonLd {
  // T-121: 83 카테고리 매핑 테이블 (SCHEMA_DATA_DICTIONARY.md §1) 을 단일 소스로.
  const resolvedType = schemaType ?? getCategorySchemaType(place.category)

  const jsonld: JsonLd = {
    '@context': 'https://schema.org',
    '@type': resolvedType,
    name: place.name,
    description: place.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: place.address,
      addressLocality: place.city,
      addressCountry: 'KR',
    },
  }

  // T-121: 의료 카테고리는 medicalSpecialty 필수 (SCHEMA_DATA_DICTIONARY §2.1)
  const medicalSpecialty = getMedicalSpecialty(place.category)
  if (medicalSpecialty) {
    jsonld.medicalSpecialty = medicalSpecialty
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
    const specs = toSchemaOrgHours(place.openingHours)
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

  // GEO 추천 로직: AI가 인식할 수 있는 구조화 데이터
  // knowsAbout: LocalBusiness→Organization 상속. Google Rich Results 미인식, AI 크롤러용.
  if (place.strengths && place.strengths.length > 0) {
    jsonld.knowsAbout = place.strengths
  }
  if (place.recommendedFor && place.recommendedFor.length > 0) {
    jsonld.additionalProperty = place.recommendedFor.map(r => ({
      '@type': 'PropertyValue',
      name: '추천 대상',
      value: r,
    }))
  }

  const sameAs: string[] = []
  if (place.naverPlaceUrl) sameAs.push(place.naverPlaceUrl)
  if (place.kakaoMapUrl) sameAs.push(place.kakaoMapUrl)
  if (place.googleBusinessUrl) sameAs.push(place.googleBusinessUrl)
  if (sameAs.length > 0) {
    jsonld.sameAs = sameAs
  }

  return jsonld
}

export function generateItemList(
  places: Place[],
  title: string,
  opts: { baseUrl?: string } = {},
): JsonLd {
  const baseUrl = opts.baseUrl ?? 'https://aiplace.kr'
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: places.length,
    itemListElement: places.map((place, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
      item: {
        '@type': getCategorySchemaType(place.category),
        '@id': `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
        name: place.name,
        description: place.description,
        address: place.address,
        url: `${baseUrl}/${place.city}/${place.category}/${place.slug}`,
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
    url: 'https://aiplace.kr/about',
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': opts.url,
    headline: opts.title,
    description: opts.description,
    datePublished: opts.lastUpdated,
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

/** Person schema — /about 페이지 저자 프로필 (E-E-A-T) */
export function generatePerson(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': 'https://aiplace.kr/about#person',
    name: '이지수',
    jobTitle: 'AI Place 큐레이터',
    description: '천안 지역 로컬 업체의 AI 검색 노출을 돕고 있습니다.',
    url: 'https://aiplace.kr/about',
    worksFor: {
      '@type': 'Organization',
      '@id': 'https://aiplace.kr/#organization',
      name: 'AI 플레이스',
      url: 'https://aiplace.kr',
    },
  }
}

/** ProfilePage schema — /about 페이지 래퍼 */
export function generateProfilePage(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': 'https://aiplace.kr/about',
    name: 'AI Place 소개 — 이지수 큐레이터',
    description: 'AI Place는 ChatGPT, Claude, Gemini에서 추천되는 로컬 업체 디렉토리입니다. 큐레이터 이지수가 천안 지역 업체의 AI 검색 노출을 돕고 있습니다.',
    dateModified: new Date().toISOString().slice(0, 10),
    mainEntity: { '@id': 'https://aiplace.kr/about#person' },
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

// --- 블로그 (T-010c, T-010d) ---

/**
 * BlogPostSummary 배열을 ItemList JSON-LD 로 변환.
 * /blog 홈, 사이드바 추천, 도시별 섹션에 사용.
 */
export function generateBlogItemList(
  posts: BlogPostSummary[],
  title: string,
  baseUrl: string,
): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: title,
    numberOfItems: posts.length,
    itemListElement: posts.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Article',
        '@id': `${baseUrl}/blog/${p.city}/${p.sector}/${p.slug}`,
        url: `${baseUrl}/blog/${p.city}/${p.sector}/${p.slug}`,
        headline: p.title,
        description: p.summary,
        datePublished: p.publishedAt ?? undefined,
      },
    })),
  }
}

/**
 * /blog 홈용 CollectionPage JSON-LD.
 * mainEntity 로 ItemList 등 자식 schema 를 받을 수 있음.
 */
export function generateCollectionPage(opts: {
  name: string
  url: string
  description: string
  mainEntity?: JsonLd
}): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': opts.url,
    name: opts.name,
    url: opts.url,
    description: opts.description,
    publisher: {
      '@type': 'Organization',
      '@id': 'https://aiplace.kr/#organization',
      name: 'AI 플레이스',
      url: 'https://aiplace.kr',
    },
    ...(opts.mainEntity && { mainEntity: opts.mainEntity }),
  }
}
