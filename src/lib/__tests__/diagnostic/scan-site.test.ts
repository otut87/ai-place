// T-137 v3 — AI 검색 인용 진단 (멀티 페이지 스캔) 테스트.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanSite } from '@/lib/diagnostic/scan-site'

const RECENT_ISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

const MOCK_HOME_EXCELLENT = `
<!DOCTYPE html><html lang="ko"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>천안 피부과 — 닥터스킨 클리닉 공식 홈페이지 안내</title>
<meta name="description" content="천안 서북구 불당동에 위치한 닥터스킨 피부과 전문 클리닉. 여드름, 레이저, 모공 관리 등 다양한 시술을 제공합니다. 평일 9시~18시 진료.">
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "MedicalClinic",
  "name": "닥터스킨 클리닉",
  "address": { "@type": "PostalAddress", "streetAddress": "천안시 서북구" },
  "telephone": "+82-41-000-0000",
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification" }],
  "dateModified": "${RECENT_ISO}",
  "sameAs": ["https://place.map.naver.com/123", "https://place.map.kakao.com/123", "https://g.page/drskin"]
}
</script>
</head><body>
<h1>닥터스킨 클리닉</h1>
<h2>천안에서 여드름 치료 비용은 얼마인가요?</h2>
<p>천안 지역 여드름 치료 비용은 1회 8만원~15만원이며 레이저 유형과 병변 상태에 따라 달라집니다.</p>
<h2>진료 시간 안내</h2>
<p>닥터스킨 클리닉은 평일 오전 9시부터 오후 6시까지, 토요일은 오전 9시부터 오후 1시까지 진료합니다.</p>
</body></html>
`

// /faq 페이지에만 FAQPage schema
const MOCK_FAQ_PAGE = `
<!DOCTYPE html><html><head><title>FAQ</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "FAQPage",
  "mainEntity": [
    {"@type": "Question", "name": "진료 시간은?", "acceptedAnswer": {"@type": "Answer", "text": "평일 9~18시"}},
    {"@type": "Question", "name": "주차 가능?", "acceptedAnswer": {"@type": "Answer", "text": "지하 10대"}},
    {"@type": "Question", "name": "예약 필요?", "acceptedAnswer": {"@type": "Answer", "text": "전화 권장"}},
    {"@type": "Question", "name": "주말 진료?", "acceptedAnswer": {"@type": "Answer", "text": "토요일만"}},
    {"@type": "Question", "name": "위치는?", "acceptedAnswer": {"@type": "Answer", "text": "서북구"}}
  ]
}
</script>
</head><body></body></html>
`

// 상세 페이지에 Review schema
const MOCK_DETAIL_PAGE = `
<!DOCTYPE html><html><head><title>시술 안내</title>
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "Service",
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": 4.7, "reviewCount": 124 },
  "review": [{ "@type": "Review", "author": {"@type": "Person", "name": "홍길동"}, "reviewRating": {"@type": "Rating", "ratingValue": 5} }]
}
</script>
</head><body></body></html>
`

const MOCK_HTML_BAD = `<!DOCTYPE html><html><head><title>Short</title></head><body></body></html>`

const SITEMAP_MULTI = `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc></url>
  <url><loc>https://example.com/faq</loc></url>
  <url><loc>https://example.com/services/laser</loc></url>
</urlset>`

beforeEach(() => { vi.restoreAllMocks() })

function mockFetch(opts: {
  home?: string
  faq?: string
  detail?: string
  robots?: string
  sitemap?: string
  llmsOk?: boolean
}) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = url.toString()
    if (u.endsWith('/robots.txt')) return new Response(opts.robots ?? '', { status: opts.robots ? 200 : 404 }) as unknown as Response
    if (u.endsWith('/sitemap.xml')) return new Response(opts.sitemap ?? '', { status: opts.sitemap ? 200 : 404 }) as unknown as Response
    if (u.endsWith('/llms.txt')) return new Response('# llms', { status: opts.llmsOk ? 200 : 404 }) as unknown as Response
    if (u.endsWith('/faq')) return new Response(opts.faq ?? '', { status: opts.faq ? 200 : 404 }) as unknown as Response
    if (u.includes('/services/')) return new Response(opts.detail ?? '', { status: opts.detail ? 200 : 404 }) as unknown as Response
    return new Response(opts.home ?? '', { status: opts.home ? 200 : 404 }) as unknown as Response
  }))
}

