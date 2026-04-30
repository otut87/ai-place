# E2E 테스트 (Playwright)

T-259 Phase 1 마지막 항목. Phase 0/1 의 보안 변경(/admin/* 권한·owner IDOR·blog XSS·rate-limit)에 대한 자동 회귀 안전망.

## 첫 실행 준비

```bash
# 1. 브라우저 바이너리 설치 (~수백 MB, 1회)
npx playwright install chromium

# 2. 테스트 실행 (로컬 dev 서버 자동 기동)
npm run test:e2e
```

## 실행 모드

| 환경 | 명령 | 동작 |
|---|---|---|
| 로컬 (default) | `npm run test:e2e` | playwright 가 `npm run dev` 자동 기동 → http://localhost:3000 |
| UI 모드 (디버그) | `npm run test:e2e:ui` | 인터랙티브 러너로 시나리오별 step·trace·screenshot 시각화 |
| 외부 URL (smoke) | `E2E_BASE_URL=https://aiplace.kr npm run test:e2e` | webServer 없이 production / preview 직접 두드림 |
| 헤드 모드 (육안 확인) | `npm run test:e2e -- --headed` | 브라우저 보임 |

## 현재 시나리오

### `e2e/admin-auth.spec.ts` — 보안 회귀 #1
Phase 0 S1 fix 회귀 안전망. 비인증 사용자가 `/admin/*` 진입 시 `/admin/login` 으로 redirect 되어야 함.

- `/admin`, `/admin/citations`, `/admin/places`, `/admin/blog`, `/admin/seo`, `/admin/register` 6개 경로
- `/admin/login` 자체는 redirect 없이 진입 (로그인 가능해야 함)
- `/owner` 는 `/login` 으로 redirect (admin 과 분리된 owner 게이트)

### `e2e/public-smoke.spec.ts` — 공개 페이지 smoke
SSR/SSG 라우트의 200 응답 + 핵심 마크업 노출 확인. next.config / data layer 변경 시 회귀 빠르게 잡음.

- `/`, `/pricing`, `/terms`, `/privacy`, `/about`, `/check`, `/login`, `/signup`
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`

## Phase 2 로 미룬 시나리오 (인증 fixture 필요)

| 회귀 # | 시나리오 | 필요 셋업 |
|---|---|---|
| S5 | Owner IDOR — A 계정이 B 계정 place URL 진입 시 차단 | owner 2명 fixture, supabase seed |
| S4 | admin blog markdown 본문에 `<script>` 삽입 → preview 정상 (XSS 차단) | admin 로그인 storage state |
| S7 | /check 6회 연속 요청 시 6번째 429 (Upstash rate-limit) | preview 환경 + Upstash test 인스턴스 |

이 시나리오들은 fixture 인프라 (test users seed + storageState) 가 별도로 필요해 phase 2 로 분리.

## CI 통합 (TODO)

- GitHub Actions 워크플로우: PR 시 로컬 모드 + production 배포 후 smoke
- artifact 로 `playwright-report/`, `test-results/` 업로드

## 트러블슈팅

- **`Browser executable not found`**: `npx playwright install chromium` 실행
- **`webServer timeout`**: `npm run dev` 가 120초 안에 시작하지 못함. 포트 충돌 확인 — 다른 dev 서버가 3000 사용 중이면 종료
- **`Test timeout`**: 네트워크/DB 느림. `playwright.config.ts` 의 `timeout` 상향 또는 시나리오 별 `test.setTimeout()`
