// /blog/[city]/[sector]/[slug] — 블로그 글 상세 (T-237 paper/orange aip 리믹스).
// 디자인 핸드오프: claude.ai/design ffiZoacTaO7FLWK_ni6n4g, blog-post.html
// 3-column shell: 좌(TOC) / 중(article) / 우(aside — 편집팀 + 언급 업체)
// JSON-LD: Article + FAQPage + BreadcrumbList + (compare 인 경우) ItemList.

import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { HomeNav } from '@/app/_components/home/home-nav'
import { SiteFooter, SITE_BRAND } from '@/components/site/site-footer'
import { BlogMarkdown } from '@/components/blog-markdown'
import { BlogViewTracker } from '@/components/blog-view-tracker'
import { SourceList } from '@/components/source-list'
import { StatisticsBox } from '@/components/statistics-box'
import { Disclaimer } from '@/components/business/disclaimer'
import {
  getBlogPost,
  getAllActiveBlogPosts,
  getBlogPostsBySector,
} from '@/lib/blog/data.supabase'
import { extractTocFromMarkdown, stripPostBoilerplate } from '@/lib/blog/markdown'
import { getCities, getSectors, getCategories, getAllPlaces } from '@/lib/data.supabase'
import { generateArticle, generateFAQPage, generateItemList } from '@/lib/jsonld'
import { generateBreadcrumbList, buildBlogBreadcrumb } from '@/lib/seo'
import { composePageTitle } from '@/lib/seo/compose-title'
import { safeJsonLd } from '@/lib/utils'
import type { Place, BlogPostSummary } from '@/lib/types'
import { BlogToc } from './_components/blog-toc'
import '@/styles/aip.css'
import '@/styles/home-wrap.css'
import '@/styles/blog-post-remix.css'

const BASE_URL = 'https://aiplace.kr'
const ASCII_SLUG_PATTERN = /^[a-z0-9-]+$/
const POST_SLUG_PATTERN = /^[a-z0-9가-힣-]+$/

interface Props {
  params: Promise<{ city: string; sector: string; slug: string }>
}

