// T-259 보안 회귀 #1 — /admin/* 접근 가드.
//
// Phase 0 S1 fix: middleware + admin-emails allowlist 단일화. 비인증/비-admin 사용자가
// /admin/* 진입 시 /admin/login 으로 redirect. 회귀 시 admin 페이지가 누구에게나 노출되는
// 심각한 권한 누수가 발생하므로 이 테스트는 보안 안전망 역할.

import { test, expect } from '@playwright/test'

const PROTECTED_PATHS = [
  '/admin',
  '/admin/citations',
  '/admin/places',
  '/admin/blog',
  '/admin/seo',
  '/admin/register',
]

for (const path of PROTECTED_PATHS) {
  test(`비인증 사용자가 ${path} 접근 → /admin/login 으로 redirect`, async ({ page }) => {
    await page.goto(path)
    // middleware redirect 후 최종 URL 이 /admin/login 이어야 함.
    await expect(page).toHaveURL(/\/admin\/login(\?|$)/)
    // 로그인 폼이 실제로 렌더되는지 (ssr 라우트 매핑 확인).
    await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()
  })
}

test('/admin/login 자체는 redirect 없이 진입 (login 자체가 차단되면 로그인 불가)', async ({ page }) => {
  await page.goto('/admin/login')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible()
  // 폼 필드 노출 확인.
  await expect(page.getByLabel('이메일')).toBeVisible()
  await expect(page.getByLabel('비밀번호')).toBeVisible()
})

test('/owner 접근 시 /login 으로 redirect (admin 게이트와 분리됨)', async ({ page }) => {
  await page.goto('/owner')
  // requireOwnerUser 는 /login 으로 보냄 (admin 과 분리된 owner 로그인).
  await expect(page).toHaveURL(/\/login(\?|$)/)
})
