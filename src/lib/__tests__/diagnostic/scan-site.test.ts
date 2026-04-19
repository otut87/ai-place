// T-137 v2 — AI 검색 인용 진단 테스트.
// docs/GEO-SEO-AEO-딥리서치.md 기반 재설계 검증 (GEO 핵심 레버 포함).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanSite } from '@/lib/diagnostic/scan-site'

const RECENT_ISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

const MOCK_HTML_EXCELLENT = `
<!DOCTYPE html><html lang="ko"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>천안 피부과 — 닥터스킨 클리닉 공식 홈페이지 안내</title>
<meta name="description" content="천안 서북구 불당동에 위치한 닥터스킨 피부과 전문 클리닉. 여드름, 레이저, 모공 관리 등 다양한 시술을 제공합니다. 평일 9시~18시 진료.">
<meta property="og:title" content="닥터스킨 클리닉">
<script type="application/ld+json">
[
  {
    "@context": "https://schema.org", "@type": "MedicalClinic",
    "name": "닥터스킨 클리닉",
    "address": { "@type": "PostalAddress", "streetAddress": "천안시 서북구" },
    "telephone": "+82-41-000-0000",
    "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification" }],
    "dateModified": "${RECENT_ISO}",
    "sameAs": ["https://place.map.naver.com/123", "https://place.map.kakao.com/123", "https://g.page/drskin"],
    "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.7, "reviewCount": 124 },
    "review": [{ "@type": "Review", "author": {"@type": "Person", "name": "홍길동"}, "reviewRating": {"@type": "Rating", "ratingValue": 5} }]
  },
  {
    "@context": "https://schema.org", "@type": "FAQPage",
    "mainEntity": [
      {"@type": "Question", "name": "진료 시간은?", "acceptedAnswer": {"@type": "Answer", "text": "평일 9~18시, 토 9~13시"}},
      {"@type": "Question", "name": "주차 가능한가요?", "acceptedAnswer": {"@type": "Answer", "text": "지하 10대 무료"}},
      {"@type": "Question", "name": "예약 필요한가요?", "acceptedAnswer": {"@type": "Answer", "text": "전화 예약 권장"}},
      {"@type": "Question", "name": "주말 진료?", "acceptedAnswer": {"@type": "Answer", "text": "토요일 오전만"}},
      {"@type": "Question", "name": "위치는?", "acceptedAnswer": {"@type": "Answer", "text": "서북구 불당동"}}
    ]
  }
]
</script>
</head><body>
<h1>닥터스킨 클리닉</h1>
<h2>천안에서 여드름 치료 비용은 얼마인가요?</h2>
<p>천안 지역 여드름 치료 비용은 1회 8만원~15만원이며 레이저 유형과 병변 상태에 따라 달라집니다.</p>
<h2>진료 시간 안내</h2>
<p>닥터스킨 클리닉은 평일 오전 9시부터 오후 6시까지, 토요일은 오전 9시부터 오후 1시까지 진료합니다.</p>
</body></html>
`

const MOCK_HTML_BAD = `
<!DOCTYPE html><html><head><title>Short</title></head><body></body></html>
`

beforeEach(() => { vi.restoreAllMocks() })

function mockFetch(htmlBody: string, opts: { robots?: string; sitemapOk?: boolean; llmsOk?: boolean } = {}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = url.toString()
    if (u.endsWith('/robots.txt')) {
      return new Response(opts.robots ?? '', { status: opts.robots ? 200 : 404 }) as unknown as Response
    }
    if (u.endsWith('/sitemap.xml')) {
      return new Response('<?xml version="1.0"?>', { status: opts.sitemapOk ? 200 : 404 }) as unknown as Response
    }
    if (u.endsWith('/llms.txt')) {
      return new Response('# llms', { status: opts.llmsOk ? 200 : 404 }) as unknown as Response
    }
    return new Response(htmlBody, { status: 200 }) as unknown as Response
  }))
}

