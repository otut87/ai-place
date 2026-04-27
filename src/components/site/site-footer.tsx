// AI Place — 공개 페이지 paper/orange aip footer (server component).
// 회사 식별자(사업자번호·주소·이메일·로고)는 단일 소스로 고정,
// 디렉토리 컬럼은 활성 도시·카테고리에서 자동 생성.
//
// 사용처: src/app/page.tsx, /directory, /[city]/[category] 등
//   페이지별로 인라인 footer 작성 금지 — 항상 이 컴포넌트 사용.

import Link from 'next/link'
import { getCities, getCategories, getAllPlaces } from '@/lib/data.supabase'

export interface SiteFooterProps {
  /** 현재 페이지 컨텍스트의 도시 slug — 디렉토리 컬럼 우선순위에 사용 */
  currentCity?: string
  /** 현재 페이지 컨텍스트의 카테고리 slug */
  currentCategory?: string
  /** 현재 페이지 컨텍스트의 sector 라벨 (이미 알고 있는 경우) */
  currentSectorLabel?: string
}

/** 회사 단일 소스 — 변경 시 이 한 곳만 수정 */
export const SITE_BRAND = {
  name: 'AI Place',
  tagline: 'AI 검색에서 추천되는 로컬 업체 디렉토리.',
  email: 'support@dedo.kr',
  bizRegNo: '742-21-00642',
  address: '충남 천안시 서북구 쌍용11길 33',
  publisher: '디두(dedo)',
} as const

export async function SiteFooter({
  currentCity,
  currentCategory,
  currentSectorLabel,
}: SiteFooterProps) {
  const [cities, categories, places] = await Promise.all([
    getCities(),
    getCategories(),
    getAllPlaces(),
  ])

  const activeCategorySet = new Set(places.map(p => p.category))
  const activeCitySet = new Set(places.map(p => p.city))

  // 디렉토리 컬럼: 현재 도시 우선 + 등록 업체 많은 카테고리 상위 3개
  const targetCity =
    currentCity && activeCitySet.has(currentCity)
      ? currentCity
      : ([...activeCitySet][0] ?? cities[0]?.slug ?? 'cheonan')
  const targetCityName = cities.find(c => c.slug === targetCity)?.name ?? targetCity

  const countByCategory = new Map<string, number>()
  for (const p of places.filter(pl => pl.city === targetCity)) {
    countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1)
  }
  const directoryLinks = [...activeCategorySet]
    .filter(slug => countByCategory.has(slug))
    .map(slug => ({ slug, count: countByCategory.get(slug) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
    .map(({ slug }) => {
      const cat = categories.find(c => c.slug === slug)
      return {
        href: `/${targetCity}/${slug}`,
        label: `${targetCityName} ${cat?.name ?? slug}`,
      }
    })

  const year = new Date().getFullYear()

  return (
    <footer className="site">
      <div className="wrap">
        <div className="cols">
          <div className="brand-col">
            <Link className="logo" href="/">
              <span className="mark" /> {SITE_BRAND.name}
            </Link>
            <p>{SITE_BRAND.tagline}</p>
            {currentSectorLabel && (
              <p style={{ marginTop: 6, fontSize: 12, color: 'var(--aip-muted)' }}>
                현재 페이지: {currentSectorLabel}
              </p>
            )}
          </div>

          <div>
            <h5>서비스</h5>
            <ul>
              <li><Link href="/owner/places/new">업체 등록</Link></li>
              <li><Link href="/pricing">가격·플랜</Link></li>
              <li><Link href="/owner">대시보드</Link></li>
              <li><Link href="/check">AI 진단</Link></li>
            </ul>
          </div>

          <div>
            <h5>디렉토리</h5>
            <ul>
              <li><Link href="/directory">전체 디렉토리</Link></li>
              {directoryLinks.length > 0 ? (
                directoryLinks.map(l => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      aria-current={
                        currentCity &&
                        currentCategory &&
                        l.href === `/${currentCity}/${currentCategory}`
                          ? 'page'
                          : undefined
                      }
                    >
                      {l.label}
                    </Link>
                  </li>
                ))
              ) : (
                <li>
                  <span style={{ color: 'var(--aip-muted)' }}>모집 중</span>
                </li>
              )}
            </ul>
          </div>

          <div>
            <h5>콘텐츠</h5>
            <ul>
              <li><Link href="/blog">가이드 전체</Link></li>
              <li><Link href="/about/methodology">조사 방법론</Link></li>
              <li><Link href="/about">서비스 소개</Link></li>
            </ul>
          </div>

          <div>
            <h5>회사</h5>
            <ul>
              <li><Link href="/about">소개</Link></li>
              <li><Link href="/privacy">개인정보처리방침</Link></li>
              <li><Link href="/terms">이용약관</Link></li>
              <li><a href={`mailto:${SITE_BRAND.email}`}>{SITE_BRAND.email}</a></li>
            </ul>
          </div>
        </div>

        <div className="meta">
          <span>
            © {year} {SITE_BRAND.name} · 기획·제작 {SITE_BRAND.publisher}
          </span>
          <span>
            사업자등록번호 {SITE_BRAND.bizRegNo} · {SITE_BRAND.address}
          </span>
        </div>
      </div>
    </footer>
  )
}