describe('T-137 v3 scanSite (멀티 페이지)', () => {
  it('사이트맵 + /faq + 상세 → FAQ·Review 모두 pass (멀티 페이지 집계)', async () => {
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      faq: MOCK_FAQ_PAGE,
      detail: MOCK_DETAIL_PAGE,
      robots: 'User-agent: *\nAllow: /\n',
      sitemap: SITEMAP_MULTI,
      llmsOk: true,
    })
    const r = await scanSite('https://example.com')
    expect(r.error).toBeUndefined()
    expect(r.sitemapPresent).toBe(true)
    expect(r.pagesScanned).toBeGreaterThanOrEqual(2)
    // 홈에 없는 FAQ/Review 가 다른 페이지에서 pass 되어야 함
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('pass')
    expect(r.checks.find(c => c.id === 'review_schema')?.status).toBe('pass')
    expect(r.score).toBeGreaterThan(80)
  })

  it('사이트맵 없음 → 홈페이지 단독 스캔 + sitemap fail', async () => {
    mockFetch({ home: MOCK_HOME_EXCELLENT, robots: 'User-agent: *\nAllow: /\n' })
    const r = await scanSite('https://example.com')
    expect(r.sitemapPresent).toBe(false)
    expect(r.pagesScanned).toBe(1)
    const sm = r.checks.find(c => c.id === 'sitemap')!
    expect(sm.status).toBe('fail')
    expect(sm.points).toBe(0)
    expect(sm.detail).toContain('상세 페이지를 발견할 수 없습니다')
    // FAQ 는 홈에 없으므로 fail
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('fail')
  })

  it('사이트맵 있으나 URL 없음 (빈 sitemap) → 홈만 스캔 but sitemap pass', async () => {
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      sitemap: '<?xml version="1.0"?><urlset></urlset>',
      robots: 'User-agent: *\nAllow: /\n',
    })
    const r = await scanSite('https://example.com')
    expect(r.sitemapPresent).toBe(true)
    expect(r.pagesScanned).toBe(1)
    expect(r.checks.find(c => c.id === 'sitemap')?.status).toBe('pass')
  })

  it('홈페이지 fetch 실패 → error 필드', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string | URL) => {
      if (u.toString().endsWith('/robots.txt')) return new Response('', { status: 404 }) as unknown as Response
      if (u.toString().endsWith('/sitemap.xml')) return new Response('', { status: 404 }) as unknown as Response
      if (u.toString().endsWith('/llms.txt')) return new Response('', { status: 404 }) as unknown as Response
      return new Response('', { status: 500 }) as unknown as Response
    }))
    const r = await scanSite('https://example.com')
    expect(r.error).toBeTruthy()
    expect(r.pagesScanned).toBe(0)
  })

  it('URL 형식 오류 → error 필드 (pagesScanned 0)', async () => {
    const r = await scanSite('not a url!!!')
    expect(r.error).toBeTruthy()
    expect(r.checks).toHaveLength(0)
    expect(r.pagesScanned).toBe(0)
  })

  it('HTTP → https 체크 fail', async () => {
    mockFetch({ home: MOCK_HOME_EXCELLENT })
    const r = await scanSite('http://example.com')
    expect(r.checks.find(c => c.id === 'https')?.status).toBe('fail')
  })

  it('GPTBot Disallow → robots fail', async () => {
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      robots: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n',
      sitemap: SITEMAP_MULTI,
    })
    const r = await scanSite('https://example.com')
    const rb = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(rb.status).toBe('fail')
    expect(rb.detail).toContain('GPTBot')
  })

  it('전체 크롤러 차단 → robots 0점', async () => {
    mockFetch({ home: MOCK_HOME_EXCELLENT, robots: 'User-agent: *\nDisallow: /\n' })
    const r = await scanSite('https://example.com')
    const rb = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(rb.status).toBe('fail')
    expect(rb.points).toBe(0)
  })

  it('13개 체크 항목 반환', async () => {
    mockFetch({ home: MOCK_HOME_EXCELLENT })
    const r = await scanSite('https://example.com')
    expect(r.checks).toHaveLength(13)
    const ids = r.checks.map(c => c.id).sort()
    expect(ids).toEqual([
      'direct_answer_block', 'faq_schema', 'https', 'jsonld_localbusiness',
      'last_updated', 'llms_txt', 'meta_description', 'review_schema',
      'robots_ai_allow', 'sameas_entity_linking', 'sitemap', 'title', 'viewport',
    ])
  })

  it('카테고리 분포 geo4 + aeo3 + seo6', async () => {
    mockFetch({ home: MOCK_HOME_EXCELLENT })
    const r = await scanSite('https://example.com')
    expect(r.checks.filter(c => c.category === 'geo')).toHaveLength(4)
    expect(r.checks.filter(c => c.category === 'aeo')).toHaveLength(3)
    expect(r.checks.filter(c => c.category === 'seo')).toHaveLength(6)
  })

  it('LocalBusiness 일반 타입 → warn + foundOn 표기', async () => {
    const generic = MOCK_HOME_EXCELLENT.replace('"MedicalClinic"', '"LocalBusiness"')
    mockFetch({ home: generic, robots: 'User-agent: *\nAllow: /\n', sitemap: SITEMAP_MULTI })
    const r = await scanSite('https://example.com')
    const lb = r.checks.find(c => c.id === 'jsonld_localbusiness')!
    expect(lb.status).toBe('warn')
    expect(lb.detail).toContain('구체화')
    expect(lb.foundOn).toBe('/')
  })

  it('최소 HTML → 낮은 점수', async () => {
    mockFetch({ home: MOCK_HTML_BAD })
    const r = await scanSite('https://example.com')
    expect(r.score).toBeLessThan(30)
    expect(r.checks.find(c => c.id === 'jsonld_localbusiness')?.status).toBe('fail')
    expect(r.checks.find(c => c.id === 'sitemap')?.status).toBe('fail')
  })

  it('사이트맵 인덱스 → nested sitemap 팔로우', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
      const u = url.toString()
      if (u.endsWith('/robots.txt')) return new Response('', { status: 404 }) as unknown as Response
      if (u.endsWith('/llms.txt')) return new Response('', { status: 404 }) as unknown as Response
      if (u.endsWith('/sitemap.xml')) return new Response(`<?xml version="1.0"?>
        <sitemapindex><sitemap><loc>https://example.com/sm-posts.xml</loc></sitemap></sitemapindex>`, { status: 200 }) as unknown as Response
      if (u.endsWith('/sm-posts.xml')) return new Response(`<?xml version="1.0"?>
        <urlset><url><loc>https://example.com/faq</loc></url></urlset>`, { status: 200 }) as unknown as Response
      if (u.endsWith('/faq')) return new Response(MOCK_FAQ_PAGE, { status: 200 }) as unknown as Response
      return new Response(MOCK_HOME_EXCELLENT, { status: 200 }) as unknown as Response
    }))
    const r = await scanSite('https://example.com')
    expect(r.sitemapPresent).toBe(true)
    expect(r.pagesScanned).toBe(2)
    expect(r.checks.find(c => c.id === 'faq_schema')?.status).toBe('pass')
  })

  it('Route pattern 그룹화: 같은 템플릿은 1개, 다른 경로는 전부', async () => {
    // 상세 페이지 100개(같은 템플릿) + /about + /blog 구조
    const detailUrls = Array.from({ length: 30 }, (_, i) =>
      `<url><loc>https://example.com/cheonan/dermatology/place-${i}</loc></url>`,
    ).join('')
    const blogUrls = Array.from({ length: 20 }, (_, i) =>
      `<url><loc>https://example.com/blog/post-${i}</loc></url>`,
    ).join('')
    const sitemap = `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://example.com/about</loc></url>
      <url><loc>https://example.com/cheonan</loc></url>
      <url><loc>https://example.com/cheonan/dermatology</loc></url>
      ${detailUrls}
      ${blogUrls}
    </urlset>`
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      sitemap,
      robots: 'User-agent: *\nAllow: /\n',
    })
    const r = await scanSite('https://example.com')
    // 100개 상세 중 1개만 샘플됐어야 함 (같은 pattern)
    const detailSampled = r.sampledPages?.filter(p => p.startsWith('/cheonan/dermatology/') && p.length > '/cheonan/dermatology/'.length) ?? []
    expect(detailSampled.length).toBe(1)
    // 20개 블로그 중 1개만
    const blogSampled = r.sampledPages?.filter(p => p.startsWith('/blog/') && p.length > '/blog/'.length) ?? []
    expect(blogSampled.length).toBe(1)
    // 총 샘플 수: 홈 + /about + /cheonan + /cheonan/dermatology + 1 상세 + 1 블로그 ≈ 6
    expect(r.pagesScanned).toBeLessThanOrEqual(10)
    expect(r.pagesScanned).toBeGreaterThanOrEqual(4)
  })

  it('샘플링: 상세 페이지(depth ≥ 3) 우선 포함', async () => {
    const sitemap = `<?xml version="1.0"?>
    <urlset>
      <url><loc>https://example.com/about</loc></url>
      <url><loc>https://example.com/cheonan/dermatology/dr-skin</loc></url>
    </urlset>`
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      detail: MOCK_DETAIL_PAGE,
      sitemap,
      robots: 'User-agent: *\nAllow: /\n',
    })
    const r = await scanSite('https://example.com')
    const deepSampled = r.sampledPages?.some(p => p.split('/').filter(Boolean).length >= 3) ?? false
    expect(deepSampled).toBe(true)
  })

  it('AggregateRating 단독 → pass 80% (개별 Review 복제 방지 정책 대응)', async () => {
    const homeWithAggOnly = `
<!DOCTYPE html><html><head><title>Test Title 30자 이상 충분한 길이</title>
<meta name="description" content="메타 설명 기본 80자 이상 채워넣습니다 네이버 카카오 구글 연결 모두 완비된 업체 디렉토리 홈페이지">
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "LocalBusiness",
  "name": "X", "address": "Y", "telephone": "1", "openingHours": "Mo-Fr 09-18",
  "aggregateRating": {"@type":"AggregateRating","ratingValue":4.5,"reviewCount":100}
}
</script>
</head><body></body></html>`
    mockFetch({ home: homeWithAggOnly, robots: 'User-agent: *\nAllow: /\n', sitemap: '<?xml version="1.0"?><urlset></urlset>' })
    const r = await scanSite('https://example.com')
    const rev = r.checks.find(c => c.id === 'review_schema')!
    expect(rev.status).toBe('pass')
    expect(rev.points).toBe(4)  // 5 × 0.8 = 4
    expect(rev.detail).toContain('AggregateRating')
  })

  it('sameAs: naver.me / business.google / goo.gl 인식', async () => {
    const homeWithAltUrls = `
<!DOCTYPE html><html><head><title>Test Title 30자 이상 충분한 길이</title>
<meta name="description" content="메타 설명 기본 80자 이상 채워넣습니다 네이버 카카오 구글 연결 모두 완비된 업체 디렉토리 홈페이지">
<script type="application/ld+json">
{
  "@context": "https://schema.org", "@type": "LocalBusiness",
  "name": "X", "address": "Y", "telephone": "1", "openingHours": "Mo-Fr 09-18",
  "sameAs": ["https://naver.me/abc123", "https://kakaomap.com/place/1", "https://business.google.com/abc"]
}
</script>
</head><body></body></html>`
    mockFetch({ home: homeWithAltUrls, robots: 'User-agent: *\nAllow: /\n', sitemap: '<?xml version="1.0"?><urlset></urlset>' })
    const r = await scanSite('https://example.com')
    const sa = r.checks.find(c => c.id === 'sameas_entity_linking')!
    expect(sa.status).toBe('pass')
  })

  it('sampledPages 경로 배열 포함', async () => {
    mockFetch({
      home: MOCK_HOME_EXCELLENT,
      faq: MOCK_FAQ_PAGE,
      sitemap: `<?xml version="1.0"?><urlset><url><loc>https://example.com/faq</loc></url></urlset>`,
    })
    const r = await scanSite('https://example.com')
    expect(r.sampledPages).toContain('/')
    expect(r.sampledPages).toContain('/faq')
  })
})