describe('T-137 v2 scanSite (GEO 재설계)', () => {
  it('완전한 사이트 → 높은 점수 (80+) 및 GEO 핵심 모두 pass', async () => {
    mockFetch(MOCK_HTML_EXCELLENT, { robots: 'User-agent: *\nAllow: /\n', sitemapOk: true, llmsOk: true })
    const r = await scanSite('https://example.com')
    expect(r.error).toBeUndefined()
    expect(r.score).toBeGreaterThan(80)
    expect(r.checks.find(c => c.id === 'jsonld_localbusiness')?.status).toBe('pass')
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('pass')
    expect(r.checks.find(c => c.id === 'review_schema')?.status).toBe('pass')
    expect(r.checks.find(c => c.id === 'sameas_entity_linking')?.status).toBe('pass')
    expect(r.checks.find(c => c.id === 'last_updated')?.status).toBe('pass')
  })

  it('최소 HTML → 낮은 점수 + GEO 핵심 모두 fail', async () => {
    mockFetch(MOCK_HTML_BAD)
    const r = await scanSite('https://example.com')
    expect(r.score).toBeLessThan(30)
    expect(r.checks.find(c => c.id === 'jsonld_localbusiness')?.status).toBe('fail')
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('fail')
    expect(r.checks.find(c => c.id === 'direct_answer_block')?.status).toBe('fail')
  })

  it('HTTP 프로토콜 → https 체크 fail', async () => {
    mockFetch(MOCK_HTML_EXCELLENT)
    const r = await scanSite('http://example.com')
    expect(r.checks.find(c => c.id === 'https')?.status).toBe('fail')
  })

  it('URL 형식 오류 → error 필드', async () => {
    const r = await scanSite('not a url!!!')
    expect(r.error).toBeTruthy()
    expect(r.checks).toHaveLength(0)
  })

  it('GPTBot Disallow → robots 체크 fail', async () => {
    const robots = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n`
    mockFetch(MOCK_HTML_EXCELLENT, { robots, sitemapOk: true, llmsOk: true })
    const r = await scanSite('https://example.com')
    const robotsCheck = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(robotsCheck.status).toBe('fail')
    expect(robotsCheck.detail).toContain('GPTBot')
  })

  it('전체 크롤러 차단 → robots 0점', async () => {
    mockFetch(MOCK_HTML_EXCELLENT, { robots: 'User-agent: *\nDisallow: /\n' })
    const r = await scanSite('https://example.com')
    const robotsCheck = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(robotsCheck.status).toBe('fail')
    expect(robotsCheck.points).toBe(0)
  })

  it('점수 범위 0~100', async () => {
    mockFetch(MOCK_HTML_EXCELLENT, { robots: 'User-agent: *\nAllow: /\n', sitemapOk: true, llmsOk: true })
    const r = await scanSite('https://example.com')
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('13개 체크 항목 반환 (GEO4 + AEO3 + SEO6)', async () => {
    mockFetch(MOCK_HTML_EXCELLENT)
    const r = await scanSite('https://example.com')
    expect(r.checks).toHaveLength(13)
    const ids = r.checks.map(c => c.id).sort()
    expect(ids).toEqual([
      'direct_answer_block', 'faq_schema', 'https', 'jsonld_localbusiness',
      'last_updated', 'llms_txt', 'meta_description', 'review_schema',
      'robots_ai_allow', 'sameas_entity_linking', 'sitemap', 'title', 'viewport',
    ])
  })

  it('카테고리 분류 (geo/aeo/seo) 정상', async () => {
    mockFetch(MOCK_HTML_EXCELLENT)
    const r = await scanSite('https://example.com')
    const geo = r.checks.filter(c => c.category === 'geo').map(c => c.id)
    const aeo = r.checks.filter(c => c.category === 'aeo').map(c => c.id)
    const seo = r.checks.filter(c => c.category === 'seo').map(c => c.id)
    expect(geo).toHaveLength(4)
    expect(aeo).toHaveLength(3)
    expect(seo).toHaveLength(6)
    expect(geo).toContain('faq_schema')
    expect(aeo).toContain('direct_answer_block')
  })

  it('LocalBusiness 일반 타입 → warn (subtype 권장)', async () => {
    const generic = MOCK_HTML_EXCELLENT.replace('"MedicalClinic"', '"LocalBusiness"')
    mockFetch(generic, { robots: 'User-agent: *\nAllow: /\n', sitemapOk: true, llmsOk: true })
    const r = await scanSite('https://example.com')
    const lb = r.checks.find(c => c.id === 'jsonld_localbusiness')!
    expect(lb.status).toBe('warn')
    expect(lb.detail).toContain('구체화')
  })

  it('FAQ 3개 → warn (5개 권장)', async () => {
    const reduced = MOCK_HTML_EXCELLENT.replace(
      /"mainEntity":\s*\[[\s\S]*?\]/,
      '"mainEntity": [{"@type":"Question","name":"Q1","acceptedAnswer":{"@type":"Answer","text":"A"}},{"@type":"Question","name":"Q2","acceptedAnswer":{"@type":"Answer","text":"A"}},{"@type":"Question","name":"Q3","acceptedAnswer":{"@type":"Answer","text":"A"}}]',
    )
    mockFetch(reduced, { robots: 'User-agent: *\nAllow: /\n' })
    const r = await scanSite('https://example.com')
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('warn')
  })

  it('오래된 dateModified (400일 전) → warn 감점', async () => {
    const oldIso = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString()
    const stale = MOCK_HTML_EXCELLENT.replace(RECENT_ISO, oldIso)
    mockFetch(stale, { robots: 'User-agent: *\nAllow: /\n' })
    const r = await scanSite('https://example.com')
    const lu = r.checks.find(c => c.id === 'last_updated')!
    expect(lu.status).toBe('warn')
    expect(lu.detail).toContain('1년')
  })
})
