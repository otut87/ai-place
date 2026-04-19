// T-097 — /[city] 도시 허브 (대분류별 카테고리 네비).
// 업체 상세 브레드크럼의 도시 링크(/cheonan)가 404 로 떨어지던 문제를 해결한다.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Breadcrumb } from '@/components/breadcrumb'
import {
  getCities,
  getSectors,
  getCategories,
  getAllPlaces,
} from '@/lib/data.supabase'
import { generateCollectionPage } from '@/lib/jsonld'
import { generateBreadcrumbList } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
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
  const title = composePageTitle(`${cityObj.name} 로컬 업체 허브`)
  const url = `/${city}`
  const description = `${cityObj.name}의 업종별 로컬 업체를 AI 추천과 리뷰로 한눈에. 의료·뷰티·음식·교육·전문서비스 등.`
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: 'website' },
  }
}

export default async function CityHubPage({ params }: Props) {
  const { city } = await params
  if (!SLUG_PATTERN.test(city)) notFound()

  const [cities, sectors, categories, places] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
  ])
  const cityObj = cities.find(c => c.slug === city)
  if (!cityObj) notFound()

  // 업체가 실제 등록된 카테고리만 활성 표시
  const cityPlaces = places.filter(p => p.city === city)
  const activeCategoryKeys = new Set(cityPlaces.map(p => p.category))
  const countsByCategory = new Map<string, number>()
  for (const p of cityPlaces) {
    countsByCategory.set(p.category, (countsByCategory.get(p.category) ?? 0) + 1)
  }

  const pageUrl = `${BASE_URL}/${city}`
  const breadcrumbItems = [
    { name: '홈', url: BASE_URL },
    { name: cityObj.name, url: pageUrl },
  ]

  const dab = `${cityObj.name}의 AI 추천 업체 ${cityPlaces.length}곳을 업종별로 모았습니다. 의료·뷰티·음식·교육·자동차 등.`.slice(0, 80)

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(
          generateCollectionPage({
            url: pageUrl,
            name: `${cityObj.name} 업체 허브`,
            description: dab,
          }),
        ) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(generateBreadcrumbList(breadcrumbItems)) }}
      />

      <Header />
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Breadcrumb items={breadcrumbItems} />

        <h1 className="mt-6 text-3xl font-bold text-[#1a1a1a]">{cityObj.name}</h1>
        <p className="mt-3 text-[#444] text-base leading-relaxed">{dab}</p>

        <div className="mt-10 space-y-10">
          {sectors.map(sec => {
            const sectorCats = categories.filter(
              c => c.sector === sec.slug && activeCategoryKeys.has(c.slug),
            )
            if (sectorCats.length === 0) return null
            return (
              <section key={sec.slug}>
                <h2 className="text-xl font-semibold text-[#1a1a1a]">{sec.name}</h2>
                <ul className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {sectorCats.map(cat => (
                    <li key={cat.slug}>
                      <Link
                        href={`/${city}/${cat.slug}`}
                        className="block rounded-lg border border-[#eee] px-3 py-2 text-sm hover:bg-[#f7f7f7]"
                      >
                        {cat.name}
                        <span className="ml-2 text-xs text-[#888]">
                          {countsByCategory.get(cat.slug) ?? 0}곳
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        <div className="mt-12 rounded-xl border border-[#eee] bg-[#fafafa] p-5">
          <h3 className="text-base font-semibold text-[#1a1a1a]">블로그</h3>
          <p className="mt-2 text-sm text-[#666]">
            {cityObj.name}의 업종별 가이드·비교·추천 글을 모아 보세요.
          </p>
          <Link
            href={`/blog/${city}`}
            className="mt-3 inline-flex items-center text-sm text-[#1a1a1a] underline hover:no-underline"
          >
            {cityObj.name} 블로그 보기 →
          </Link>
        </div>
      </main>
      <Footer />
    </>
  )
}
