// 푸터 — 서버 컴포넌트, sector/city 문맥에 따라 동적 내부 링크 생성 (T-005)
// T-004 원칙과 동일: 템플릿 누수 방지 — 자동차 페이지에 피부과 링크 없음.

import Link from 'next/link'
import { getAllPlaces, getCities, getCategories, getSectorForCategory } from '@/lib/data.supabase'
import { getBlogPostsBySector, getRecentBlogPosts } from '@/lib/blog/data.supabase'
import { getSiteStats } from '@/lib/site-stats'

interface FooterProps {
  /** 현재 페이지의 도시 slug (카테고리/업체/블로그 상세에서 전달) */
  currentCity?: string
  /** 현재 페이지의 카테고리 slug */
  currentCategory?: string
  /** 현재 페이지의 sector slug (블로그 상세에서 전달) */
  currentSector?: string
}

const MAX_CATEGORY_LINKS = 5
const MAX_SERVICE_LINKS = 4

export async function Footer({ currentCity, currentCategory, currentSector }: FooterProps = {}) {
  const [stats, cities, categories, allPlaces] = await Promise.all([
    getSiteStats(),
    getCities(),
    getCategories(),
    getAllPlaces(),
  ])

  // 도시 섹션: active 도시만 (업체 1곳 이상)
  const activeCityLinks = cities.filter(c => stats.activeCities.includes(c.slug))

  // 업종 섹션: 실제 업체가 있는 카테고리만 (slug 기준 집합)
  const activeCategorySet = new Set(allPlaces.map(p => p.category))
  const activeCategoryLinks = categories
    .filter(c => activeCategorySet.has(c.slug))
    .slice(0, MAX_CATEGORY_LINKS)

  // 블로그 섹션 — sector 문맥이 있으면 그 sector, 없으면 전체 최신.
  // sector 문맥에서 매칭 0 인 경우 cross-sector 오염 방지를 위해 빈 배열 유지
  // (컴포넌트는 아래에서 "블로그 홈" 링크만 렌더).
  let sectorSlug = currentSector
  if (!sectorSlug && currentCategory) {
    const sec = await getSectorForCategory(currentCategory)
    sectorSlug = sec?.slug
  }
  const citySlug = currentCity ?? stats.activeCities[0]
  const inSectorContext = Boolean(sectorSlug && citySlug)
  const blogPosts = inSectorContext
    ? (await getBlogPostsBySector(citySlug!, sectorSlug!)).slice(0, MAX_SERVICE_LINKS)
    : (await getRecentBlogPosts(MAX_SERVICE_LINKS))

  // 도시별 대표 카테고리 (해당 도시의 첫 업체 카테고리로 이동)
  const cityToCategoryHref = (citySlugArg: string) => {
    const firstPlace = allPlaces.find(p => p.city === citySlugArg)
    return firstPlace ? `/${citySlugArg}/${firstPlace.category}` : '/'
  }

  return (
    <footer className="mt-16 bg-[#f2f2f2]">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          {/* 도시 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">도시</h3>
            <ul className="space-y-2">
              {activeCityLinks.map(city => (
                <li key={city.slug}>
                  <Link
                    href={cityToCategoryHref(city.slug)}
                    className="text-sm text-[#6a6a6a] hover:text-[#008f6b]"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 업종 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">업종</h3>
            <ul className="space-y-2">
              {activeCategoryLinks.map(cat => (
                <li key={cat.slug}>
                  <Link
                    href={`/${currentCity ?? stats.activeCities[0] ?? 'cheonan'}/${cat.slug}`}
                    className={`text-sm hover:text-[#008f6b] ${
                      cat.slug === currentCategory ? 'text-[#008f6b] font-medium' : 'text-[#6a6a6a]'
                    }`}
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 블로그 */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">블로그</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/blog" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">
                  블로그 홈
                </Link>
              </li>
              {blogPosts.map(post => (
                <li key={post.slug}>
                  <Link
                    href={`/blog/${post.city}/${post.sector}/${post.slug}`}
                    className="text-sm text-[#6a6a6a] hover:text-[#008f6b] line-clamp-1"
                  >
                    {post.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Place */}
          <div>
            <h3 className="text-sm font-semibold text-[#222222] mb-3">AI Place</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/about" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">
                  소개
                </Link>
              </li>
              <li>
                <Link href="/about/methodology" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">
                  조사 방법론
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-[#6a6a6a] hover:text-[#008f6b]">
                  업체 등록 문의
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#c1c1c1]/50 space-y-1.5">
          <p className="text-xs text-[#6a6a6a]">
            &copy; {stats.currentYear} AI Place. 기획·제작{' '}
            <a href="https://dedo.kr" target="_blank" rel="noopener noreferrer" className="hover:text-[#008f6b]">
              디두(dedo)
            </a>
          </p>
          <p className="text-[11px] text-[#6a6a6a]/70">
            사업자등록번호 742-21-00642 | 충남 천안시 서북구 쌍용11길 33 | support@dedo.kr
          </p>
        </div>
      </div>
    </footer>
  )
}