const POST_TYPE_LABEL: Record<string, string> = {
  guide: '가이드',
  compare: '비교',
  keyword: '키워드',
  detail: '디테일',
  general: '일반',
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
  const pageTitle = composePageTitle(post.title)
  return {
    title: pageTitle,
    description: post.summary,
    alternates: { canonical: url },
    openGraph: {
      title: pageTitle,
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
  if (!ASCII_SLUG_PATTERN.test(city) || !ASCII_SLUG_PATTERN.test(sector) || !POST_SLUG_PATTERN.test(slug)) {
    notFound()
  }

  const post = await getBlogPost(city, sector, slug)
  if (!post) notFound()

  // T-253 — 단일 getAllPlaces() 호출 + in-memory 필터로 N+1 제거.
  // 기존: relatedPlaceSlugs 1개당 1번 getPlaceBySlug → 글당 4번 순차 DB 호출.
  // 또한 category=null 인 경우에도 관련 업체를 찾을 수 있도록 city + slug 매칭.
  const [cities, sectors, categories, allPlaces] = await Promise.all([
    getCities(),
    getSectors(),
    getCategories(),
    getAllPlaces(),
  ])
  const cityObj = cities.find(c => c.slug === city)
  const sectorObj = sectors.find(s => s.slug === sector)
  const categoryObj = post.category ? categories.find(c => c.slug === post.category) : null

  const relatedSlugSet = new Set(post.relatedPlaceSlugs)
  const relatedPlaces: Place[] =
    relatedSlugSet.size === 0
      ? []
      : allPlaces.filter(p => p.city === city && relatedSlugSet.has(p.slug))

  // 같은 sector 의 다른 글 (자기 자신 제외, 최대 3개)
  const sameSector = await getBlogPostsBySector(city, sector)
  const relatedPosts: BlogPostSummary[] = sameSector.filter(p => p.slug !== post.slug).slice(0, 3)

  // T-253 — 본문 boilerplate strip. 파이프라인이 박은 ## 자주 묻는 질문 / ## 핵심 통계 /
  // ## 관련 업체 / **타깃 검색어** 줄을 제거 — page detail 의 별도 컴포넌트가 같은 정보를
  // canonical UI 로 이미 그리므로, 본문에 또 있으면 사용자는 같은 내용을 두 번 본다.
  const cleanedContent = stripPostBoilerplate(post.content, {
    hasFaqs: post.faqs.length > 0,
    hasStatistics: post.statistics.length > 0,
  })

  // TOC 추출 (markdown 의 h2/h3 → server-side ID 와 1:1 매칭) — strip 후 본문 기준.
  const toc = extractTocFromMarkdown(cleanedContent)

  const pageUrl = `${BASE_URL}/blog/${city}/${sector}/${slug}`
  const docId = `aip-blog-${post.slug}`
  const publishedAt = post.publishedAt?.slice(0, 10) ?? post.updatedAt.slice(0, 10)
  const updatedAt = post.updatedAt.slice(0, 10)

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
  const itemListJsonLd =
    post.postType === 'compare' && relatedPlaces.length > 0
      ? generateItemList(relatedPlaces, post.title, { baseUrl: BASE_URL })
      : null

  return (
    <div className="aip-root">
      <HomeNav />
      <BlogViewTracker slug={post.slug} />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(articleJsonLd) }} />
      {faqJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faqJsonLd) }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbJsonLd) }} />
      {itemListJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemListJsonLd) }} />
      )}

      <main>
        <div className="post-shell">
          {/* LEFT: TOC */}
          <aside className="post-aside-left" aria-label="목차">
            <div className="toc-label">목차 · CONTENTS</div>
            <BlogToc items={toc} />
            <div className="toc-foot">
              <span>{POST_TYPE_LABEL[post.postType] ?? post.postType}</span>
              <span>
                조회 {(post.viewCount ?? 0).toLocaleString()} · 갱신 {updatedAt.slice(5)}
              </span>
            </div>
          </aside>

          {/* CENTER: ARTICLE */}
          <article className="bp-post">
            {/* T-253 — breadcrumb 계층 수정: city hub + sector hub 단계 추가.
                기존엔 sector 가 /blog?sector=X 쿼리 필터로 빠지고 city hub 도 누락 →
                홈 / 블로그 / 천안 / 의료 / 글 정상 계층으로 복원. */}
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link href="/">홈</Link>
              <span className="sep">/</span>
              <Link href="/blog">블로그</Link>
              {cityObj && (
                <>
                  <span className="sep">/</span>
                  <Link href={`/blog/${city}`}>{cityObj.name}</Link>
                </>
              )}
              {sectorObj && (
                <>
                  <span className="sep">/</span>
                  <Link href={`/blog/${city}/${sector}`}>{sectorObj.name}</Link>
                </>
              )}
              <span className="sep">/</span>
              <span className="cur">{categoryObj?.name ?? post.title}</span>
            </nav>

            <div className="bp-meta-line" style={{ marginTop: 18 }}>
              <span className="type-tag">{POST_TYPE_LABEL[post.postType] ?? post.postType}</span>
              <span>
                published <b>{publishedAt}</b>
              </span>
              <span className="dot">·</span>
              <span>
                updated <b>{updatedAt}</b>
              </span>
              <span className="dot">·</span>
              <span>
                doc-id <b>{docId}</b>
              </span>
            </div>

            <h1 className="bp-title">{post.title}</h1>

            <p className="bp-lede">{post.summary}</p>

            <div className="bp-author-strip">
              <div className="ava">AP</div>
              <div className="who">
                <b>{SITE_BRAND.name} 편집팀</b>
                <span>EDITORIAL · {cityObj?.name ?? city}</span>
              </div>
              <div className="spacer" />
              <div className="stat">
                <span>
                  조회 <b>{(post.viewCount ?? 0).toLocaleString()}</b>
                </span>
              </div>
            </div>

            {/* T-253 — bp-lede(line 206)와 같은 summary 를 두 번 렌더하던 중복 제거. */}

            {/* Statistics box (있을 때만) */}
            {post.statistics.length > 0 && (
              <div style={{ margin: '0 0 28px' }}>
                <StatisticsBox
                  statistics={post.statistics}
                  sources={post.sources}
                  lastUpdated={updatedAt}
                />
              </div>
            )}

            {/* Markdown 본문 — boilerplate strip 후 본문 사용 (T-253). */}
            <div className="prose">
              <BlogMarkdown content={cleanedContent} />
            </div>

            {/* FAQ */}
            {post.faqs.length > 0 && (
              <section style={{ marginTop: 48 }}>
                <h2
                  style={{
                    fontSize: 'clamp(20px, 2.2vw, 26px)',
                    fontWeight: 700,
                    letterSpacing: '-.018em',
                    margin: '0 0 14px',
                    paddingTop: 28,
                    borderTop: '1px solid var(--line)',
                  }}
                  id="faq"
                >
                  자주 묻는 질문
                </h2>
                <div className="bp-faq">
                  {post.faqs.map((faq, idx) => (
                    <details key={idx} open={idx === 0}>
                      <summary>
                        <span>
                          <span className="q-num">Q{String(idx + 1).padStart(2, '0')}</span>
                          {faq.question}
                        </span>
                      </summary>
                      <div className="ans">{faq.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {/* Sources */}
            {post.sources.length > 0 && <SourceList sources={post.sources} />}

            <Disclaimer sector={sector} />

            {/* POST FOOT — T-253: sources 0개일 때 가짜 fallback 제거.
                "업체 직접 제공 + Google·카카오 공식 데이터" 문구가 출처 없는 글에도
                자동으로 들어가 출처가 있는 척 위장하던 버그 수정 (거짓 정보 생성 금지). */}
            <div className="bp-foot">
              <div className="src">
                {post.sources.length > 0 ? (
                  <>
                    <b>출처 ·</b> {post.sources.map(s => s.name).join(' / ')}
                    <br />
                  </>
                ) : (
                  <>
                    <b>출처 ·</b> 명시된 외부 출처 없음 — 본문은 등록된 업체 정보 기반.
                    <br />
                  </>
                )}
                <b>다음 갱신 ·</b> 14일 주기로 재검토합니다.
              </div>
            </div>
          </article>

          {/* RIGHT ASIDE */}
          <aside className="post-aside-right">
            <div className="aside-card">
              <div className="aside-author">
                <div className="ava">AP</div>
                <div>
                  <b>{SITE_BRAND.name} 편집팀</b>
                  <span>EDITORIAL · {cityObj?.name ?? city}</span>
                </div>
              </div>
              <p>
                {cityObj?.name ?? '전국'} 로컬 업체를 비교·분석한 근거형 콘텐츠를 발행합니다.
                모든 정보에 출처와 수집 날짜를 명시합니다.
              </p>
            </div>

            {relatedPlaces.length > 0 && (
              <div className="aside-card">
                <h5>이 글에서 언급된 업체</h5>
                {relatedPlaces.slice(0, 4).map(p => (
                  <Link
                    key={p.slug}
                    className="aside-biz"
                    href={`/${p.city}/${p.category}/${p.slug}`}
                  >
                    <div className="nm">{p.name}</div>
                    <div className="meta">
                      {p.address?.split(' ')[1] ?? ''} · ★ {p.rating?.toFixed(1) ?? '—'} (
                      {p.reviewCount ?? 0})
                    </div>
                    {p.tags.length > 0 && (
                      <div className="tags">
                        {p.tags.slice(0, 3).map(t => (
                          <span key={t}>{t}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>

        {/* RELATED POSTS */}
        {relatedPosts.length > 0 && (
          <section className="bp-related">
            <div className="wrap">
              <div className="related-h">
                <h2>
                  <span className="it">Related</span> · 함께 읽으면 좋은 글
                </h2>
                <div className="anchor">related</div>
              </div>
              <div className="bp-related-grid">
                {relatedPosts.map(p => (
                  <Link
                    key={p.slug}
                    className="bp-rel-card"
                    href={`/blog/${p.city}/${p.sector}/${p.slug}`}
                  >
                    <div className="top">
                      <span className={`bi-type-tag ${p.postType}`}>
                        {POST_TYPE_LABEL[p.postType] ?? p.postType}
                      </span>
                      <span className="when">{p.publishedAt?.slice(0, 10) ?? '—'}</span>
                    </div>
                    <h3>{p.title}</h3>
                    <p>{p.summary}</p>
                    <div className="stat-row">
                      <span>조회 {(p.viewCount ?? 0).toLocaleString()}</span>
                      {p.tags.length > 0 && <span>태그 {p.tags.length}개</span>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      <SiteFooter currentCity={city} currentCategory={post.category ?? undefined} currentSectorLabel={sectorObj?.name} />
    </div>
  )
}
