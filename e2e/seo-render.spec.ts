// T-263 — 공개 SEO 렌더 회귀 테스트 (codex P2-4).
//
// 회귀 가치: build/lint/unit 통과해도 canonical 누락, JSON-LD @type 깨짐, BreadcrumbList
// 미생성, freshness 신호 위조 같은 SEO/AEO 회귀는 잡히지 않음. 핵심 4개 라우트의 실제
// 렌더 HTML 을 검증해 인덱싱 회귀를 막는다.
//
// 시드 의존: dr-evers (data.ts seed + Supabase 모두 존재). seed slug 가 바뀌면 테스트도
// 같이 업데이트해야 함 (의도된 lock).

import { test, expect, type Page } from '@playwright/test'

const BASE = 'https://aiplace.kr'

interface JsonLdNode {
  '@type'?: string | string[]
  '@graph'?: JsonLdNode[]
  itemListElement?: unknown[]
  [key: string]: unknown
}

async function extractJsonLd(page: Page): Promise<JsonLdNode[]> {
  return page.evaluate((): JsonLdNode[] => {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    const out: JsonLdNode[] = []
    for (const s of scripts) {
      try {
        const parsed = JSON.parse(s.textContent ?? '')
        if (Array.isArray(parsed)) out.push(...parsed)
        else out.push(parsed)
      } catch {
        // ignore malformed
      }
    }
    return out
  })
}

function hasType(nodes: JsonLdNode[], type: string): boolean {
  for (const n of nodes) {
    const t = n['@type']
    if (t === type) return true
    if (Array.isArray(t) && t.includes(type)) return true
    if (n['@graph']) {
      if (hasType(n['@graph'], type)) return true
    }
  }
  return false
}

async function getCanonical(page: Page): Promise<string | null> {
  return page.locator('link[rel="canonical"]').first().getAttribute('href')
}

test('카테고리 hub: /cheonan/dermatology — canonical + ItemList + BreadcrumbList', async ({ page }) => {
  const res = await page.goto('/cheonan/dermatology')
  expect(res?.status()).toBe(200)

  const canonical = await getCanonical(page)
  expect(canonical).toBe(`${BASE}/cheonan/dermatology`)

  const ld = await extractJsonLd(page)
  expect(ld.length).toBeGreaterThan(0)
  expect(hasType(ld, 'ItemList') || hasType(ld, 'CollectionPage')).toBe(true)
  expect(hasType(ld, 'BreadcrumbList')).toBe(true)
})

test('업체 상세: /cheonan/dermatology/dr-evers — canonical + LocalBusiness subtype + BreadcrumbList', async ({ page }) => {
  const res = await page.goto('/cheonan/dermatology/dr-evers')
  expect(res?.status()).toBe(200)

  const canonical = await getCanonical(page)
  expect(canonical).toBe(`${BASE}/cheonan/dermatology/dr-evers`)

  const ld = await extractJsonLd(page)
  // dermatology 는 MedicalClinic 으로 매핑. 명시적 subtype 또는 fallback LocalBusiness 어느 쪽이든 OK.
  expect(
    hasType(ld, 'MedicalClinic') ||
    hasType(ld, 'MedicalBusiness') ||
    hasType(ld, 'LocalBusiness')
  ).toBe(true)
  expect(hasType(ld, 'BreadcrumbList')).toBe(true)
})

test('/blog — canonical + BreadcrumbList', async ({ page }) => {
  const res = await page.goto('/blog')
  expect(res?.status()).toBe(200)

  const canonical = await getCanonical(page)
  expect(canonical).toBe(`${BASE}/blog`)

  const ld = await extractJsonLd(page)
  expect(hasType(ld, 'BreadcrumbList')).toBe(true)
})

test('/llms.txt — hub 구조 (인덱스 + 활성 카테고리 + 블로그 + 데이터 형식)', async ({ request }) => {
  const r = await request.get('/llms.txt')
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toMatch(/text\/plain/)
  // T-263: ISR + s-maxage Cache-Control 필수.
  expect(r.headers()['cache-control']).toMatch(/s-maxage=3600/)

  const text = await r.text()
  // 새 구조 4개 섹션 모두 포함 (codex P2-3 fix).
  expect(text).toContain('## 인덱스')
  expect(text).toContain('## 업종 분류')
  expect(text).toContain('## 활성 카테고리 페이지')
  expect(text).toContain('## 블로그')
  expect(text).toContain('## 데이터 형식')
  // sitemap/feed/robots 인덱스 링크 — corpus discoverability 핵심.
  expect(text).toContain(`${BASE}/sitemap.xml`)
  expect(text).toContain(`${BASE}/feed.xml`)
})

test('sitemap.xml — lastmod 가 ISO 8601 형식 (가짜 freshness 회귀 방지)', async ({ request }) => {
  const r = await request.get('/sitemap.xml')
  expect(r.status()).toBe(200)
  const xml = await r.text()
  // lastmod 가 하나라도 있다면 ISO 8601 형식이어야 함. 빈 lastmod 또는 깨진 날짜는 fail.
  const matches = xml.match(/<lastmod>([^<]+)<\/lastmod>/g) ?? []
  if (matches.length > 0) {
    for (const m of matches) {
      const inner = m.replace(/<\/?lastmod>/g, '')
      // YYYY-MM-DD 또는 full ISO (T 포함).
      expect(inner).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}([+-]\d{2}:?\d{2}|Z)?)?$/)
    }
  }
})
