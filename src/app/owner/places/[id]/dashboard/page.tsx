// T-141/T-214/T-219 — Owner 포털 업체 대시보드.
// place-dashboard.html 디자인 이식. 실제 데이터가 있는 섹션만 구현:
//   - Hero(업체 헤더 + 2 KPI strip)
//   - AI 크롤러 접근 추이 차트 (bot_visits 기반)
//   - AI 가독성 게이지 (섹션별 completion)
//   - 부족한 정보 tasks (AEO topIssues)
//   - 크롤러가 읽은 페이지 로그 (listOwnerBotVisits)
//   - AI가 읽을 수 있는 섹션 (place 필드 파생)
// 생략: AI 경유 유입(referrer 추적 X), 유입 검색어(X), 페이지 조회 분석(X).

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { requireOwnerUser } from '@/lib/owner/auth'
import { getAdminClient } from '@/lib/supabase/admin-client'
import { loadAeoSnapshotsForPlaces } from '@/lib/owner/aeo-snapshot'
import { getOwnerDailyTrend, listOwnerBotVisits, dailyRowToChartCounts, type OwnerBotVisit } from '@/lib/owner/bot-stats'
import { calcCompletionItems, sumCompletion } from '@/lib/owner/place-completion'
import { CrawlerTrendChart } from './_components/crawler-trend-chart'
import { CitationTestButton } from './citation-test-button'
import { hasActiveSubscription, checkCitationTestRateLimit } from '@/lib/diagnostic/citation-test'
import type { FAQ, PlaceImage, Service } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface Props {
  params: Promise<{ id: string }>
}

function firstChar(name: string): string {
  const t = name.trim()
  return t.length > 0 ? Array.from(t)[0] : '·'
}

function statusChip(s: string): { text: string; cls: string } {
  if (s === 'active') return { text: '공개중', cls: 'live' }
  if (s === 'pending' || s === 'pending_review') return { text: '검수 중', cls: 'draft' }
  if (s === 'archived') return { text: '보관됨', cls: '' }
  return { text: s, cls: 'draft' }
}

function formatUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\.\s*$/, '').replace(/\.\s/, '.')
}

function relativeTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 60) return `${Math.max(1, min)}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const days = Math.floor(hr / 24)
  if (days === 1) return '어제'
  if (days < 30) return `${days}일 전`
  return d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' }).replace(/\.\s*$/, '')
}

function botBrand(botId: string, botLabel: string): { cls: 'gpt' | 'claude' | 'gemini' | 'other'; letter: string; label: string } {
  if (/gpt|oai/i.test(botId)) return { cls: 'gpt', letter: 'G', label: botLabel }
  if (/claude|anthropic/i.test(botId)) return { cls: 'claude', letter: 'C', label: botLabel }
  if (/google|gemini/i.test(botId)) return { cls: 'gemini', letter: 'G', label: botLabel }
  return { cls: 'other', letter: botLabel.charAt(0).toUpperCase(), label: botLabel }
}

export default async function OwnerPlaceDashboardPage({ params }: Props) {
  const user = await requireOwnerUser()
  const { id } = await params
  const admin = getAdminClient()
  if (!admin) return <div className="pd-page"><p className="p-6 text-red-600">DB 연결 실패</p></div>

  const { data: placeRow } = await admin
    .from('places')
    .select([
      'id, slug, name, name_en, city, category, status, updated_at,',
      'customer_id, description, address, phone, opening_hours,',
      'tags, recommended_for, strengths, services, faqs, images,',
      'naver_place_url, kakao_map_url, google_business_url,',
      'homepage_url, blog_url, instagram_url',
    ].join(' '))
    .eq('id', id)
    .maybeSingle()
  if (!placeRow) notFound()

  const place = placeRow as unknown as {
    id: string; slug: string; name: string; name_en: string | null
    city: string; category: string; status: string; updated_at: string | null
    customer_id: string | null
    description: string | null; address: string; phone: string | null
    opening_hours: string[] | null
    tags: string[] | null; recommended_for: string[] | null; strengths: string[] | null
    services: Service[] | null; faqs: FAQ[] | null; images: PlaceImage[] | null
    naver_place_url: string | null; kakao_map_url: string | null; google_business_url: string | null
    homepage_url: string | null; blog_url: string | null; instagram_url: string | null
  }

  // 소유권 검증
  if (place.customer_id) {
    const { data: customer } = await admin
      .from('customers')
      .select('user_id')
      .eq('id', place.customer_id)
      .maybeSingle()
    if (!customer || (customer as { user_id: string }).user_id !== user.id) {
      return <div className="pd-page"><p className="mx-auto max-w-2xl p-6 text-sm text-[#6a6a6a]">이 업체에 대한 권한이 없습니다.</p></div>
    }
  }

  const publicUrl = `/${place.city}/${place.category}/${place.slug}`
  const editUrl = `/owner/places/${place.id}`

  // 30일 데이터 병렬 로드
  const [aeoSnapshots, dailyTrend, recentVisits, subActive, rateLimit] = await Promise.all([
    loadAeoSnapshotsForPlaces([place.id]),
    getOwnerDailyTrend([place.id], 30),
    listOwnerBotVisits([place.id], 8, 7), // 최근 7일 · 상위 8건
    hasActiveSubscription(place.customer_id),
    checkCitationTestRateLimit(place.id),
  ])

  const snap = aeoSnapshots[0]

  // completion items (섹션별 게이지)
  const completionItems = calcCompletionItems(
    {
      placeId: place.id,
      name: place.name,
      address: place.address,
      description: place.description,
      nameEn: place.name_en,
      phone: place.phone,
      openingHours: place.opening_hours,
      tags: place.tags,
      recommendedFor: place.recommended_for,
      strengths: place.strengths,
      services: place.services,
      faqs: place.faqs,
      images: place.images,
      naverPlaceUrl: place.naver_place_url,
      kakaoMapUrl: place.kakao_map_url,
      googleBusinessUrl: place.google_business_url,
      homepageUrl: place.homepage_url,
      blogUrl: place.blog_url,
      instagramUrl: place.instagram_url,
    },
    editUrl,
  )
  const completionSum = sumCompletion(completionItems)
  const overallScore = snap?.score ?? completionSum.percent

  // chart totals — aiSearch(Perplexity/ChatGPT-User/Claude-Web) + aiTraining 모두 합산.
  // totalCrawlerHits 는 row.total(= 양쪽 버킷 합계) 을 직접 합산하여 타입 추가 시 누락 방지.
  const totals = { chatgpt: 0, claude: 0, gemini: 0, other: 0 }
  for (const row of dailyTrend) {
    const counts = dailyRowToChartCounts(row)
    totals.chatgpt += counts.chatgpt
    totals.claude  += counts.claude
    totals.gemini  += counts.gemini
    totals.other   += counts.other
  }
  const totalCrawlerHits = dailyTrend.reduce((s, r) => s + r.total, 0)

  // tasks — AEO topIssues 를 P1/P2 로 분류, 추천 gain 계산
  const tasks = buildTasks(completionItems, editUrl)

  // section exposure
  const exposure = buildExposure(place)

  const chip = statusChip(place.status)
  const updated = formatUpdated(place.updated_at)

  // Gauge ring stroke-dasharray (pathLength=100)
  const ringVal = Math.max(0, Math.min(100, overallScore))

  return (
    <div className="pd-page">
      <div className="crumbs">
        <Link href="/owner/places">내 업체</Link>
        <span className="sep">›</span>
        <span className="cur">{place.name}</span>
        <span className="sep">›</span>
        <span className="cur">대시보드</span>
      </div>

      {/* ========== HERO ========== */}
      <section className="pd-hero">
        <div className="biz-card">
          <div className="biz-row">
            <div className="biz-logo">{firstChar(place.name)}</div>
            <div className="biz-meta">
              <h1>{place.name}</h1>
              <span className="slug">
                <span className="d">aiplace.kr/{place.city}/{place.category}/</span>
                {place.slug}
              </span>
            </div>
          </div>
          <div className="biz-chips">
            <span className={`ch ${chip.cls}`}>{chip.text}</span>
            <span className="ch">{place.city} · {place.category}</span>
            {updated && <span className="ch">최근 수정 {updated}</span>}
          </div>
          <div className="biz-actions">
            {place.status === 'active' && (
              <a className="mini" href={publicUrl} target="_blank" rel="noopener noreferrer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                공개 페이지
              </a>
            )}
            <Link className="mini accent" href={editUrl}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              업체 편집
            </Link>
            <CitationTestButton
              placeId={place.id}
              subActive={subActive}
              rateAllowed={rateLimit.allowed}
              remainingHours={rateLimit.remainingHours}
              lastRunAt={rateLimit.lastRunAt}
            />
          </div>
        </div>

        <div className="hero-div"></div>

        <div className="sum">
          <div>
            <div className="sum-lbl">지난 30일</div>
            <p className="sum-lead">
              AI 크롤러가 내 페이지를 <mark>{totalCrawlerHits}회</mark> 읽었습니다.
              {snap && (
                <> 정보 완성도 <mark>{snap.score}</mark><span className="it"> / 100</span></>
              )}
            </p>
          </div>

          <div className="kpi-strip">
            <div className="k hi">
              <div className="v">{totalCrawlerHits}<span className="u">회</span></div>
              <div className="l">AI 크롤러 접근</div>
            </div>
            <div className="k">
              <div className="v">{overallScore}<span className="u">/100</span></div>
              <div className="l">정보 완성도</div>
              <div className="d flat">목표 95+</div>
            </div>
          </div>
        </div>
      </section>

      {/* ========== GRID ========== */}
      <div className="grid-12">

        {/* ---- CHART ---- */}
        <div className="pd-card c-chart">
          <CrawlerTrendChart
            rows={dailyTrend}
            totals={totals}
            periodLabel="지난 30일"
          />
        </div>

        {/* ---- GAUGE ---- */}
        <div className="pd-card c-gauge">
          <div className="chead">
            <div>
              <div className="k">AI 가독성</div>
              <h3>AI가 잘 읽을 수 있나</h3>
            </div>
            <Link className="more" href={editUrl}>편집 →</Link>
          </div>

          <div className="cg-main">
            <div className="cg-pd-ring">
              <svg viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="pdGaugeGrad" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0" stopColor="#ff5c2b" />
                    <stop offset="1" stopColor="#ffb285" />
                  </linearGradient>
                </defs>
                <circle cx="50" cy="50" r="42" className="track" />
                <circle cx="50" cy="50" r="42" className="val" pathLength={100} strokeDasharray={`${ringVal} 100`} />
              </svg>
              <div className="v">
                <div>
                  <div className="n">{overallScore}<span className="s">/100</span></div>
                  <div className="l">{overallScore >= 90 ? 'Good' : overallScore >= 70 ? 'Okay' : 'Needs work'}</div>
                </div>
              </div>
            </div>
            <div className="cg-info">
              {tasks.length > 0 ? (
                <>
                  <div className="grade"><b>{tasks.length}가지</b> 보완하면 더 완성</div>
                  <div className="pot">{tasks[0].title} 을 채우면 가장 효과가 큽니다.</div>
                </>
              ) : (
                <>
                  <div className="grade"><b>완성도 높음</b></div>
                  <div className="pot">모든 섹션이 충분히 채워져 있습니다. AI 가 내 업체를 정확히 인용할 수 있어요.</div>
                </>
              )}
            </div>
          </div>

          <div className="cg-items">
            {completionItems.map((it) => (
              <div key={it.key} className={`cg-item${it.level === 'warn' ? ' w' : it.level === 'muted' ? ' m' : ''}`}>
                <div className={`nm${it.level === 'warn' ? ' w' : it.level === 'muted' ? ' m' : ''}`}>
                  <span className="dd"></span>
                  <span className="t">{it.label}</span>
                </div>
                <div className="bar"><i style={{ width: `${(it.score / it.max) * 100}%` }}></i></div>
                <div className="sc">{it.score}/{it.max}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ---- TASKS ---- */}
        <div className="pd-card c-tasks" id="tasks">
          <div className="chead">
            <div>
              <div className="k">정보 완성도 점검 결과</div>
              <h3>내 페이지에서 <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontWeight: 400 }}>부족한 정보</span></h3>
            </div>
          </div>

          {tasks.length === 0 ? (
            <div className="ts-empty">
              <b>모든 섹션이 채워져 있습니다.</b><br />
              AI 크롤러가 내 업체를 풍부하게 참고할 수 있어요.
            </div>
          ) : (
            <div className="ts-list">
              {tasks.slice(0, 5).map((t, i) => (
                <div key={t.key} className="ts-row">
                  <span className={`prio ${t.priority}`}>{t.priority.toUpperCase()}</span>
                  <div className="body">
                    <b>{t.title}</b>
                    <span>
                      {t.description}
                      {' · '}
                      <span className="gain">정보 완성도 +{t.gain}점</span>
                    </span>
                  </div>
                  <span className="est">약 {t.minutes}분</span>
                  <Link className={`go${i === 0 ? ' accent' : ''}`} href={t.href}>
                    {i === 0 ? '지금 하기 →' : '열기'}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- CRAWLER LOG ---- */}
        <div className="pd-card c-log">
          <div className="chead">
            <div>
              <div className="k">지난 7일 · 서버 액세스 로그</div>
              <h3>크롤러가 읽은 페이지</h3>
            </div>
          </div>
          {recentVisits.length === 0 ? (
            <div className="cl-empty">
              아직 AI 크롤러가 이 페이지를 읽지 않았습니다.<br />
              IndexNow 제출 후 1–3일 경과 후 확인해 주세요.
            </div>
          ) : (
            <div className="cl-list">
              {recentVisits.map((v: OwnerBotVisit) => {
                const brand = botBrand(v.botId, v.botLabel)
                return (
                  <div key={v.id} className="cl-row">
                    <span className={`ci-logo ${brand.cls}`} title={brand.label}>{brand.letter}</span>
                    <div className="cl-body">
                      <div className="cl-path">{v.path}</div>
                      <div className="cl-meta">
                        <span>{brand.label}</span>
                        <span className="dotline"></span>
                        <span>{v.attribution === 'direct' ? '상세 페이지' : '언급 페이지'}</span>
                        <span className="dotline"></span>
                        <span>{relativeTime(v.visitedAt)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ---- SECTION EXPOSURE ---- */}
        <div className="pd-card c-sect">
          <div className="chead">
            <div>
              <div className="k">내 페이지가 AI에게 제공하는 정보</div>
              <h3>AI가 읽을 수 있는 섹션</h3>
            </div>
            <Link className="more" href={editUrl}>편집 →</Link>
          </div>
          <div className="sx-list">
            {exposure.map((e) => (
              <div key={e.key} className={`sx-row ${e.ok ? 'ok' : 'warn'}`}>
                <span className="sx-ic">{e.ok ? '✓' : '!'}</span>
                <div className="sx-main">
                  <b>{e.label}</b>
                  <span>{e.description}</span>
                </div>
                <div className="sx-meta">{e.schema}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────

interface DashTask {
  key: string
  title: string
  description: string
  gain: number      // 정보 완성도 예상 증가 점수
  minutes: number   // 예상 소요 시간
  priority: 'p1' | 'p2' | 'p3'
  href: string
}

function buildTasks(items: ReturnType<typeof calcCompletionItems>, editUrl: string): DashTask[] {
  const tasks: DashTask[] = []
  for (const it of items) {
    if (it.level === 'good') continue
    const gap = it.max - it.score
    if (gap <= 0) continue
    const percentRemaining = gap / it.max
    let priority: 'p1' | 'p2' | 'p3'
    if (percentRemaining >= 0.5) priority = 'p1'
    else if (percentRemaining >= 0.3) priority = 'p2'
    else priority = 'p3'

    tasks.push({
      key: it.key,
      title: titleFor(it.key, it.detail),
      description: it.detail ?? `${it.label} 보완 권장`,
      gain: gap,
      minutes: minutesFor(it.key),
      priority,
      href: it.href || editUrl,
    })
  }
  // 점수 gap 큰 순으로 정렬
  tasks.sort((a, b) => b.gain - a.gain)
  return tasks
}

function titleFor(key: string, detail?: string): string {
  if (detail) return detail
  const map: Record<string, string> = {
    basic: '기본 정보 보완',
    contact: '연락처·영업시간 보완',
    services: '제공 서비스 추가',
    faq: '자주 묻는 질문 작성',
    tags: '태그·추천 대상 추가',
    photos: '사진 업로드',
    links: '외부 포털 링크 연결',
  }
  return map[key] ?? '보완 필요'
}

function minutesFor(key: string): number {
  const map: Record<string, number> = {
    basic: 3, contact: 3, services: 5, faq: 6, tags: 2, photos: 4, links: 3,
  }
  return map[key] ?? 3
}

interface ExposureRow {
  key: string
  label: string
  description: string
  schema: string
  ok: boolean
}

function buildExposure(place: {
  name: string; description: string | null; phone: string | null
  opening_hours: string[] | null; services: Service[] | null; faqs: FAQ[] | null
  images: PlaceImage[] | null; tags: string[] | null
  naver_place_url: string | null; kakao_map_url: string | null; google_business_url: string | null
  homepage_url: string | null; blog_url: string | null; instagram_url: string | null
}): ExposureRow[] {
  const descLen = (place.description ?? '').trim().length
  const hoursN = (place.opening_hours ?? []).filter((s) => s.trim()).length
  const svN = (place.services ?? []).filter((s) => s.name?.trim()).length
  const svWithPrice = (place.services ?? []).filter((s) => s.priceRange?.trim()).length
  const faqN = (place.faqs ?? []).filter((f) => f.question?.trim() && f.answer?.trim()).length
  const photoN = (place.images ?? []).length
  const tagN = (place.tags ?? []).filter((t) => t.trim()).length
  const linkN = [
    place.naver_place_url, place.kakao_map_url, place.google_business_url,
    place.homepage_url, place.blog_url, place.instagram_url,
  ].filter((v) => (v ?? '').trim().length > 0).length

  return [
    {
      key: 'basic',
      label: '기본 정보',
      description: `업체명, 주소, 소개문${descLen > 0 ? ` ${descLen}자` : ' 없음'}`,
      schema: 'LocalBusiness',
      ok: descLen >= 40,
    },
    {
      key: 'contact',
      label: '연락처 · 영업시간',
      description: place.phone
        ? `전화 1개${hoursN > 0 ? `, 영업시간 ${hoursN}개 항목` : ', 영업시간 없음'}`
        : '전화 없음',
      schema: 'telephone · openingHours',
      ok: Boolean(place.phone) && hoursN >= 1,
    },
    {
      key: 'services',
      label: '제공 서비스',
      description: svN === 0 ? '등록된 서비스 없음' : `${svN}개 등록 · 가격 정보 ${svWithPrice}개`,
      schema: `Service × ${svN}`,
      ok: svN >= 3,
    },
    {
      key: 'faq',
      label: '자주 묻는 질문',
      description: faqN === 0 ? 'FAQ 없음' : `${faqN}개 등록`,
      schema: `FAQPage · Question × ${faqN}`,
      ok: faqN >= 3,
    },
    {
      key: 'photos',
      label: '사진',
      description: photoN === 0 ? '등록된 사진 없음' : `${photoN}장 등록${photoN < 8 ? ' · 권장 8장' : ''}`,
      schema: `ImageObject × ${photoN}`,
      ok: photoN >= 4,
    },
    {
      key: 'tags',
      label: '태그 · 추천 대상',
      description: tagN === 0 ? '태그 없음' : `태그 ${tagN}개 등록${tagN < 5 ? ' · 권장 5개' : ''}`,
      schema: 'keywords',
      ok: tagN >= 3,
    },
    {
      key: 'links',
      label: '외부 포털 링크',
      description: linkN === 0 ? '연결된 포털 없음' : `${linkN}개 포털 연결${linkN < 2 ? ' · 권장 2개 이상' : ''}`,
      schema: `sameAs × ${linkN}`,
      ok: linkN >= 2,
    },
  ]
}
