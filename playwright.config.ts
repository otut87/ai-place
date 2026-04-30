// T-259 — E2E 인프라 (Phase 1 마지막 항목).
//
// 두 가지 실행 모드:
//   1) 로컬 개발 (default): E2E_BASE_URL 미설정 → playwright 가 자동으로 `npm run dev`
//      를 띄워 http://localhost:3000 에서 테스트. dev 환경이라 Upstash rate-limit 등
//      무력화된 곳도 있음 (production fail-fast 만 검증, IP/유저 차단 동작 자체는 skip).
//   2) production / preview smoke: E2E_BASE_URL=https://aiplace.kr (또는 preview URL)
//      을 export 하면 외부 webServer 없이 그 URL 을 그대로 두드림. CI / staged 검증용.
//
// 시나리오 추가 시 e2e/*.spec.ts 로 작성 — testDir 만 보면 됨.
//
// 첫 실행 전 브라우저 바이너리 설치 필요:
//   npx playwright install chromium

import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'
const isExternal = baseURL.startsWith('https://')

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // E2E_BASE_URL 이 외부 URL 이면 webServer 띄우지 않음.
  webServer: isExternal
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // dev 서버의 stdout/stderr 는 testRun 진행 흐름과 분리되어 노이즈가 됨 → ignore.
        stdout: 'ignore',
        stderr: 'pipe',
      },
})
