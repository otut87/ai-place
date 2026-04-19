// /blog — 블로그 홈 (T-010c)
// 인기글 TOP 5, 최근 10개, 도시 × 대분류 섹션, CollectionPage JSON-LD.

import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Breadcrumb } from '@/components/breadcrumb'
import {
  getRecentBlogPosts,
  getPopularBlogPosts,
} from '@/lib/blog/data.supabase'
import { getCities, getSectors } from '@/lib/data.supabase'
import {
  generateCollectionPage,
  generateBlogItemList,
} from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { safeJsonLd } from '@/lib/utils'
import type { BlogPostSummary } from '@/lib/types'

const BASE_URL = 'https://aiplace.kr'

const BLOG_INDEX_TITLE = 'AI Place 블로그 — 천안 지역 업체 가이드·비교·추천'
const BLOG_INDEX_OG_TITLE = 'AI Place 블로그 — 천안 업체 가이드'

export const metadata: Metadata = {
  title: BLOG_INDEX_TITLE,
  description: 'AI Place 블로그는 천안 지역 로컬 업체의 비교, 가이드, 추천 키워드 글을 제공합니다. ChatGPT, Claude, Gemini 검색에 최적화된 콘텐츠.',
  alternates: { canonical: '/blog' },
  openGraph: {
    title: BLOG_INDEX_OG_TITLE,
    description: '천안 지역 업체 비교·가이드·추천 글 모음. AI 검색 최적화 콘텐츠.',
    url: '/blog',
    type: 'website',
  },
}

interface CitySectorGroup {
  citySlug: string
  cityName: string
  sectorGroups: Array<{
    sectorSlug: string
    sectorName: string
    posts: BlogPostSummary[]
  }>
}

function groupByCityAndSector(
  posts: BlogPostSummary[],
  cities: Array<{ slug: string; name: string }>,
  sectors: Array<{ slug: string; name: string }>,
): CitySectorGroup[] {
  const result: CitySectorGroup[] = []
  for (const city of cities) {
    const cityPosts = posts.filter(p => p.city === city.slug)
    if (cityPosts.length === 0) continue

    const sectorGroups: CitySectorGroup['sectorGroups'] = []
    for (const sec of sectors) {
      const secPosts = cityPosts.filter(p => p.sector === sec.slug)
      if (secPosts.length > 0) {
        sectorGroups.push({ sectorSlug: sec.slug, sectorName: sec.name, posts: secPosts })
      }
    }
    if (sectorGroups.length > 0) {
      result.push({ citySlug: city.slug, cityName: city.name, sectorGroups })
    }
  }
  return result
}

function PostCard({ post }: { post: BlogPostSummary }) {
  const typeLabel: Record<string, string> = {
    keyword: '키워드',
    compare: '비교',
    guide: '가이드',
    general: '일반',
  }
  return (
    <Link
      href={`/blog/${post.city}/${post.sector}/${post.slug}`}
      className="group block rounded-[16px] border border-[#e5e5e5] p-5 hover:border-[#c1c1c1] transition-colors"
    >
      <div className="flex items-center gap-2 text-xs text-[#666] mb-2">
        <span className="px-2 py-0.5 rounded-full bg-[#f2f2f2] text-[#1a1a1a] font-medium">
          {typeLabel[post.postType] ?? post.postType}
        </span>
        {post.publishedAt && (
          <time dateTime={post.publishedAt}>
            {post.publishedAt.slice(0, 10)}
          </time>
        )}
      </div>
      <h3 className="text-base font-bold text-[#1a1a1a] leading-snug group-hover:underline line-clamp-2">
        {post.title}
      </h3>
      <p className="mt-2 text-sm text-[#666] leading-relaxed line-clamp-2">
        {post.summary}
      </p>
    </Link>
  )
}

export default async function BlogHomePage() {
  const [recent, popular, cities, sectors] = await Promise.all([
    getRecentBlogPosts(10),
    getPopularBlogPosts(5),
    getCities(),
    getSectors(),
  ])

  // 도시 × 대분류 섹션 데이터 (recent 의 superset 사용)
  // 더 풍부하게 보여주기 위해 popular + recent 를 슬러그 기준으로 합침
  const seen = new Set<string>()
  const merged: BlogPostSummary[] = []
  for (const p of [...popular, ...recent]) {
    if (!seen.has(p.slug)) {
      seen.add(p.slug)
      merged.push(p)
    }
  }
  const citySectorGroups = groupByCityAndSector(merged, cities, sectors)

  // Direct Answer Block (40-60자)
  const dab = `AI Place 블로그는 천안 지역 ${recent.length}개 글로 업체 비교·가이드·추천을 제공합니다.`

  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
  ]
  const breadcrumbJsonLd = generateBreadcrumbList(breadcrumbItems)
  const itemListJsonLd = generateBlogItemList(recent, 'AI Place 최근 블로그 글', BASE_URL)
  const collectionJsonLd = generateCollectionPage({
    name: 'AI Place 블로그',
    url: `${BASE_URL}/blog`,
    description: dab,
    mainEntity: itemListJsonLd,
  })

  return (
    <>
      <Header />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(collectionJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />

      <main className="flex-1">
        {/* Hero */}
        <section className="pt-16 pb-10 px-6">
          <div className="mx-auto max-w-[1200px]">
            <Breadcrumb items={breadcrumbItems} />
            <h1 className="mt-6 text-[28px] sm:text-[36px] font-bold text-[#1a1a1a] leading-tight">
              AI Place 블로그
            </h1>
            <p className="mt-4 text-base text-[#1a1a1a] max-w-2xl">{dab}</p>
          </div>
        </section>

        {/* 인기글 TOP 5 */}
        {popular.length > 0 && (
          <section className="py-12 px-6 bg-[#f9f9f9]">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[22px] font-bold text-[#1a1a1a]">인기글</h2>
              <p className="mt-1 text-sm text-[#666]">조회수 기준 TOP {popular.length}</p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {popular.map(post => <PostCard key={post.slug} post={post} />)}
              </div>
            </div>
          </section>
        )}

        {/* 도시 × 대분류 섹션 */}
        {citySectorGroups.map(group => (
          <section key={group.citySlug} className="py-12 px-6">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[22px] font-bold text-[#1a1a1a]">{group.cityName}</h2>
              {group.sectorGroups.map(sec => (
                <div key={sec.sectorSlug} className="mt-8">
                  <h3 className="text-[18px] font-semibold text-[#1a1a1a]">{sec.sectorName}</h3>
                  <p className="mt-1 text-sm text-[#666]">{sec.posts.length}개 글</p>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sec.posts.map(post => <PostCard key={post.slug} post={post} />)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* 최근 작성 (도시 섹션이 비어있을 때 fallback) */}
        {citySectorGroups.length === 0 && recent.length > 0 && (
          <section className="py-12 px-6">
            <div className="mx-auto max-w-[1200px]">
              <h2 className="text-[22px] font-bold text-[#1a1a1a]">최근 글</h2>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {recent.map(post => <PostCard key={post.slug} post={post} />)}
              </div>
            </div>
          </section>
        )}

        {/* Empty state */}
        {recent.length === 0 && (
          <section className="py-20 px-6">
            <div className="mx-auto max-w-[1200px] text-center">
              <p className="text-[#666]">등록된 블로그 글이 아직 없습니다.</p>
            </div>
          </section>
        )}
      </main>

      <Footer />
    </>
  )
}
