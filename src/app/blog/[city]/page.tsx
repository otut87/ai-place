// T-097 — /blog/[city] 도시 블로그 허브.
// 섹터별로 그룹핑 + CollectionPage/BreadcrumbList/ItemList JSON-LD.
// 블로그 글 브레드크럼의 "천안" 링크가 404 로 떨어지던 문제를 해결한다.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { getBlogPostsByCity } from '@/lib/blog/data.supabase'
import { getCities, getSectors } from '@/lib/data.supabase'
import { groupBlogPostsBySector } from '@/lib/blog/hub'
import { generateCollectionPage, generateBlogItemList } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import { clampDirectAnswer } from '@/lib/seo/direct-answer'
import { safeJsonLd } from '@/lib/utils'

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ city: string }>
}

export async function generateStaticParams() {
  const cities = await getCities()
  return cities.map(c => ({ city: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  const cities = await getCities()
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) return {}
  const title = composePageTitle(`${cityObj.name} 업체 블로그`)
  const url = `/blog/${city}`
  const description = `${cityObj.name}의 업종별 가이드·비교·추천 글 모음. AI 검색에 최적화된 로컬 비즈니스 콘텐츠.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function BlogCityHubPage({ params }: Props) {
  const { city } = await params
  if (!SLUG_PATTERN.test(city)) notFound()

  const [cities, sectors, posts] = await Promise.all([
    getCities(),
    getSectors(),
    getBlogPostsByCity(city),
  ])
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) notFound()

  const sectorGroups = groupBlogPostsBySector(posts)
  const pageUrl = `${BASE_URL}/blog/${city}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
    { name: cityObj.name, url: pageUrl },
  ]

  // Direct Answer Block (40~80자) — clampDirectAnswer 로 범위 보장
  const dab = clampDirectAnswer(
    `${cityObj.name}에 공개된 업종 가이드 ${posts.length}편입니다. 피부과·미용·음식·인테리어 등 섹터별 추천·비교 정리.`,
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(
          generateCollectionPage({
            url: pageUrl,
            name: `${cityObj.name} 블로그`,
            description: dab,
          }),
        ) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(generateBreadcrumbList(breadcrumbItems)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(
          generateBlogItemList(posts, `${cityObj.name} 블로그`, BASE_URL),
        ) }}
      />

      <Header />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-[#1a1a1a]">{cityObj.name} 업체 블로그</h1>
        <p className="mt-3 text-[#444] text-base leading-relaxed">{dab}</p>

        {sectorGroups.length === 0 ? (
          <p className="mt-10 text-[#6a6a6a]">{cityObj.name}에 공개된 블로그 글이 아직 없습니다.</p>
        ) : (
          <div className="mt-10 space-y-10">
            {sectorGroups.map(group => {
              const sec = sectors.find(s => s.slug === group.sector)
              const sectorName = sec?.name ?? group.sector
              return (
                <section key={group.sector}>
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-xl font-semibold text-[#1a1a1a]">{sectorName}</h2>
                    <Link
                      href={`/blog/${city}/${group.sector}`}
                      className="text-sm text-[#1a1a1a] underline hover:no-underline"
                    >
                      전체보기 →
                    </Link>
                  </div>
                  <ul className="mt-4 divide-y divide-[#eee]">
                    {group.posts.slice(0, 5).map(p => (
                      <li key={p.slug} className="py-3">
                        <Link
                          href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                          className="text-base text-[#1a1a1a] hover:underline"
                        >
                          {p.title}
                        </Link>
                        {p.summary ? (
                          <p className="mt-1 text-sm text-[#666] line-clamp-1">{p.summary}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}
