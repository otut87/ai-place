// T-097 — /blog/[city]/[sector] 섹터 블로그 허브.
// 카테고리별 그룹핑 + CollectionPage/BreadcrumbList/ItemList JSON-LD.
// 블로그 글 브레드크럼의 섹터 링크가 404 로 떨어지던 문제를 해결한다.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Breadcrumb } from '@/components/breadcrumb'
import { getBlogPostsBySector } from '@/lib/blog/data.supabase'
import { getCities, getSectors, getCategories } from '@/lib/data.supabase'
import { groupBlogPostsByCategory } from '@/lib/blog/hub'
import { generateCollectionPage, generateBlogItemList } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import { clampDirectAnswer } from '@/lib/seo/direct-answer'
import { safeJsonLd } from '@/lib/utils'

const BASE_URL = 'https://aiplace.kr'
const SLUG_PATTERN = /^[a-z0-9-]+$/

interface Props {
  params: Promise<{ city: string; sector: string }>
}

export async function generateStaticParams() {
  const [cities, sectors] = await Promise.all([getCities(), getSectors()])
  return cities.flatMap(c => sectors.map(s => ({ city: c.slug, sector: s.slug })))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, sector } = await params
  const [cities, sectors] = await Promise.all([getCities(), getSectors()])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  if (!cityObj || !sectorObj) return {}
  const title = composePageTitle(`${cityObj.name} ${sectorObj.name} 블로그`)
  const url = `/blog/${city}/${sector}`
  const description = `${cityObj.name} ${sectorObj.name} 업종 가이드·비교·추천 글 모음. AI 검색 최적화.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function BlogSectorHubPage({ params }: Props) {
  const { city, sector } = await params
  if (!SLUG_PATTERN.test(city) || !SLUG_PATTERN.test(sector)) notFound()

  const [cities, sectors, categories, posts] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getBlogPostsBySector(city, sector),
  ])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  if (!cityObj || !sectorObj) notFound()

  const categoryGroups = groupBlogPostsByCategory(posts)
  const pageUrl = `${BASE_URL}/blog/${city}/${sector}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: '블로그', url: `${BASE_URL}/blog` },
    { name: cityObj.name, url: `${BASE_URL}/blog/${city}` },
    { name: sectorObj.name, url: pageUrl },
  ]

  const dab = clampDirectAnswer(
    `${cityObj.name} ${sectorObj.name} 카테고리 가이드 ${posts.length}편. 업종별 비교·추천·키워드 글 모음.`,
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(
          generateCollectionPage({
            url: pageUrl,
            name: `${cityObj.name} ${sectorObj.name} 블로그`,
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
          generateBlogItemList(posts, `${cityObj.name} ${sectorObj.name} 블로그`, BASE_URL),
        ) }}
      />

      <Header />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-[#1a1a1a]">
          {cityObj.name} {sectorObj.name} 블로그
        </h1>
        <p className="mt-3 text-[#444] text-base leading-relaxed">{dab}</p>

        {categoryGroups.length === 0 ? (
          <p className="mt-10 text-[#6a6a6a]">
            {cityObj.name} {sectorObj.name} 블로그 글이 아직 없습니다.
          </p>
        ) : (
          <div className="mt-10 space-y-10">
            {categoryGroups.map(group => {
              const cat = categories.find(c => c.slug === group.category)
              const catName = cat?.name ?? group.category
              return (
                <section key={group.category}>
                  <h2 className="text-xl font-semibold text-[#1a1a1a]">{catName}</h2>
                  <ul className="mt-4 divide-y divide-[#eee]">
                    {group.posts.map(p => (
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
