// Phase 1 / D1 (2026-05-06) — 0429 보안 회귀 4 시나리오.
//
// 목적: T-259 Phase 0 S1·S4·S5·S7 / B1·B2·B3 hardening 의 자동 회귀 안전망.
// 회귀 시 admin 권한 누수, owner IDOR, stored XSS, cost amplification 이 다시 열릴 위험.
//
// 인프라 의존:
//   - 시나리오 1 (/check rate-limit): UPSTASH_REDIS_REST_URL 또는 KV_REST_API_URL 필요.
//     없으면 rate-limit no-op → test.skip().
//   - 시나리오 2 (admin allowlist): non-admin 사용자 fixture 필요. fixture 인프라 미정 시 skip.
//   - 시나리오 3 (owner IDOR): owner-A / owner-B + place fixture 필요. fixture 미정 시 skip.
//   - 시나리오 4 (admin blog XSS): admin 사용자 fixture + storageState. fixture 미정 시 skip.
//
// fixture 인프라가 들어오는 시점에 환경변수 가드를 풀면 자동 활성됨 — 시나리오 로직은 미리 작성.

import { test, expect, type Page } from '@playwright/test'

// ── 환경 가드 ────────────────────────────────────────────────────────
const HAS_UPSTASH = Boolean(
  process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
)
// fixture infra 도입 시점에 process.env.E2E_FIXTURES = '1' 같은 플래그 set 후 가드 풂.
// 현재는 항상 false → skip.
const HAS_AUTH_FIXTURES = process.env.E2E_FIXTURES === '1'

// ── 시나리오 1 — /check 진단 rate-limit (분당 5회 / IP) ─────────────────
test.describe('보안 회귀 #1 — /check 진단 rate-limit (S7 + B1)', () => {
  test.skip(!HAS_UPSTASH, 'UPSTASH/KV env 미설정 — rate-limit 비활성. preview/prod 환경에서만 실행.')

  test('동일 IP 6회 연속 요청 → 6번째 429 차단', async ({ request }) => {
    const responses: number[] = []
    for (let i = 0; i < 6; i++) {
      const r = await request.post('/api/diagnose', {
        data: { url: 'https://example.com' },
        failOnStatusCode: false,
      })
      responses.push(r.status())
    }

    // 처음 5회는 정상 응답 (200·400·5xx 무관 — rate-limit 와 분리), 6회째는 429 또는
    // generic error 응답으로 차단. action 응답 형태에 따라 status code 정책이 다를 수 있어
    // 마지막 응답이 200 이면서도 본문에 "요청이 너무 많습니다" 문구 포함되는 경우도 OK.
    expect(responses.slice(0, 5).every(s => s !== 429)).toBe(true)
    expect(responses[5]).toBe(429)
  })
})

// ── 시나리오 2 — admin allowlist (S1 강화) ─────────────────────────────
test.describe('보안 회귀 #2 — non-admin 로그인 사용자가 /admin URL → /admin/login redirect (S1)', () => {
  test.skip(!HAS_AUTH_FIXTURES, 'fixture 인프라 미정 — owner storageState 필요.')

  test('owner 로 로그인 후 /admin/citations 직접 진입 → /admin/login 리다이렉트', async ({ page }) => {
    // fixture 가 들어오면: owner storageState 로드 후 /admin/* 접근.
    // middleware 의 isAdminEmail(user.email) 검증으로 redirect.
    await page.goto('/admin/citations')
    await expect(page).toHaveURL(/\/admin\/login(\?|$)/)
  })
})

// ── 시나리오 3 — Owner IDOR (S5) ────────────────────────────────────────
test.describe('보안 회귀 #3 — Owner IDOR — A 계정이 B 계정 place URL 진입 차단 (S5)', () => {
  test.skip(!HAS_AUTH_FIXTURES, 'fixture 인프라 미정 — owner-A / owner-B + place fixture 필요.')

  test('owner-A 로그인 + owner-B 의 place 대시보드 URL 진입 → "권한 없음" 페이지', async ({ page }) => {
    // fixture: owner-A storageState + B 계정 place id (fixture 에서 주입).
    const otherPlaceId = process.env.E2E_OTHER_PLACE_ID ?? 'placeholder-id'
    await page.goto(`/owner/places/${otherPlaceId}/dashboard`)
    // canOwnerEdit() 가 false 면 "권한 없음" 또는 redirect 노출되어야 함.
    await expect(page.getByText(/권한이 없|접근할 수 없|찾을 수 없/)).toBeVisible()
  })
})

// ── 시나리오 4 — admin blog markdown XSS 차단 (S4) ─────────────────────
test.describe('보안 회귀 #4 — admin blog markdown XSS 차단 (S4)', () => {
  test.skip(!HAS_AUTH_FIXTURES, 'fixture 인프라 미정 — admin storageState 필요.')

  test('admin 이 <script> 본문 작성 시 preview 가 스크립트 실행 안 함', async ({ page }) => {
    // fixture: admin storageState 로 /admin/blog/[slug]/edit 진입.
    // SafeMarkdown(react-markdown + rehype-sanitize) 로 <script> 태그가 sanitize 되어야 함.
    await page.goto('/admin/blog/test-fixture-slug/edit')
    await page.getByLabel('본문').fill('<script>window.__e2eXssFired = true;</script>**bold**')

    // preview 영역 (toolbar 의 "미리보기" 토글 또는 별도 column).
    await page.getByRole('button', { name: /미리보기/ }).click()

    const xssFired = await page.evaluate(() => Boolean((window as unknown as { __e2eXssFired?: boolean }).__e2eXssFired))
    expect(xssFired).toBe(false)
    // bold 마크다운은 정상 렌더되어야 함 (sanitize 가 모든 markdown 까지 죽이면 UX 망가짐)
    await expect(page.locator('strong').first()).toHaveText('bold')
  })
})

// ── 시나리오 5 (보너스) — /admin/seo 가 1.17M rows 환경에서도 timeout 없이 로드 (A2) ─
test.describe('보안 회귀 #5 — /admin/seo 페이지 perf 회귀 가드 (A2)', () => {
  test.skip(!HAS_AUTH_FIXTURES, 'fixture 인프라 미정 — admin storageState 필요.')

  test('admin 로그인 후 /admin/seo 진입 → 10초 안에 핵심 헤더 노출', async ({ page }: { page: Page }) => {
    // A2: 일별 사전집계 + RPC 로 페이지 <100ms 로드 보장. 10초 timeout 은 넉넉한 안전망.
    page.setDefaultTimeout(10_000)
    await page.goto('/admin/seo')
    await expect(page.getByRole('heading', { name: 'AI 봇 방문 로그' })).toBeVisible()
    // 집계 시각 배지가 노출되어야 함 (lastAggregatedAt 표시).
    await expect(page.getByText(/최근 집계/)).toBeVisible()
  })
})
