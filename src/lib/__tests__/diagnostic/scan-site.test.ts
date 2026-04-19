// T-137 — 홈페이지 기술 진단 로직 테스트.
// HTML 파싱·점수화 로직 검증 (네트워크 호출은 목킹).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { scanSite } from '@/lib/diagnostic/scan-site'

const MOCK_HTML_GOOD = `
<!DOCTYPE html><html lang="ko"><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>천안 피부과 — 닥터스킨 클리닉 공식 홈페이지</title>
<meta name="description" content="천안 서북구 불당동에 위치한 닥터스킨 피부과 전문 클리닉. 여드름, 레이저, 모공 관리 등 다양한 시술을 제공합니다.">
<meta property="og:title" content="닥터스킨 클리닉">
<meta property="og:description" content="천안 피부과">
<meta property="og:image" content="https://example.com/og.png">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  "name": "닥터스킨 클리닉",
  "address": { "@type": "PostalAddress", "streetAddress": "천안시 서북구" },
  "telephone": "+82-41-000-0000",
  "openingHoursSpecification": [{ "@type": "OpeningHoursSpecification" }]
}
</script>
</head><body>Content</body></html>
`

const MOCK_HTML_BAD = `
<!DOCTYPE html><html><head><title>Short</title></head><body></body></html>
`

beforeEach(() => {
  vi.restoreAllMocks()
})

function mockFetch(htmlBody: string, robotsBody = '', sitemapOk = false, llmsOk = false) {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => {
    const u = url.toString()
    if (u.endsWith('/robots.txt')) {
      return new Response(robotsBody, { status: robotsBody ? 200 : 404 }) as unknown as Response
    }
    if (u.endsWith('/sitemap.xml')) {
      return new Response('<?xml version="1.0"?>', { status: sitemapOk ? 200 : 404 }) as unknown as Response
    }
    if (u.endsWith('/llms.txt')) {
      return new Response('# AI Place', { status: llmsOk ? 200 : 404 }) as unknown as Response
    }
    return new Response(htmlBody, { status: 200 }) as unknown as Response
  }))
}

describe('T-137 scanSite', () => {
  it('잘 구조화된 HTTPS 사이트 → 높은 점수 (80+)', async () => {
    mockFetch(MOCK_HTML_GOOD, 'User-agent: *\nAllow: /\n', true, true)
    const r = await scanSite('https://example.com')
    expect(r.error).toBeUndefined()
    expect(r.score).toBeGreaterThan(80)
    const jsonld = r.checks.find(c => c.id === 'jsonld_localbusiness')!
    expect(jsonld.status).toBe('pass')
  })

  it('최소한의 HTML → 낮은 점수', async () => {
    mockFetch(MOCK_HTML_BAD, '', false, false)
    const r = await scanSite('https://example.com')
    expect(r.score).toBeLessThan(30)
    expect(r.checks.find(c => c.id === 'jsonld_localbusiness')?.status).toBe('fail')
    expect(r.checks.find(c => c.id === 'meta_description')?.status).toBe('fail')
  })

  it('HTTP(not HTTPS) URL → https 체크 실패', async () => {
    mockFetch(MOCK_HTML_GOOD)
    const r = await scanSite('http://example.com')
    const httpsCheck = r.checks.find(c => c.id === 'https')!
    expect(httpsCheck.status).toBe('fail')
  })

  it('잘못된 URL → error 필드 반환', async () => {
    const r = await scanSite('not a url!!!')
    expect(r.error).toBeTruthy()
    expect(r.checks).toHaveLength(0)
  })

  it('robots.txt 의 GPTBot Disallow / → fail', async () => {
    const robots = `User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n`
    mockFetch(MOCK_HTML_GOOD, robots, true, true)
    const r = await scanSite('https://example.com')
    const robotsCheck = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(robotsCheck.status).toBe('fail')
    expect(robotsCheck.detail).toContain('GPTBot')
  })

  it('robots.txt 전체 차단 (User-agent: * Disallow: /) → fail + 0점', async () => {
    const robots = `User-agent: *\nDisallow: /\n`
    mockFetch(MOCK_HTML_GOOD, robots, false, false)
    const r = await scanSite('https://example.com')
    const robotsCheck = r.checks.find(c => c.id === 'robots_ai_allow')!
    expect(robotsCheck.status).toBe('fail')
    expect(robotsCheck.points).toBe(0)
  })

  it('점수는 0~100 범위', async () => {
    mockFetch(MOCK_HTML_GOOD, 'User-agent: *\nAllow: /\n', true, true)
    const r = await scanSite('https://example.com')
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('9개 체크 항목 모두 반환', async () => {
    mockFetch(MOCK_HTML_GOOD, '', false, false)
    const r = await scanSite('https://example.com')
    expect(r.checks).toHaveLength(9)
    const ids = r.checks.map(c => c.id).sort()
    expect(ids).toEqual([
      'https', 'jsonld_localbusiness', 'llms_txt', 'meta_description',
      'og_tags', 'robots_ai_allow', 'sitemap', 'title', 'viewport',
    ])
  })
})
