// /directory — 전체 도시·업종 탐색 허브.
// 홈/푸터에서 "전체 디렉토리 보기" 링크 대상. 이전엔 404 였음.

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCities, getCategories, getSectors, getAllPlaces } from '@/lib/data.supabase'
import { HomeNav } from '../_components/home/home-nav'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'

export const revalidate = 3600

const BASE_URL = 'https://aiplace.kr'

export const metadata: Metadata = {
  title: '전체 디렉토리 — AI Place',
  description:
    '천안 지역의 모든 업종과 업체를 한눈에. 의료·뷰티·생활·자동차·외식 등 10개 대분류 · 83개 업종.',
  alternates: {
    canonical: '/directory',
    languages: {
      'ko-KR': BASE_URL + '/directory',
      'x-default': BASE_URL + '/directory',
    },
  },
  openGraph: {
    type: 'website',
    url: BASE_URL + '/directory',
    siteName: 'AI Place',
    locale: 'ko_KR',
    title: '전체 디렉토리 — AI Place',
    description: '천안 지역의 모든 업종·업체를 한눈에.',
  },
}

export default async function DirectoryPage() {
  const [cities, sectors, categories, places] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
  ])

  // 업종별 등록 업체 수 집계
  const countByCategory = new Map<string, number>()
  for (const p of places) {
    countByCategory.set(p.category, (countByCategory.get(p.category) ?? 0) + 1)
  }
  // 대분류별 카테고리 그룹화
  const bySector = sectors.map(s => ({
    sector: s,
    categories: categories.filter(c => c.sector === s.slug),
  }))

  const defaultCity = cities[0]?.slug ?? 'cheonan'

  return (
    <div className="aip-root">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap"
      />

      <HomeNav />

      <main>
        {/* HERO */}
        <header className="page-head">
          <div className="wrap">
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <span className="cur">디렉토리</span>
            </nav>
            <h1>전체 디렉토리</h1>
            <p className="lede">
              천안 지역 {sectors.length}개 대분류 · {categories.length}개 업종 · {places.length}개 업체.
              원하는 업종을 선택하면 AI 가 추천하는 업체 리스트로 이동합니다.
            </p>
            <div className="meta-row">
              <span>
                <b>도시</b> · {cities.map(c => c.name).join(' · ')}
              </span>
              <span>
                <b>기준</b> ·{' '}
                <time dateTime={new Date().toISOString().slice(0, 10)}>
                  {new Date().toISOString().slice(0, 10)}
                </time>
              </span>
            </div>
          </div>
        </header>

        {/* CITIES */}
        <section>
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-kicker">도시 · CITIES</div>
              <h2 className="sec-title">지역을 선택하세요</h2>
              <p className="sec-lede">현재 천안 파일럿 운영 중 · 충청권부터 순차 확장 예정.</p>
            </div>
            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12,
              }}
            >
              {cities.map(c => (
                <Link
                  key={c.slug}
                  href={`/${c.slug}/dermatology`}
                  className="card hover"
                  style={{ textDecoration: 'none' }}
                >
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}>
                    {c.nameEn}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{c.name}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* SECTORS & CATEGORIES */}
        <section style={{ background: 'var(--bg-2)' }}>
          <div className="wrap">
            <div className="sec-head">
              <div className="sec-kicker">업종 · SECTORS</div>
              <h2 className="sec-title">
                10개 대분류 · <span className="it">{categories.length}개 업종</span>
              </h2>
              <p className="sec-lede">
                각 업종 페이지에서 AI 가 추천하는 업체 리스트와 비교표를 확인할 수 있습니다.
              </p>
            </div>

            <div
              className="grid"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 20,
              }}
            >
              {bySector.map(({ sector, categories: cats }) => (
                <div key={sector.slug} className="card">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: 12,
                    }}
                  >
                    <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-.02em' }}>
                      {sector.name}
                    </h3>
                    <span
                      style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--muted)' }}
                    >
                      {sector.nameEn} · {cats.length}개
                    </span>
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 0,
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}
                  >
                    {cats.map(cat => {
                      const cnt = countByCategory.get(cat.slug) ?? 0
                      return (
                        <li key={cat.slug}>
                          <Link
                            href={`/${defaultCity}/${cat.slug}`}
                            className="chip"
                            style={{
                              textDecoration: 'none',
                              padding: '6px 12px',
                              fontSize: '12.5px',
                              background: cnt > 0 ? 'var(--accent-soft)' : 'var(--bg-2)',
                              borderColor:
                                cnt > 0
                                  ? 'color-mix(in oklab, var(--accent) 40%, transparent)'
                                  : 'var(--line)',
                              color: cnt > 0 ? '#9a2c00' : 'var(--ink-2)',
                            }}
                          >
                            {cat.name}
                            {cnt > 0 && (
                              <span style={{ opacity: 0.7, marginLeft: 4 }}>· {cnt}</span>
                            )}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section>
          <div className="wrap">
            <div className="card" style={{ textAlign: 'center', padding: 'clamp(32px, 5vw, 56px)' }}>
              <h2
                className="sec-title"
                style={{ margin: '0 auto 12px', maxWidth: 'none' }}
              >
                찾는 업종이 없으신가요?
              </h2>
              <p className="sec-lede" style={{ margin: '0 auto 24px', maxWidth: '52ch' }}>
                내 업체를 직접 등록하면 해당 업종 페이지가 자동으로 생성됩니다.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href="/owner/places/new" className="btn primary lg">
                  무료로 업체 등록
                </Link>
                <Link href="/check" className="btn ghost lg">
                  내 업체 AI 점수 진단
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="site">
        <div className="wrap">
          <div className="cols">
            <div className="brand-col">
              <Link className="logo" href="/">
                <span className="mark" /> AI Place
              </Link>
              <p>천안 파일럿 · AI 검색 최적화 디렉토리.</p>
            </div>
            <div>
              <h5>서비스</h5>
              <ul>
                <li><Link href="/owner/places/new">업체 등록</Link></li>
                <li><Link href="/pricing">가격·플랜</Link></li>
                <li><Link href="/owner">대시보드</Link></li>
              </ul>
            </div>
            <div>
              <h5>디렉토리</h5>
              <ul>
                <li><Link href="/directory">전체 디렉토리</Link></li>
                <li><Link href="/cheonan/dermatology">천안 피부과</Link></li>
                <li><Link href="/cheonan/interior">천안 인테리어</Link></li>
              </ul>
            </div>
            <div>
              <h5>콘텐츠</h5>
              <ul>
                <li><Link href="/blog">가이드 전체</Link></li>
                <li><Link href="/about/methodology">조사 방법론</Link></li>
                <li><Link href="/check">AI 진단</Link></li>
              </ul>
            </div>
            <div>
              <h5>회사</h5>
              <ul>
                <li><Link href="/about/methodology">소개</Link></li>
                <li><a href="mailto:support@dedo.kr">support@dedo.kr</a></li>
              </ul>
            </div>
          </div>
          <div className="meta">
            <span>© 2026 AI Place · 기획·제작 디두(dedo)</span>
            <span>사업자등록번호 742-21-00642 · 충남 천안시 서북구 쌍용11길 33</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
