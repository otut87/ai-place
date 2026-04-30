// T-259 — 공개 페이지 smoke. SSR/SSG 라우트가 5xx 나지 않고 핵심 마크업이 렌더되는지.
//   회귀 가치: data fetching 또는 next.js config 변경 시 빌드는 통과해도 prerender/runtime
//   에러로 페이지가 깨질 수 있음 (예: 직전 next.config images.localPatterns 누락 빌드 실패).

import { test, expect } from '@playwright/test'

test('홈 페이지 정상 렌더 + title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/AI Place/)
  // 핵심 nav 또는 검색 영역 1개 보이면 OK.
  // (페이지 구조 변경에 너무 fragile 하지 않게 최소 확인)
  expect(await page.locator('main').count()).toBeGreaterThan(0)
})

test('/pricing 정상 렌더 + 가격 카피', async ({ page }) => {
  await page.goto('/pricing')
  await expect(page).toHaveTitle(/요금/)
  await expect(page.getByText('14,900원').first()).toBeVisible()
})

test('/terms (이용약관) 정상 렌더', async ({ page }) => {
  await page.goto('/terms')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('이용약관')
})

test('/privacy (개인정보처리방침) 정상 렌더', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('처리방침')
})

test('/about 정상 렌더', async ({ page }) => {
  const res = await page.goto('/about')
  expect(res?.status()).toBe(200)
})

test('/check 진단 입력 페이지 렌더', async ({ page }) => {
  const res = await page.goto('/check')
  expect(res?.status()).toBe(200)
  await expect(page.getByLabel('진단할 페이지 URL')).toBeVisible()
})

test('robots.txt 200 + User-agent', async ({ request }) => {
  const r = await request.get('/robots.txt')
  expect(r.status()).toBe(200)
  expect(await r.text()).toContain('User-agent')
})

test('sitemap.xml 200 + xml content-type', async ({ request }) => {
  const r = await request.get('/sitemap.xml')
  expect(r.status()).toBe(200)
  expect(r.headers()['content-type']).toMatch(/xml/)
})

test('/llms.txt 200', async ({ request }) => {
  const r = await request.get('/llms.txt')
  expect(r.status()).toBe(200)
})

test('/login 정상 렌더 (owner 로그인)', async ({ page }) => {
  const res = await page.goto('/login')
  expect(res?.status()).toBe(200)
})

test('/signup 정상 렌더 (owner 가입)', async ({ page }) => {
  const res = await page.goto('/signup')
  expect(res?.status()).toBe(200)
})
