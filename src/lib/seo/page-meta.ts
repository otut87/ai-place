import type { Metadata } from 'next'
import type { Place } from '@/lib/types'
import { normalizeAddress } from '@/lib/format/address'
import { composePageTitle } from '@/lib/seo/compose-title'
import { formatEvidenceTitle } from '@/lib/seo/title-formula'

export const SITE_NAME = 'AI Place'
export const SITE_DESCRIPTION =
  'ChatGPT, Claude, Gemini에서 추천되는 로컬 업체를 찾아보세요. 피부과, 치과, 미용실, 인테리어 등.'

export function buildHomeMetadata(): Metadata {
  const title = `${SITE_NAME} — AI가 추천하는 우리 동네 업체`
  return {
    alternates: { canonical: '/' },
    openGraph: {
      title,
      description: SITE_DESCRIPTION,
      url: '/',
    },
  }
}

export function buildAboutMetadata(): Metadata {
  return {
    alternates: { canonical: '/about' },
    openGraph: { url: '/about' },
  }
}

interface CategoryMetaArgs {
  cityName: string
  categoryName: string
  citySlug: string
  categorySlug: string
  hasPlaces: boolean
  description: string
  /** T-110: 업체 수 (없으면 0) */
  placeCount?: number
  /** T-110: 전 업체 리뷰 합계 */
  reviewTotal?: number
}

export function buildCategoryMetadata(args: CategoryMetaArgs): Metadata {
  const { cityName, categoryName, citySlug, categorySlug, hasPlaces, description } = args
  // T-110: 제목 공식에 N곳·리뷰 M건 숫자 근거 주입 (MedicalKoreaGuide 분석)
  const title = composePageTitle(
    formatEvidenceTitle({
      cityName,
      categoryName,
      placeCount: args.placeCount ?? 0,
      reviewTotal: args.reviewTotal ?? 0,
    }),
  )
  const url = `/${citySlug}/${categorySlug}`

  const meta: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  }
  if (!hasPlaces) meta.robots = { index: false, follow: true }
  return meta
}

interface PlaceMetaArgs {
  place: Place
  cityName: string
  categoryName: string
  citySlug: string
  categorySlug: string
}

export function buildPlaceMetadata(args: PlaceMetaArgs): Metadata {
  const { place, cityName, categoryName, citySlug, categorySlug } = args
  const title = composePageTitle(`${place.name} - ${cityName} ${categoryName}`)
  const serviceList = place.services?.map((s) => s.name).filter(Boolean).join(', ') ?? ''
  const ratingPhrase = place.rating != null ? `평점 ${place.rating}점.` : ''
  const addr = normalizeAddress(place.address)
  const description = [
    `${cityName} ${categoryName} ${place.name}`,
    serviceList ? `— ${serviceList}` : '',
    addr ? `주소: ${addr}.` : '',
    ratingPhrase,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  const url = `/${citySlug}/${categorySlug}/${place.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  }
}

export function buildBlogIndexMetadata(): Metadata {
  const title = composePageTitle(`${SITE_NAME} 블로그`)
  return {
    title,
    alternates: { canonical: '/blog' },
    openGraph: { title, url: '/blog' },
  }
}

interface BlogPostMetaArgs {
  citySlug: string
  sectorSlug: string
  postSlug: string
  postTitle: string
  postSummary: string
  publishedAt?: string
}

export function buildBlogPostMetadata(args: BlogPostMetaArgs): Metadata {
  const title = composePageTitle(args.postTitle)
  const url = `/blog/${args.citySlug}/${args.sectorSlug}/${args.postSlug}`
  return {
    title,
    description: args.postSummary,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: args.postSummary,
      url,
      type: 'article',
      publishedTime: args.publishedAt,
    },
  }
}

interface GuideMetaArgs {
  cityName: string
  categoryName: string
  citySlug: string
  categorySlug: string
}

export function buildGuideMetadata(args: GuideMetaArgs): Metadata {
  const title = composePageTitle(`${args.cityName} ${args.categoryName} 가이드`)
  const url = `/guide/${args.citySlug}/${args.categorySlug}`
  return {
    title,
    alternates: { canonical: url },
    openGraph: { title, url },
  }
}

interface CompareMetaArgs extends GuideMetaArgs {
  topicSlug: string
  topicTitle: string
}

export function buildCompareMetadata(args: CompareMetaArgs): Metadata {
  const title = composePageTitle(`${args.cityName} ${args.categoryName} — ${args.topicTitle}`)
  const url = `/compare/${args.citySlug}/${args.categorySlug}/${args.topicSlug}`
  return {
    title,
    alternates: { canonical: url },
    openGraph: { title, url },
  }
}
