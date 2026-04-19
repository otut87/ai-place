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
  // title: 표시폭 30~70 유지를 위해 "업체" 접미어 고정. "{업체명} — {도시} {업종} 업체".
  const title = composePageTitle(`${place.name} — ${cityName} ${categoryName} 업체`)
  // description: SEO meta 권장 표시폭 80~180. 한글=2폭, ASCII=1폭.
  // 전략: place.description(40~60자 AEO)에 평점/브랜드 꼬리말을 더해 폭을 맞추되, 180폭 초과 시 자름.
  const core = place.description?.trim() ?? `${cityName} ${categoryName} ${place.name}`
  const ratingBit = place.rating != null ? ` 평점 ${place.rating}점.` : ''
  const tail = `${ratingBit} ${cityName} ${categoryName} 업체 · AI Place 프로필.`
  const description = clampDisplayWidth(`${core}${tail}`, 80, 180)

  const url = `/${citySlug}/${categorySlug}/${place.slug}`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url },
  }
}

/** 한글=2·ASCII=1 기준 표시폭이 [min, max] 범위에 들어가도록 조절.
 *  - max 초과면 단어 경계에서 자르기 (마지막 공백 기준).
 *  - min 미만이면 고정 패딩 문구 추가. */
function clampDisplayWidth(text: string, min: number, max: number): string {
  const widthOf = (s: string): number => {
    let w = 0
    for (const ch of s) {
      const code = ch.codePointAt(0) ?? 0
      w += (
        (code >= 0xAC00 && code <= 0xD7A3) ||
        (code >= 0x4E00 && code <= 0x9FFF) ||
        (code >= 0x3040 && code <= 0x30FF)
      ) ? 2 : 1
    }
    return w
  }
  let out = text
  if (widthOf(out) > max) {
    // max 까지 자르기 — 단어 단위 근사.
    while (widthOf(out) > max && out.length > 0) {
      out = out.slice(0, -1)
    }
    // 마지막 공백까지 되돌려 부분 단어 방지.
    const lastSpace = out.lastIndexOf(' ')
    if (lastSpace > 0 && widthOf(out.slice(0, lastSpace)) >= min) out = out.slice(0, lastSpace)
    out += '…'
  }
  if (widthOf(out) < min) {
    out += ' AI 검색 최적화 프로필.'
  }
  return out
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
