// /blog/[city]/[sector]/[slug] — 블로그 글 상세 (T-010d)
// Article + FAQPage + BreadcrumbList JSON-LD, 5단계 breadcrumb,
// markdown 본문(rehype-sanitize), view_count tracking, 관련 업체/관련 글.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { BlogMarkdown } from '@/components/blog-markdown'
import { BlogViewTracker } from '@/components/blog-view-tracker'
import { PlaceCard } from '@/components/place-card'
import { SourceList } from '@/components/source-list'
import { StatisticsBox } from '@/components/statistics-box'
import { Disclaimer } from '@/components/business/disclaimer'
import {
  getBlogPost,
  getAllActiveBlogPosts,
  getBlogPostsBySector,
} from '@/lib/blog/data.supabase'
import { getCities, getSectors, getCategories, getPlaceBySlug } from '@/lib/data.supabase'
import { generateArticle, generateFAQPage, generateItemList } from '@/lib/jsonld'
import { generateBreadcrumbList, buildBlogBreadcrumb } from '@/lib/seo'
import { safeJsonLd } from '@/lib/utils'
import type { Place, BlogPostSummary } from '@/lib/types'

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ city: string; sector: string; slug: string }>
}

export async function generateStaticParams() {
  const all = await getAllActiveBlogPosts()
  return all.map(p => ({ city: p.city, sector: p.sector, slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, sector, slug } = await params
  const post = await getBlogPost(city, sector, slug)
  if (!post) return {}
  const url = `/blog/${city}/${sector}/${slug}`
  return {
    title: `${post.title} | AI Place`,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description: post.summary,
      url,
      type: 'article',
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { city, sector, slug } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(sector) || !SLUG_PATTERN.test(slug)) notFound()

  const post = await getBlogPost(city, sector, slug)
  if (!post) notFound()

  const [cities, sectors, categories] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
  ])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  const categoryObj = post.category ? categories.find(c => c.slug === post.category) : null

  // 관련 업체 (related_place_slugs 기반)
  const relatedPlaces: Place[] = []
  if (post.relatedPlaceSlugs.length > 0 && post.category) {
    for (const placeSlug of post.relatedPlaceSlugs) {
      const place = await getPlaceBySlug(city, post.category, placeSlug)
      if (place) relatedPlaces.push(place)
    }
  }

  // 관련 블로그 글 (같은 sector, 자기 자신 제외, 최대 3개)
  const sameSector = await getBlogPostsBySector(city, sector)
  const relatedPosts: BlogPostSummary[] = sameSector
    .filter(p => p.slug !== post.slug)
    .slice(0, 3)

  const pageUrl = `${BASE_URL}/blog/${city}/${sector}/${slug}`

  // JSON-LD
  const articleJsonLd = generateArticle({
    url: pageUrl,
    title: post.title,
    description: post.summary,
    lastUpdated: post.updatedAt,
  })
  const faqJsonLd = post.faqs.length > 0 ? generateFAQPage(post.faqs) : null
  const breadcrumbItems = buildBlogBreadcrumb({
    baseUrl: BASE_URL,
    cityName: cityObj?.name ?? city,
    citySlug: city,
    sectorName: sectorObj?.name ?? sector,
    sectorSlug: sector,
    title: post.title,
    slug: post.slug,
  })
  const breadcrumbJsonLd = generateBreadcrumbList(breadcrumbItems)

  // T-031: post_type === 'compare' 이면 ItemList JSON-LD 로 비교 대상 업체 노출.
  const itemListJsonLd =
    post.postType === 'compare' && relatedPlaces.length > 0
      ? generateItemList(relatedPlaces, post.title, { baseUrl: BASE_URL })
      : null

  const typeLabel: Record<string, string> = {
    keyword: '키워드',
    compare: '비교',
    guide: '가이드',
    general: '일반',
  }

  return (
    <>
      <Header />

      <BlogViewTracker slug={post.slug} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      )}

      <main className="flex-1">
        {/* Hero */}
        <article className="pt-12 pb-16 px-6">
          <div className="mx-auto max-w-[820px]">
            <Breadcrumb items={breadcrumbItems} />

            <div className="mt-6 flex items-center gap-2 text-xs text-[#666]">
              <span className="px-2 py-0.5 rounded-full bg-[#f2f2f2] text-[#1a1a1a] font-medium">
                {typeLabel[post.postType] ?? post.postType}
              </span>
              {categoryObj && <span>{categoryObj.name}</span>}
              {post.publishedAt && (
                <time dateTime={post.publishedAt}>
                  {post.publishedAt.slice(0, 10)} 게시
                </time>
              )}
            </div>

            <h1 className="mt-4 text-[28px] sm:text-[36px] font-bold text-[#1a1a1a] leading-tight">
              {post.title}
            </h1>

            {/* Direct Answer Block */}
            <p className="mt-4 text-base text-[#1a1a1a] leading-relaxed">
              {post.summary}
            </p>

            {/* Statistics */}
            {post.statistics.length > 0 && (
              <div className="mt-8">
                <StatisticsBox
                  statistics={post.statistics}
                  sources={post.sources}
                  lastUpdated={post.updatedAt.slice(0, 10)}
                />
              </div>
            )}

            {/* Markdown 본문 */}
            <div className="mt-10">
              <BlogMarkdown content={post.content} />
            </div>

            {/* Sources */}
            {post.sources.length > 0 && (
              <SourceList sources={post.sources} />
            )}

            {/* 업종별 면책 (T-004) */}
            <Disclaimer sector={sector} />
          </div>
        </article>

        {/* 관련 업체 */}
        {relatedPlaces.length > 0 && (
          <section className="py-12 px-6 bg-[#f9f9f9]">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[22px] font-bold text-[#1a1a1a]">관련 업체</h2>
              <p className="mt-1 text-sm text-[#666]">{relatedPlaces.length}곳</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {relatedPlaces.map(place => (
                  <PlaceCard key={place.slug} place={place} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* 관련 블로그 글 (같은 sector) */}
        {relatedPosts.length > 0 && (
          <section className="py-12 px-6">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[22px] font-bold text-[#1a1a1a]">같은 분야의 다른 글</h2>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relatedPosts.map(p => (
                  <Link
                    key={p.slug}
                    href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                    className="block rounded-[16px] border border-[#e5e5e5] p-5 hover:border-[#c1c1c1] transition-colors"
                  >
                    <h3 className="text-base font-bold text-[#1a1a1a] line-clamp-2">{p.title}</h3>
                    <p className="mt-2 text-sm text-[#666] line-clamp-2">{p.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <Footer currentCity={city} currentSector={sector} currentCategory={post.category ?? undefined} />
    </>
  )
}
