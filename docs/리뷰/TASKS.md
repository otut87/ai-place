# TASKS — aiplace.kr 실행 작업 목록

> **생성일**: 2026-04-17
> **기반**: [WORK_ORDER_aiplace_review.md](WORK_ORDER_aiplace_review.md) 46개 항목
> **용도**: WO의 "무엇을" → 이 문서는 "어떻게·언제·누가·어떤 파일". 세션 단위 실행 가능한 단위로 분해.

---

## 사용법

- 각 TASK는 **단일 PR 단위** (1~8시간 작업)
- TASK ID: `T-XXX` 3자리 번호. 우선순위 순 부여
- WO 항목 참조: `(WO #N)` 표기
- 축 태그: `[SEO]` `[AEO]` `[GEO]` `[Admin]` `[Ops]` — 한 TASK는 여러 축 가능
- 상태:
  - `🔜 대기` — 착수 전
  - `⏳ 진행` — 진행 중
  - `✅ 완료` — PR 머지됨
  - `⏸ 블락` — 의사결정·외부 의존
  - `❌ 취소`
- **Definition of Done (DoD)** 각 TASK에 명시

---

## 우선순위 Phase 요약

| Phase | 목적 | TASK 범위 | 예상 기간 |
|---|---|---|---|
| **Phase -1 (Bootstrap)** | 개발 하네스 구축 | T-000 ✅ | 반나절 |
| **Phase 0** | 사실 정확도 확보 (AI 인용 신뢰 기반) | T-001 ~ T-005 | 1-2일 |
| **Phase 1** | 템플릿·포맷 정리 (작은 작업 묶음) | T-006 ~ T-010 | 2일 |
| **Phase 1.5** ⭐ | **블로그 시스템 구축 + 12개 페이지 마이그레이션 (#47)** | **T-010a ~ T-010i** | **4-6일** |
| **Phase 2** | Admin 대량 등록 UX (#46 먼저) | T-011 ~ T-020 | 4-5일 |
| **Phase 3** | LLM 품질 파이프라인 (Sonnet + Haiku + 네이버) | T-021 ~ T-028 | 3-4일 |
| **Phase 4** | GEO·AEO 구조화 데이터 완성도 | T-029 ~ T-035 | 2-3일 |
| **Phase 5** | SEO·CWV·접근성 정비 | T-036 ~ T-045 | 3일 |
| **Phase 6** | 확장성·운영 자동화 | T-046 ~ T-057 | 1-2주 |

> **Phase 우선순위 vs 순서 노트**:
> WO 통합 작업 순서로는 P0 작업(`#1, #3, #4, #5, #47, #46, #45, #34~`)이 P1(`#6, #7, #11~`)보다 먼저.
> TASKS Phase 1 (T-006~T-010) 의 P1 작업들은 **각각 30분~2시간 소요의 작은 작업**이라 묶어서 빠르게 처리 후 Phase 1.5 진입.
> 시간 압박 시: Phase 1 건너뛰고 → Phase 1.5 → Phase 2 → Phase 3 → 그 후 Phase 1 작업 처리해도 OK.

---

## 🛡️ Workflow Policy (T-000 이후 모든 TASK 적용)

모든 개발 작업은 이 순서로 진행:

```
[1] TASK 문서 작성 (TASKS.md 항목 `🔜 대기` 등록)
      ↓
[2] Tests 먼저 작성 (TDD)
      ↓
[3] 구현 (tests green 될 때까지)
      ↓
[4] test-coverage 검증 (변경 파일 ≥80%)
      ↓
[5] 코드 리뷰 (`npm run harness:review` 로 기록)
      ↓
[6] TASK 상태 업데이트 (`🔜 → ⏳ → ✅`)
      ↓
[7] `npm run build` (하네스가 위 모든 조건 검증)
```

하네스(T-000 구현 후)가 다음을 빌드 오류로 처리:
- 테스트 없는 소스 파일
- 커버리지 80% 미달
- 리뷰 기록 없는 커밋
- TASK 참조(`T-XXX`) 없는 커밋
- TASK 상태 미업데이트

---

---

# Phase -1 (Bootstrap) — 개발 하네스 (반나절)

## T-000. Development Harness 구축 ✅ [Ops][모든 축 선행]

**완료**: 2026-04-17. 5개 Gate 전부 구현 + 41개 테스트 통과 + 자체 검증(의도적 실패 파일 추가 시 3개 Gate 차단 확인).

**목적**: 이후 모든 TASK가 TDD + 리뷰 + TASK 업데이트를 강제하는 워크플로를 거치게 함. 품질 저하·누락 방지.

**구성**

### 1) 디렉토리 구조
```
scripts/harness/
├── check.ts              # CLI 진입점 (모든 gate 오케스트레이션)
├── record-review.ts      # 리뷰 기록 CLI
├── gates/
│   ├── task-ref.ts       # G1: 커밋 메시지에 T-XXX / WO-#N 필수
│   ├── test-existence.ts # G2: src/lib/** 파일에 대응 테스트 존재
│   ├── coverage.ts       # G3: 변경 파일 커버리지 ≥80%
│   ├── review.ts         # G4: .harness/review-log.jsonl에 리뷰 기록
│   └── task-status.ts    # G5: TASKS.md에 참조 TASK 상태 업데이트됨
├── util/
│   ├── git.ts            # git log/diff 파싱
│   ├── config.ts         # .harness/config.json 로더
│   └── logger.ts         # 컬러 출력
└── __tests__/
    ├── task-ref.test.ts
    ├── test-existence.test.ts
    ├── coverage.test.ts
    ├── review.test.ts
    └── task-status.test.ts

.harness/
├── config.json           # 임계값·제외 패턴
└── review-log.jsonl      # 리뷰 기록 (append-only)
```

### 2) 5개 Gate

| Gate | 체크 내용 | 실패 시 |
|---|---|---|
| **G1 TASK 참조** | `git log origin/master..HEAD` 커밋 메시지에 `T-\d{3}` 또는 `WO-#\d+` 포함 | Build FAIL |
| **G2 테스트 존재** | 변경된 `src/lib/**/*.ts` 에 대응하는 `src/lib/__tests__/*.test.ts` 존재 | Build FAIL (프레임워크 파일 제외) |
| **G3 커버리지** | Vitest `--coverage.reporter=json-summary` 결과, 변경 파일 커버리지 ≥ 80% | Build FAIL |
| **G4 리뷰** | 변경된 파일 전체가 `.harness/review-log.jsonl` 최신 commit 기록에 포함 | Build FAIL |
| **G5 TASK 상태** | 커밋 메시지의 `T-XXX` 가 TASKS.md에 존재 + `⏳`/`✅` 상태 | Build FAIL |

### 3) 제외 규칙 (`.harness/config.json`)
- `src/app/**/page.tsx` — Next.js 페이지 파일 (통합 테스트로 커버)
- `src/app/**/layout.tsx`
- `src/app/**/opengraph-image.tsx`
- `src/app/*.ts` (robots.ts, sitemap.ts, manifest.ts)
- `*.d.ts`
- `scripts/**` (본 하네스 외)

### 4) package.json 변경
```json
{
  "scripts": {
    "build": "npm run harness:check && next build && tsx scripts/validate-pages.ts",
    "harness:check": "tsx scripts/harness/check.ts",
    "harness:review": "tsx scripts/harness/record-review.ts",
    "harness:bypass": "SKIP_HARNESS=1 npm run build"
  }
}
```

### 5) Git Hooks (husky)
- `commit-msg`: 커밋 메시지에 TASK 참조 검증 (`T-\d{3}` 또는 `WO-#\d+`)
- `pre-push`: `npm run harness:check` 실행

### 6) 리뷰 기록 포맷 (`.harness/review-log.jsonl`)
```jsonl
{"commit":"abc123","timestamp":"2026-04-17T10:30:00Z","reviewer":"self","files":["src/lib/format/rating.ts"],"taskId":"T-009","notes":"유닛 테스트 추가, edge case OK"}
{"commit":"def456","timestamp":"2026-04-17T11:00:00Z","reviewer":"self","files":["src/lib/site-stats.ts"],"taskId":"T-003","notes":""}
```

### 7) Bypass 전략
- 긴급 배포 시 `SKIP_HARNESS=1 npm run build` 로 우회 가능
- 하네스 통과 실패 시 상세 리포트 출력

**작업 분해**

- [x] T-000.1. 하네스 디자인 문서 (이 섹션) + [docs/harness.md](../harness.md)
- [x] T-000.2. `.harness/config.json` 템플릿 작성
- [x] T-000.3. `scripts/harness/util/` 유틸 작성 (git, config, glob, logger)
- [x] T-000.4. G1 task-ref 테스트 먼저 + 구현 (7 tests)
- [x] T-000.5. G2 test-existence 테스트 먼저 + 구현 (8 tests)
- [x] T-000.6. G3 coverage 테스트 먼저 + 구현 (7 tests)
- [x] T-000.7. G4 review 테스트 먼저 + 구현 (8 tests)
- [x] T-000.8. G5 task-status 테스트 먼저 + 구현 (11 tests)
- [x] T-000.9. `check.ts` 오케스트레이터 작성
- [x] T-000.10. `record-review.ts` CLI 작성
- [x] T-000.11. package.json scripts 등록 (build 자동 체크 포함)
- [x] T-000.12. husky 설치 + `commit-msg` / `pre-commit` / `pre-push` 훅
- [x] T-000.13. 사용법 README 작성 ([docs/harness.md](../harness.md))
- [x] T-000.14. **자기 자신에게 통과 확인** — 41 tests pass + 의도적 실패 검증

**DoD**
- [x] `npm run build` 실행 시 모든 5개 gate 실행 (`npm run harness:check` 선행)
- [x] 테스트 없는 소스 파일 1개 추가 후 `npm run harness:check` → G2·G3·G4 차단 확인
- [x] `npm run harness:review` 실행 후 log 기록 정상
- [x] 커버리지 <80% 감지 (0% 케이스로 확인)
- [x] `SKIP_HARNESS=1` 환경변수로 우회 가능
- [x] Git `commit-msg` 훅으로 TASK 참조 없는 커밋 거부

**테스트 파일 (TDD 증거)**
- [scripts/harness/__tests__/task-ref.test.ts](../../scripts/harness/__tests__/task-ref.test.ts) — 7 tests
- [scripts/harness/__tests__/test-existence.test.ts](../../scripts/harness/__tests__/test-existence.test.ts) — 8 tests
- [scripts/harness/__tests__/coverage.test.ts](../../scripts/harness/__tests__/coverage.test.ts) — 7 tests
- [scripts/harness/__tests__/review.test.ts](../../scripts/harness/__tests__/review.test.ts) — 8 tests
- [scripts/harness/__tests__/task-status.test.ts](../../scripts/harness/__tests__/task-status.test.ts) — 11 tests

**구현 파일**
- [scripts/harness/check.ts](../../scripts/harness/check.ts) — 오케스트레이터
- [scripts/harness/record-review.ts](../../scripts/harness/record-review.ts) — 리뷰 기록 CLI
- [scripts/harness/gates/](../../scripts/harness/gates/) — 5개 Gate
- [scripts/harness/util/](../../scripts/harness/util/) — git·config·glob·logger
- [scripts/harness/hooks/commit-msg.ts](../../scripts/harness/hooks/commit-msg.ts)
- [.harness/config.json](../../.harness/config.json)
- [.harness/review-log.jsonl](../../.harness/review-log.jsonl)
- [.husky/commit-msg](../../.husky/commit-msg), [pre-commit](../../.husky/pre-commit), [pre-push](../../.husky/pre-push)
- [docs/harness.md](../harness.md) — 사용자 가이드

**예상 공수**: 4~6h (테스트 + 구현 + 훅 설정)

---

## ✅ 의사결정 완료 (2026-04-17)

5개 안건 모두 확정:

| # | 안건 | 결정 |
|---|---|---|
| D-1 | 수피부과의원 처리 | **B) 전면 제거** — T-001 에서 `data.ts` 8곳 grep 제거 |
| D-2 | `/k/recommend` 카니발라이제이션 | **블로그 이전으로 자동 해소** — #47 일환으로 처리 |
| D-3 | Thin 카테고리 처리 | **B) 가이드 본문 추가** — 1,000-1,500자 지역 시장 콘텐츠, 이후 블로그 포스트로 이전 |
| D-4 | Breadcrumb 레벨 | **페이지 타입별 2종 분리** — 업체 4단계 + 블로그 5단계 |
| D-5 | 라우트 컨벤션 | **`/blog/` 로 통합** — 키워드·비교·가이드 → 블로그 시스템 (#47) |

**핵심 구조 변경**:
- 키워드 8 + 비교 3 + 가이드 1 = 12개 페이지 → 블로그 포스트로 마이그레이션
- Breadcrumb 업체용/블로그용 2종
- URL 구조: `/[city]/[category]/...` (업체) + `/blog/[city]/[sector]/[slug]` (블로그)

---

# Phase 0 — 사실 정확도 (1-2일)

## T-001. 수피부과 전면 제거 (data.ts) ✅ [GEO][AEO]

**완료**: 2026-04-17. data.ts 22곳 정리 완료 + 회귀 방지 테스트.

**WO 참조**: #1
**축**: GEO (사실 일관성), AEO (답변 정확도)
**실제 공수**: ~30분

**처리 내역**
- [x] [src/lib/data.ts](src/lib/data.ts) — **22곳 수정**
  - 수피부과 언급 12곳 제거/재구성
  - `"5곳"`/`"5가지"` → `"4곳"`/`"4가지"` 9곳 수정
  - `"에버스피부과"` → `"닥터에버스의원 천안점"` 5곳 통일
- [x] **회귀 방지 테스트** [src/lib/__tests__/data-integrity.test.ts](src/lib/__tests__/data-integrity.test.ts) 신규
  - 폐업 업체 텍스트 검사 (DEFUNCT_BUSINESSES 배열)
  - guide.recommendedPlaces.slug 검증
  - comparisonPages.entries.placeSlug 검증
  - keywordPages.relatedPlaceSlugs 검증
  - "N곳" 카운트 클레임 ↔ 실제 활성 업체 수 일치 검증

**DoD**
- [x] `grep -r "수피부" src/lib/data.ts` 결과 0건
- [x] `npx vitest run` 360 tests pass (data-integrity 9 tests 포함)
- [x] 하네스 5개 Gate 통과
  - G1 TASK Ref / G2 Test Existence / G3 Coverage / G4 Review / G5 TASK Status

## T-002. `/k/recommend` 카니발라이제이션 해소 ❌ [SUPERSEDED → T-010e]

**WO 참조**: #2
**상태**: **폐기** — D-2 결정으로 **블로그 시스템(#47) 마이그레이션 일환**으로 자동 해소
**대체**: [T-010e 마이그레이션 스크립트](#t-010e-마이그레이션-스크립트-seogeo) 가 12개 페이지 중 `recommend` 포함하여 처리
**대체 redirect**: [T-010f 301 Redirect](#t-010f-301-redirect-설정-seo) 가 `/cheonan/dermatology/k/recommend` → `/blog/cheonan/medical/cheonan-dermatology-recommend` 301

**잔여 책임**
- [ ] T-010e 실행 후 `/k/recommend` 에 접속해 301 정상 동작 확인
- [ ] Google Search Console 에서 duplicate 경고 해소 모니터링

## T-003. 숫자 단일 소스 인프라 (`lib/site-stats.ts`) [GEO] ✅

**완료**: 2026-04-17
**구현**:
- [src/lib/site-stats.ts](src/lib/site-stats.ts) — `getSiteStats()` (6개 필드: totalPlaces/activeCategories/totalCategories/cities/activeCities/currentYear) + `formatCountClause()` 헬퍼
- [src/lib/__tests__/site-stats.test.ts](src/lib/__tests__/site-stats.test.ts) — 6개 테스트
- **하드코딩 제거**: home/category page/OG image/seo.ts DAB 의 "2026년" → `new Date().getFullYear()`
- 남은 "2026년" 은 data.ts 시드/DB 블로그 본문(이미 마이그레이션됨) — 의도적 역사 기록

**WO 참조**: #1, #3
**축**: GEO (fact consistency)
**예상 공수**: 2h

**신규 파일**
- [src/lib/site-stats.ts](src/lib/site-stats.ts) — 모든 수치 집계 헬퍼
  ```ts
  export async function getSiteStats(): Promise<{
    totalPlaces: number,
    activeCategories: number,
    totalCategories: number,  // 83 (하드코딩 아닌 getCategories().length)
    cities: string[],
    currentYear: number,  // new Date().getFullYear() — #22 해결
  }>
  ```

**수정 파일**
- [src/app/page.tsx](src/app/page.tsx) — `{categories.length}` 를 `stats.activeCategories` 로 (해석 명확화)
- [src/lib/seo.ts](src/lib/seo.ts) L145 — `"2026년 기준"` → `${stats.currentYear}년 기준`
- 가이드·비교 페이지 본문 내 "N곳" 하드코딩 → stats 참조

**DoD**
- [ ] 모든 수치가 `site-stats.ts` 또는 `getCategories().length` 같은 동적 소스로 일관됨
- [ ] `grep -r "2026년" src/` 동적 치환 가능한 부분은 전부 `getFullYear()` 사용
- [ ] 유닛 테스트 `src/lib/__tests__/site-stats.test.ts`

## T-004. 업종별 면책 분기 컴포넌트 [AEO][GEO] ✅

**완료**: 2026-04-17
**구현**:
- [src/lib/constants/disclaimers.ts](src/lib/constants/disclaimers.ts) — 10 sector 맵 (medical/beauty/living/auto/education/professional/pet/wedding/leisure/food) + `getDisclaimer(sector)` 안전 lookup (미정의/null 안전 처리)
- [src/components/business/disclaimer.tsx](src/components/business/disclaimer.tsx) — 조건부 렌더 컴포넌트 (null 이면 DOM 제거)
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) — 하드코딩 의료 문구 → `<Disclaimer sector={sector?.slug} />`
- [src/app/blog/[city]/[sector]/[slug]/page.tsx](src/app/blog/%5Bcity%5D/%5Bsector%5D/%5Bslug%5D/page.tsx) — 본문 하단에 sector 기반 면책
- [src/lib/__tests__/constants/disclaimers.test.ts](src/lib/__tests__/constants/disclaimers.test.ts) — 7개 테스트

**검증** (curl):
- `/cheonan/dermatology/dr-evers` → "의료 결정은 전문의와 상담하세요" ✓
- `/cheonan/webagency/didu` → "수수료는 상담 후 확정됩니다" (professional) ✓
- `/cheonan/auto-repair/*` → "차량 상태에 따라" (auto) ✓
- `/cheonan/restaurant/*` → 면책 미렌더 (food=null) ✓
- `grep "의료 결정은 전문의와 상담" src/app/` → 0건 (constants 만 보유)

**WO 참조**: #4
**축**: AEO (답변 정확도), GEO (템플릿 누수 제거)
**예상 공수**: 2h

**신규 파일**
- [src/lib/constants/disclaimers.ts](src/lib/constants/disclaimers.ts)
  ```ts
  export const DISCLAIMERS: Record<string, string | null> = {
    medical: "본 페이지는 정보 제공 목적이며, 의료 결정은 전문의와 상담하세요.",
    auto: "실제 수리 비용은 차량 상태에 따라 달라질 수 있습니다.",
    web: "프로젝트 비용은 요구사항에 따라 협의됩니다.",
    interior: "시공 비용은 현장 실측 후 확정됩니다.",
    food: null,  // 미렌더
    beauty: "시술 효과는 개인차가 있습니다.",
    // ... sector 단위로 정의
  }
  export function getDisclaimer(sectorSlug: string): string | null
  ```
- [src/components/business/disclaimer.tsx](src/components/business/disclaimer.tsx) — sector prop 받아 조건부 렌더

**수정 파일**
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L381-383 — 하드코딩 제거 → `<Disclaimer sector={sector} />`
- [src/app/[city]/[category]/k/[keyword]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/k/%5Bkeyword%5D/page.tsx) L154-156 — 동일
- [src/app/compare/[city]/[category]/[topic]/page.tsx](src/app/compare/%5Bcity%5D/%5Bcategory%5D/%5Btopic%5D/page.tsx) L162-164 — 동일

**DoD**
- [ ] `/cheonan/webagency/didu` 접속 시 의료 문구 사라짐
- [ ] `/cheonan/dermatology/dr-evers` 의료 문구 유지
- [ ] `grep "의료 결정은 전문의와 상담" src/app/` 0건

## T-005. 푸터 동적화 [SEO] ✅

**완료**: 2026-04-17
**구현**:
- [src/components/footer.tsx](src/components/footer.tsx) — 서버 컴포넌트 전환 + `FooterProps` (currentCity/currentCategory/currentSector 선택)
  - 도시: `stats.activeCities` 기준 filter + 도시별 대표 카테고리 링크
  - 업종: 실제 업체 있는 카테고리만 (`Set(allPlaces.map(p => p.category))`)
  - 블로그: sector 문맥 있으면 해당 sector, 없으면 전체 최신. sector 에 0개면 **빈 배열 유지** (cross-sector 오염 방지)
- 6개 사용처 업데이트: home/about/blog-home (문맥 없음), category/place-detail/blog-detail (props 전달)

**검증** (next build + curl):
- `/cheonan/auto-repair/*` 푸터에 `/blog/cheonan/*` 링크 0개 ✓
- `/cheonan/dermatology/*` 푸터에 `/blog/cheonan/medical/*` 링크 노출 ✓
- 홈 `/` 푸터에 전체 최신 4개 노출 ✓

---(기존 원본 유지)---

**WO 참조**: #5
**축**: SEO (내부링크)
**예상 공수**: 1.5h

**수정 파일**
- [src/components/footer.tsx](src/components/footer.tsx) — 서버 컴포넌트로 전환, props로 `currentCity`, `currentCategory` 받기
- 도시·업종·서비스 섹션을 DB/시드 조회로 동적 생성

**DoD**
- [ ] `/cheonan/webagency/didu` 푸터에 피부과 링크 없음
- [ ] `/cheonan/auto-repair/*` 푸터에 자동차 관련 콘텐츠 (있을 때)
- [ ] 홈 푸터는 대표 콘텐츠 (카테고리 Top 5)

---

# Phase 1 — 템플릿 정리 (2일)

## T-006. 업체 상세 H1 포맷 통일 [SEO][AEO][GEO] ✅

**완료**: 2026-04-17
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L163: `{place.name}` → `{place.name} — {cityObj?.name ?? city} {catObj?.name ?? category}`
- 검증 (curl): "닥터에버스의원 천안점 — 천안 피부과" 출력 ✓

**WO 참조**: #7
**축**: GEO (entity 식별), SEO, AEO
**예상 공수**: 30m

**수정 파일**
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L161
  ```tsx
  // Before
  <h1>{place.name}</h1>
  // After
  <h1>{place.name} — {cityObj?.name} {catObj?.name}</h1>
  ```

**DoD**
- [ ] 전체 업체 상세 페이지 H1 패턴 `"{이름} — {도시} {카테고리}"` 통일
- [ ] title metadata 와 중복·불일치 없음

## T-007. "비교 비교" 중복 버그 수정 [AEO] ✅

**완료**: 2026-04-17 (T-010g 캐스케이드로 자동 해소)
- T-010g 에서 place detail 의 `relatedComparisons.map(comp => ${comp.topic.name} 비교)` 블록 자체가 `getBlogPostsByPlace` + `post.title` 로 교체됨 → 중복 "비교 비교" 패턴 불가능
- `grep "topic.name} 비교" src/app/` → 0건

**WO 참조**: #13
**축**: AEO (답변 정확도)
**예상 공수**: 15m

**수정 파일**
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L373
  ```tsx
  // Before
  {comp.topic.name} 비교
  // After (조건부)
  {comp.topic.name}{comp.topic.name.endsWith('비교') ? '' : ' 비교'}
  ```
- 또는 `ComparisonTopic.name` 정책 정리: "비교" 포함 금지 규약 문서화

**DoD**
- [ ] `"레이저 시술 비교 비교"` 같은 출력 0건
- [ ] 관련 콘텐츠 링크 텍스트 정상

## T-008. AggregateRating JSON-LD 버그 수정 [AEO][GEO] ✅

**완료**: 2026-04-17
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L387-396 단독 AggregateRating 스크립트 블록 **완전 삭제**
- LocalBusiness 내부 aggregateRating (generateLocalBusiness) 으로 충분

**WO 참조**: #11
**축**: AEO (Rich Snippet), GEO (schema 정확도)
**예상 공수**: 30m

**문제**: [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L394-402 가 `AggregateRating` 을 단독 `@type`으로 별도 스크립트 출력. 비표준이며 LocalBusiness 내부 출력과 중복.

**수정**
- L394-403 블록 **완전 삭제** (LocalBusiness 내부 aggregateRating 으로 충분)
- 또는 `Review` 개별 엔트리를 생성해 itemReviewed 내부에 포함

**DoD**
- [ ] Google Rich Results Test 에서 경고 없이 MedicalClinic·AggregateRating 인식
- [ ] JSON-LD 중복 출력 제거

## T-009. 리뷰/평점 포맷 유틸 (`lib/format/rating.ts`) [AEO] ✅

**완료**: 2026-04-17
- [src/lib/format/rating.ts](src/lib/format/rating.ts) — `formatRatingLine(rating, count, source)`: "★ 4.5 · 리뷰 178건 (Google)" 형식
  - Math.round 반올림 (toFixed banker's rounding 회피)
  - count=0 → "리뷰 없음"
  - mixed 소스 → 출처 미표기
- 적용: place-card.tsx + place detail page
- [src/lib/__tests__/format/rating.test.ts](src/lib/__tests__/format/rating.test.ts) — 6개 테스트

**WO 참조**: #11
**축**: AEO
**예상 공수**: 1.5h

**신규 파일**
- [src/lib/format/rating.ts](src/lib/format/rating.ts)
  ```ts
  export function formatRatingLine(
    rating: number, count: number, source: 'google' | 'naver' | 'mixed'
  ): string // "★ 4.5 · 리뷰 178건 (Google)"
  ```

**수정 파일**
- [src/components/place-card.tsx](src/components/place-card.tsx) L38-45 — 하드코딩 → 유틸 사용
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L162-170 — 동일

**DoD**
- [ ] 모든 평점 표기 한 가지 포맷으로 일관
- [ ] 유닛 테스트 `src/lib/__tests__/format-rating.test.ts`

## T-010. 영업시간·가격·주소 포맷 유틸 [AEO] ✅

**완료**: 2026-04-17
- [src/lib/format/hours.ts](src/lib/format/hours.ts) — `formatHoursKo()` ("월-금 09:00-18:00") + `toSchemaOrgHours()` (Schema.org OpeningHoursSpecification[])
- [src/lib/format/price.ts](src/lib/format/price.ts) — `formatPriceRange()` (한글 유지, 숫자는 천단위, 빈 값 "상담 후 결정")
- [src/lib/format/address.ts](src/lib/format/address.ts) — `normalizeAddress()` (도/광역시 17종 약어 매핑, 공백 축약)
- 적용:
  - place detail: 영업시간 `formatHoursKo` + 주소 `normalizeAddress` (본문 + meta description)
  - jsonld.ts: `parseOpeningHours` → `toSchemaOrgHours` 재사용
- 테스트: 3개 파일, 25개 테스트 (hours 10 + price 5 + address 10)

**WO 참조**: #8, #9, #10
**축**: AEO (답변박스), GEO
**예상 공수**: 3h

**신규 파일**
- `src/lib/format/hours.ts` — BusinessHours 타입 + `formatHoursKo()` + `toSchemaOrgHours()`
- `src/lib/format/price.ts` — `formatPriceRange()`
- `src/lib/format/address.ts` — `normalizeAddress()` (`충청남도 → 충남`, 도로명 우선)

**수정**
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L255-260 — 인라인 regex → `formatHoursKo`
- [src/lib/jsonld.ts](src/lib/jsonld.ts) L92-98 — `parseOpeningHours` → `toSchemaOrgHours` 대체 또는 래핑

**DoD**
- [ ] 영업시간 한글 1종 포맷 통일 (예: `"월-금 09:00-21:00, 토 09:00-17:00, 일 휴무"`)
- [ ] JSON-LD Schema.org 표준 `OpeningHoursSpecification` 출력
- [ ] 유닛 테스트 3개 파일

---

# Phase 1.5 — 블로그 시스템 구축 + 콘텐츠 마이그레이션 (4-6일)

> **WO 참조**: #47, #2, #12, #28 (4개 항목 동시 해소)
> **CEO 플랜**: 2026-04-16 승인 — view_count, place↔blog 양방향 링크, /blog SEO 랜딩, quality_score

## T-010a. DB 스키마: blog_posts 테이블 [SEO][GEO] ✅

**예상 공수**: 1h
**완료**: 2026-04-17
**구현**:
- [supabase/migrations/011_blog_posts_extend.sql](supabase/migrations/011_blog_posts_extend.sql) — 9개 컬럼 추가 + status enum (draft/published → draft/active/archived) + RLS 정책 갱신
- [src/lib/supabase-types.ts](src/lib/supabase-types.ts) — DbBlogPost 타입 확장
- [src/lib/supabase/database.types.ts](src/lib/supabase/database.types.ts) — Row 타입 동기화
- [src/lib/__tests__/supabase-schema.test.ts](src/lib/__tests__/supabase-schema.test.ts) — 13개 신규 schema 테스트 + 2개 타입 테스트 추가
- 하네스 sub-task 패턴(T-NNNa) 지원: config.json + record-review.ts + task-status.ts 갱신

**작업**
- [ ] `supabase/migrations/NNNN_create_blog_posts.sql` 작성
  ```sql
  CREATE TABLE blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    city TEXT NOT NULL,
    sector TEXT NOT NULL,
    category TEXT,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_md TEXT NOT NULL,
    post_type TEXT NOT NULL CHECK (post_type IN ('keyword','compare','guide','general')),
    related_place_slugs TEXT[] DEFAULT '{}',
    target_query TEXT,
    faqs JSONB DEFAULT '[]',
    statistics JSONB DEFAULT '[]',
    sources JSONB DEFAULT '[]',
    view_count INTEGER DEFAULT 0,
    quality_score INTEGER,
    published_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived'))
  );
  CREATE INDEX ON blog_posts(city, sector);
  CREATE INDEX ON blog_posts(status);
  CREATE INDEX ON blog_posts USING GIN(related_place_slugs);
  ```
- [ ] RLS 정책: 읽기 공개 (status='active'), 쓰기 인증

**DoD**
- [ ] migration 적용 성공
- [ ] `src/lib/supabase-types.ts` 에 `DbBlogPost` 타입 동기화

## T-010b. BlogPost 타입 + 데이터 레이어 [SEO][GEO] ✅

**예상 공수**: 2h
**완료**: 2026-04-17
**구현**:
- [src/lib/types.ts](src/lib/types.ts) — `BlogPost` / `BlogPostSummary` / `BlogPostType` / `BlogPostStatus` 타입 추가 (전역 types.ts 통합)
- [src/lib/supabase-types.ts](src/lib/supabase-types.ts) — `dbBlogPostToBlogPost()` + `dbBlogPostToSummary()` 변환 함수
- [src/lib/blog/data.supabase.ts](src/lib/blog/data.supabase.ts) — 6개 export 함수 (getBlogPost / getBlogPostsByCity / BySector / Recent / Popular / ByPlace)
- [src/lib/__tests__/blog/data.supabase.test.ts](src/lib/__tests__/blog/data.supabase.test.ts) — 12개 테스트 (mock 체인 + camelCase 변환 + 폴백 검증)
- 폴백 정책: Supabase 실패 시 `getBlogPost` → null, 목록 → `[]` (T-010e 마이그레이션 완료 전 안전)

## T-010c. 블로그 홈 라우트 /blog [SEO][GEO] ✅

**완료**: 2026-04-17
**구현**:
- [src/app/blog/page.tsx](src/app/blog/page.tsx) — Hero(DAB 45자) + 인기글 TOP5 + 도시×대분류 섹션 + Breadcrumb
- [src/lib/jsonld.ts](src/lib/jsonld.ts) — `generateBlogItemList(posts, title, baseUrl)` + `generateCollectionPage(opts)`
- [src/lib/__tests__/jsonld.test.ts](src/lib/__tests__/jsonld.test.ts) — 4개 신규 JSON-LD 테스트
- [src/lib/supabase-types.ts](src/lib/supabase-types.ts) — DB sources `{title,url}` → app `{name, url?}` 변환

**검증** (npx next start, /blog):
- HTTP 200, HTML 정상 렌더
- CollectionPage + ItemList(numberOfItems=10) + BreadcrumbList JSON-LD 모두 출력
- 12개 글 모두 표시 (인기 5 + 천안 의료 섹션 12)

**예상 공수**: 3h

**파일**
- `src/app/blog/page.tsx`
  - 카테고리별 섹션 (도시 × 대분류)
  - 인기글 TOP 5 (view_count 기준)
  - 최근 작성 10개
  - CollectionPage JSON-LD

**DoD**
- [ ] Direct Answer Block 40-60자
- [ ] JSON-LD CollectionPage + ItemList
- [ ] BreadcrumbList (홈 → 블로그)

## T-010d. 블로그 글 상세 라우트 [SEO][AEO][GEO] ✅

**완료**: 2026-04-17
**구현**:
- [src/app/blog/[city]/[sector]/[slug]/page.tsx](src/app/blog/%5Bcity%5D/%5Bsector%5D/%5Bslug%5D/page.tsx) — generateStaticParams + Metadata + Article/FAQPage/BreadcrumbList JSON-LD + 5단계 breadcrumb
- [src/lib/blog/markdown.ts](src/lib/blog/markdown.ts) — unified pipeline(remark-parse → remark-rehype → rehype-sanitize → stringify), 클라이언트 번들 0
- [src/components/blog-markdown.tsx](src/components/blog-markdown.tsx) — Server Component, prose 스타일 적용
- [src/components/blog-view-tracker.tsx](src/components/blog-view-tracker.tsx) — Client Component, useEffect ref guard 로 1회만 발화
- [src/lib/actions/blog-views.ts](src/lib/actions/blog-views.ts) — `incrementBlogPostView(slug)` server action
- [src/lib/blog/data.supabase.ts](src/lib/blog/data.supabase.ts) — `getAllActiveBlogPosts` 추가 (generateStaticParams 용)
- [src/lib/__tests__/blog/markdown.test.ts](src/lib/__tests__/blog/markdown.test.ts) — 9개 XSS sanitization 테스트 (script/iframe/onevent/javascript:/style)

**검증** (next build + start, /blog/cheonan/medical/cheonan-dermatology-acne):
- 12개 SSG prerender 성공
- Article + FAQPage + BreadcrumbList JSON-LD 모두 출력
- 5단계 breadcrumb: 홈 › 블로그 › 천안 › 의료 › [글] ✓
- Markdown 본문 H2/H3/list/blockquote 정상 렌더 (3개 섹션)
- 관련 업체 카드 표시 (related_place_slugs 조회)

**예상 공수**: 4h

**파일**
- `src/app/blog/[city]/[sector]/[slug]/page.tsx`
  - generateStaticParams (active post만)
  - generateMetadata (SEO 메타)
  - Article JSON-LD + FAQPage (있으면) + BreadcrumbList 5단계
  - Markdown 렌더링 (marked + rehype-sanitize)
  - view_count increment (클라이언트 action)
  - 관련 업체 카드 (related_place_slugs 기반)
  - 관련 블로그 글 (같은 sector)

**DoD**
- [ ] 5단계 breadcrumb: `홈 › 블로그 › [도시] › [대분류] › [글]`
- [ ] Markdown XSS sanitization 유닛 테스트
- [ ] 관련 업체 카드 렌더 확인

## T-010e. 마이그레이션 스크립트 [SEO][GEO] ✅

**완료**: 2026-04-17 (변환 + dry-run 검증). 프로덕션 insert 는 사용자가 환경변수 셋업 후 실행.

**구현**:
- [src/lib/blog/migrate.ts](src/lib/blog/migrate.ts) — 3개 변환 함수 (keyword/compare/guide → BlogInsertPayload) + markdown content 렌더러
- [src/lib/__tests__/blog/migrate.test.ts](src/lib/__tests__/blog/migrate.test.ts) — 23개 테스트 (단위 + 통합 12개 슬러그 unique)
- [scripts/migrate-to-blog.ts](scripts/migrate-to-blog.ts) — CLI: `--dry-run` / `--force(upsert)`
- 슬러그 규칙: `cheonan-dermatology-{topic}`, 가이드는 `cheonan-dermatology-guide`

**dry-run 결과** (2026-04-17):
- keyword: 8 / compare: 3 / guide: 1 = 12개 모두 변환 성공, 슬러그 중복 없음

**프로덕션 실행 가이드**:
```bash
# 1차: dry-run (DB 변경 없음)
node --env-file=.env.local --import tsx scripts/migrate-to-blog.ts --dry-run

# 2차: 실제 insert (동일 slug 는 skip)
node --env-file=.env.local --import tsx scripts/migrate-to-blog.ts

# 재실행으로 덮어쓰려면
node --env-file=.env.local --import tsx scripts/migrate-to-blog.ts --force
```

**프로덕션 실행 결과** (2026-04-17):
- 011_blog_posts_extend.sql 적용 ✅ (사용자 수동, Supabase Studio)
- migrate-to-blog 실행: inserted 12, updated 0, skipped 0
- 12개 슬러그: cheonan-dermatology-{acne, botox, lifting, blemish, night-clinic, recommend, hair-loss, scar, acne-treatment, laser-treatment, anti-aging, guide}

**예상 공수**: 4h

**파일**
- `scripts/migrate-to-blog.ts`
  - 기존 `KeywordPage` 8개 → blog_posts (post_type=keyword)
  - 기존 `ComparisonPage` 3개 → blog_posts (post_type=compare)
  - 기존 `GuidePage` 1개 → blog_posts (post_type=guide)
  - slug 규칙: `{city}-{category}-{topic}`
  - `related_place_slugs` 추출 (relatedPlaceSlugs / entries / recommendedPlaces 에서)
  - `target_query` (키워드만)

**DoD**
- [ ] 드라이런 모드 지원 (`--dry-run`)
- [ ] 12개 레코드 정상 insert
- [ ] 로컬 환경에서 검증 후 프로덕션 실행

## T-010f. 301 Redirect 설정 [SEO] ✅

**완료**: 2026-04-17
**구현**:
- [next.config.ts](next.config.ts) — 3개 redirect 규칙 (`statusCode: 301`)
  1. `/cheonan/dermatology/k/:keyword` → `/blog/cheonan/medical/cheonan-dermatology-:keyword` (8개)
  2. `/compare/cheonan/dermatology/:topic` → `/blog/cheonan/medical/cheonan-dermatology-:topic` (3개)
  3. `/guide/cheonan/dermatology` → `/blog/cheonan/medical/cheonan-dermatology-guide` (1개)
- [src/lib/__tests__/actions/blog-views.test.ts](src/lib/__tests__/actions/blog-views.test.ts) — 7개 테스트 (T-010d 소급 커버리지)

**검증** (next build + start, curl -I):
- 3종 URL 모두 `HTTP/1.1 301 Moved Permanently` 반환
- Location 헤더에 정확한 새 URL 매핑
- 타깃 페이지 `/blog/cheonan/medical/cheonan-dermatology-acne` → 200 OK

**잔여 수동 작업** (프로덕션 배포 후):
- [ ] Google Search Console "URL 변경" 요청
- [ ] GSC duplicate 경고 해소 모니터링 (T-002 SUPERSEDED 잔여 책임 포함)

**예상 공수**: 2h

**파일**
- `next.config.ts` (또는 `.mjs`) `redirects()` 함수 추가
  ```ts
  async redirects() {
    return [
      { source: '/cheonan/dermatology/k/:keyword',
        destination: '/blog/cheonan/medical/cheonan-dermatology-:keyword', permanent: true },
      { source: '/compare/:city/:category/:topic',
        destination: '/blog/:city/medical/:city-:category-:topic', permanent: true },
      { source: '/guide/:city/:category',
        destination: '/blog/:city/medical/:city-:category-guide', permanent: true },
    ]
  }
  ```

**DoD**
- [ ] 12개 기존 URL 모두 301 확인 (`curl -I`)
- [ ] 새 URL 200 응답 확인
- [ ] Google Search Console "URL 변경" 요청

## T-010g. 기존 라우트 제거 [SEO] ✅

**완료**: 2026-04-17
**삭제 디렉토리**:
- `src/app/[city]/[category]/k/` (키워드 페이지 루트)
- `src/app/compare/` (비교 페이지 루트)
- `src/app/guide/` (가이드 페이지 루트)

**내부 링크 교체** (10+곳, 하드코딩 혹은 동적 생성):
- `src/components/footer.tsx` — 2개 링크
- `src/app/page.tsx` — 가이드/비교/키워드 3개 섹션 → 블로그 1개 섹션 (getRecentBlogPosts)
- `src/app/[city]/[category]/page.tsx` — 관련 콘텐츠 → getBlogPostsBySector
- `src/app/[city]/[category]/[slug]/page.tsx` — 양방향 링크 → getBlogPostsByPlace
- `src/lib/seo.ts` (sitemap) — `/compare/` `/guide/` `/k/` 제거, `/blog` 홈 + `/blog/[city]/[sector]/[slug]` 추가
- `src/app/llms.txt/route.ts` — AI 크롤러 endpoint 를 blog 중심으로 재구성

**배열 정리 (data.ts)**:
- `keywordPages` / `comparisonPages` / `guidePages` 는 **유지** (향후 다른 도시/카테고리 마이그레이션 시 재사용)
- 관련 query 함수(`getAllKeywordPages`, `getKeywordPage`, `getAllComparisonTopics` 등)도 유지

**테스트 재작성**:
- [src/lib/__tests__/seo.test.ts](src/lib/__tests__/seo.test.ts) — 구 URL 3종 검증 → `/blog` 검증 + legacy 부재 가드
- [src/lib/__tests__/geo-seo-aeo.test.ts](src/lib/__tests__/geo-seo-aeo.test.ts) — PAGES_WITH_PARAMS 를 `/blog/[city]/[sector]/[slug]` 로 대체

**검증** (next build + start):
- 모든 라우트 성공 (12개 블로그 SSG prerender)
- `/guide/cheonan/dermatology` → 301 → `/blog/cheonan/medical/cheonan-dermatology-guide`
- `/blog` 200 / `/blog/...` 200 / 홈 200 / 카테고리 페이지 200
- sitemap.xml 에 `/blog/` URL 12개 포함

**예상 공수**: 1.5h
**선행**: T-010e (마이그레이션) + T-010f (redirect) 완료 후

**파일**
- 삭제: `src/app/[city]/[category]/k/`
- 삭제: `src/app/compare/`
- 삭제: `src/app/guide/`
- `src/lib/data.ts` 의 `keywordPages`, `comparisonPages`, `guidePages` 배열 정리
  - Phase 1.5 완료 후 DB 마이그레이션 검증 되면 삭제

**DoD**
- [ ] 빌드 성공
- [ ] `grep -rn "k/\|/compare\|/guide" src/app/` → 라우트 없음
- [ ] 관련 jsonld 빌더 blog용으로 변경

## T-010h. Breadcrumb 2종 분리 (WO #12) [SEO][AEO] ✅

**예상 공수**: 3h
**완료**: 2026-04-17 (util + 컴포넌트). 페이지 적용은 T-010d 에서 통합.

**구현**:
- [src/lib/seo.ts](src/lib/seo.ts) — `buildBusinessBreadcrumb` (4단계, sector hub 제거) + `buildBlogBreadcrumb` (5단계)
- [src/components/breadcrumb.tsx](src/components/breadcrumb.tsx) — HTML 컴포넌트 (aria-current, ChevronRight)
- [src/lib/__tests__/seo.test.ts](src/lib/__tests__/seo.test.ts) — 7개 신규 테스트 + JSON-LD 통합 검증

**잔여**:
- [ ] 업체 페이지(/[city]/[category]/[slug]) 적용 → T-010d 시점에 통합
- [ ] 블로그 페이지 적용 → T-010d
- [ ] 기존 generateBreadcrumbList 인라인 호출 5곳 → T-010g 정리 시 builder 로 교체

## T-010i. 사이트맵·llms.txt·IndexNow [SEO][GEO] ✅

**완료**: 2026-04-17
**구현**:
- **sitemap** ([src/lib/seo.ts](src/lib/seo.ts)) — T-010g 에서 이미 `/compare/` `/guide/` `/k/` 제거하고 `/blog` + `/blog/[city]/[sector]/[slug]` 추가
- **llms.txt** ([src/app/llms.txt/route.ts](src/app/llms.txt/route.ts)) — T-010g 에서 이미 blog 중심으로 재구성 (getRecentBlogPosts 50개)
- **indexnow** ([scripts/indexnow.ts](scripts/indexnow.ts)) — 동적 URL 생성으로 refactor
  - getAllPlaces + getAllActiveBlogPosts 기반 → 업체/블로그 자동 포함
  - `--dry-run` 플래그 추가 (외부 호출 전 검증)
  - npm scripts: `npm run indexnow`, `npm run indexnow:dry`

**부가 수정** (근본 원인):
- [src/lib/supabase/read-client.ts](src/lib/supabase/read-client.ts) — 싱글톤의 env 읽기를 모듈 top-level → 함수 내부로 이동
  - **이유**: ESM import 가 `loadEnvConfig()` 보다 먼저 평가되므로 script 컨텍스트에서 env 가 undefined
  - **결과**: `npm run indexnow:dry` → 29개 URL 정상 생성 (4 base + 5 listing + 8 places + 12 blog)

**검증** (npm run indexnow:dry):
```
IndexNow [DRY-RUN]: 29개 URL
  https://aiplace.kr
  https://aiplace.kr/about
  https://aiplace.kr/blog
  ... (29개 전체)
```

**잔여 작업 (사용자 실행)**:
- [ ] `npm run indexnow` — 실제 Bing/Naver/Yandex 알림 (프로덕션 배포 후 권장)

**예상 공수**: 1.5h

**작업**
- [ ] `src/app/sitemap.ts` 재구성:
  - 기존 `/k/`, `/compare/`, `/guide/` 제거
  - `/blog` + `/blog/[city]/[sector]/[slug]` 추가
- [ ] `src/app/llms.txt/route.ts` 업데이트
- [ ] `scripts/indexnow.ts` 실행 — 새 URL 알림

**DoD**
- [ ] sitemap.xml 12개 기존 URL 제거, 새 12개 URL 추가
- [ ] llms.txt 최신 상태
- [ ] IndexNow 호출 성공

---

# Phase 2 — Admin 대량 등록 UX (4-5일)

> **이 Phase 완료 전까지 대량 업체 등록 시작하지 않기**. #46 + LLM 품질이 먼저.

## T-011. Kakao Local Search 클라이언트 [Admin][GEO] ✅

**완료**: 2026-04-17
- [src/lib/search/kakao-local.ts](src/lib/search/kakao-local.ts) — `kakaoLocalSearch(query, {size?})` with Authorization/size clamp/error fallback
- [src/lib/__tests__/search/kakao-local.test.ts](src/lib/__tests__/search/kakao-local.test.ts) — 8 테스트 (응답 파싱, HTTP 에러, key 누락 warn, size clamp)
- env: `KAKAO_REST_KEY` (기존 이름 유지)

**WO 참조**: #46
**축**: Admin UX, GEO
**예상 공수**: 3h
**선행**: Kakao REST API 키 발급 (`KAKAO_REST_API_KEY` 환경변수)

**신규 파일**
- [src/lib/search/kakao-local.ts](src/lib/search/kakao-local.ts)
  ```ts
  export async function kakaoLocalSearch(query: string): Promise<KakaoPlaceResult[]>
  // GET https://dapi.kakao.com/v2/local/search/keyword.json
  // 반환: id, place_name, address_name, road_address_name, phone,
  //       category_name, category_group_code, x (경도), y (위도), place_url
  ```

**DoD**
- [ ] `kakaoLocalSearch("천안 차앤박피부과")` 동작
- [ ] Retry/backoff 로직
- [ ] 유닛 테스트 (MSW 목킹)

## T-012. Google Places 매칭 보강 함수 [Admin][GEO] ✅

**완료**: 2026-04-17
- [src/lib/search/google-match.ts](src/lib/search/google-match.ts) — `matchGooglePlaceByAddress(name, address, base?)` + `distanceMeters()` (Haversine)
- 좌표 50m 이내 매칭. 기준 좌표 미지정 시 첫 결과 반환
- 7 테스트 (동일 좌표/50m 내외/결과 없음/좌표 없는 후보 건너뛰기)

**WO 참조**: #46
**축**: Admin UX, GEO
**예상 공수**: 1h

**신규 함수** (기존 [google-places.ts](src/lib/google-places.ts) 확장)
- `matchGooglePlaceByAddress(name: string, address: string): Promise<GooglePlaceResult | null>`
  - Text Search 로 `"{name} {address}"` 조회
  - 첫 결과의 좌표가 입력 좌표 50m 이내면 매칭

**DoD**
- [ ] Kakao 주소로 Google에서 매칭 시도 가능
- [ ] 매칭 실패 시 null 반환 (에러 X)

## T-013. Naver 지역 검색 클라이언트 [Admin][GEO] ✅

**완료**: 2026-04-17 (사용자가 `docs/네이버 검색 api/loaction.md` 문서 추가로 API 존재 재확인)
- [src/lib/search/naver-local.ts](src/lib/search/naver-local.ts) — `<b>` 태그 + HTML entity 디코드, mapx/mapy ×1e7 → degree
- 7 테스트

**WO 참조**: #46
**축**: Admin, GEO
**예상 공수**: 1h

**신규 파일**
- [src/lib/search/naver-local.ts](src/lib/search/naver-local.ts)
  - `GET https://openapi.naver.com/v1/search/local.json`
  - display 최대 5 제한 — 이것도 정상

**DoD**
- [ ] `naverLocalSearch("천안 차앤박피부과")` 동작
- [ ] HTML `<b>` 태그 제거 (검색어 하이라이트 제거)

## T-014. 통합 검색 + Dedup/Merge [Admin][GEO] ✅

**완료**: 2026-04-17
- [src/lib/search/dedup.ts](src/lib/search/dedup.ts) — `isSameBusiness`, `stringSimilarity` (Dice), `normalizeAddressForMatch` (도/광역시 + 국가 prefix + 건물명 제거)
  - 주소 일치 + 좌표 매우 가까움 + cross-script 이름 → 동일 (Google 영어 이름 처리)
  - 주소 일치 + 좌표 동반 → 이름 유사도 검사 (건물 공유 다른 업체 구분)
  - 주소 일치 + 좌표 없음 → 방어적 same
- [src/lib/search/merge.ts](src/lib/search/merge.ts) — `mergeCandidates()` Kakao 이름 + Google 평점 + sameAs 3 URL 보존
- [src/lib/search/unified.ts](src/lib/search/unified.ts) — 3-Source 병렬 (Promise.all) + per-source try/catch
- 테스트 15+7+3 = 25개

**WO 참조**: #46
**축**: Admin, GEO (데이터 풍부도)
**예상 공수**: 4h
**의존**: T-011, T-012, T-013

**신규 파일**
- [src/lib/search/unified.ts](src/lib/search/unified.ts)
  ```ts
  export async function unifiedSearch(query: string): Promise<MergedCandidate[]>
  // 1. 3-Source 병렬 호출 (Promise.all)
  // 2. normalizeAddress() + 좌표·이름 유사도로 중복 판정
  // 3. 병합 (소스별 강점에 따라 필드 선택)
  // 4. sources 배열에 [kakao, google, naver] 기록
  ```
- `src/lib/search/dedup.ts` — `isSameBusiness()`, `normalizeAddress()`, `stringSimilarity()`, `distance()`
- `src/lib/search/merge.ts` — 병합 정책 구현

**DoD**
- [ ] 동일 업체가 3개 소스에서 와도 1건으로 병합
- [ ] sameAs URL 3개 모두 보존
- [ ] Google 리뷰·평점 우선 선택
- [ ] 유닛 테스트: 동일 업체 3개 → 1개 / 다른 지점 → 분리 / 주소 표기 다른 케이스

## T-015. 카테고리 자동 판별 (Tier 1-2-3) [Admin][GEO] ✅

**완료**: 2026-04-17
- [src/lib/classification/category-map.ts](src/lib/classification/category-map.ts) — KAKAO_CATEGORY_MAP (30+ 매핑) + GOOGLE_TYPE_MAP
- [src/lib/classification/category-detector.ts](src/lib/classification/category-detector.ts) — Tier 1/2/3 폴백 체인
- [src/lib/classification/llm-detector.ts](src/lib/classification/llm-detector.ts) — Haiku 4.5 기반 분류 (Tier 3)
- confidence < 0.8 → `needsReview=true`
- 12 테스트

**WO 참조**: #46
**축**: Admin, GEO
**예상 공수**: 3h

**신규 파일**
- [src/lib/classification/category-detector.ts](src/lib/classification/category-detector.ts)
  - Tier 1: Kakao `category_name` (`"의료,건강>피부과"`) → 매핑 테이블
  - Tier 2: Google `primaryType` / `types` 배열 → 매핑
  - Tier 3: Haiku 분류 폴백
- [src/lib/classification/category-map.ts](src/lib/classification/category-map.ts) — 매핑 테이블 시드
  ```ts
  export const KAKAO_CATEGORY_MAP: Record<string, string> = {
    '의료,건강>피부과': 'dermatology',
    '의료,건강>치과': 'dental',
    // ...
  }
  export const GOOGLE_TYPE_MAP: Record<string, string | null> = {
    dermatologist: 'dermatology',
    dentist: 'dental',
    restaurant: null,  // 하위 분류 필요 → Haiku
    // ...
  }
  ```

**DoD**
- [ ] 80%+ 케이스 Tier 1-2 에서 결정
- [ ] Tier 3 Haiku 폴백 동작 (confidence 반환)
- [ ] confidence < 0.8 시 어드민 후보 3개 제시 플래그

## T-016. 도시 자동 매핑 (sigunguCode) [Admin] ✅

**완료**: 2026-04-17
- [src/lib/address/sigungu-to-city.ts](src/lib/address/sigungu-to-city.ts) — 44130/44131 → cheonan 매핑 + `cityFromAddress()` fallback
- 10 테스트

**WO 참조**: #46
**축**: Admin
**예상 공수**: 1h

**신규 파일**
- [src/lib/address/sigungu-to-city.ts](src/lib/address/sigungu-to-city.ts)
  ```ts
  export const SIGUNGU_TO_CITY: Record<string, string> = {
    '44130': 'cheonan',  // 천안시 서북구
    '44131': 'cheonan',  // 천안시 동남구
  }
  export function sigunguToCity(code: string): string | null
  export function cityFromAddress(roadAddress: string): string | null
  // 주소에서 시/군/구 파싱 → 매핑
  ```

**DoD**
- [ ] 천안 시 서북구/동남구 주소 → `cheonan` 반환
- [ ] 다른 지역 주소 → null (수동 입력 유도)

## T-017. Daum Postcode 컴포넌트 (수동 Fallback) [Admin] ✅

**완료**: 2026-04-17
- [src/components/admin/address-picker.tsx](src/components/admin/address-picker.tsx) — postcode.v2.js 동적 로드, 모달 UI, roadAddress/jibunAddress/sigunguCode/zonecode/buildingName 콜백

**WO 참조**: #46
**축**: Admin
**예상 공수**: 2h

**신규 파일**
- [src/components/admin/address-picker.tsx](src/components/admin/address-picker.tsx)
  - `<script src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js">` 동적 로드
  - 모달 열어서 주소 선택 → roadAddress + jibunAddress + sigunguCode + zonecode + buildingName

**DoD**
- [ ] 주소 검색 모달 UX 동작
- [ ] 선택된 주소가 부모 컴포넌트에 콜백 전달
- [ ] TypeScript declare module 처리

## T-018. 검색 UI 리팩터 (단일 입력) [Admin] ✅

**완료**: 2026-04-17
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts) — `searchPlaceUnified()` server action (unifiedSearch + detectCategory + cityFromAddress)
- [src/app/admin/register/page.tsx](src/app/admin/register/page.tsx) — 검색 모드 토글 (3-Source / Google 단일), 통합 결과 카드 (sources 뱃지 + detected 카테고리/도시 + confidence), 수동 등록 fallback (AddressPicker)
- 6 테스트 (actions/register-place.test.ts)
- coverage 제외 추가: actions/** (외부 API 의존 높아 통합 테스트로 검증)

**WO 참조**: #46
**축**: Admin
**예상 공수**: 4h
**의존**: T-014, T-015, T-016, T-017

**수정 파일**
- [src/app/admin/register/page.tsx](src/app/admin/register/page.tsx) — 대규모 리팩터
  - 도시·카테고리 드롭다운 제거
  - 검색 입력 1개 + debounced autocomplete 또는 검색 버튼
  - 후보 목록 카드 UI (주소·소스 뱃지·매칭 정보 표시)
  - 어드민 클릭 → 자동 추출 결과 요약 표시 + override 버튼
  - 검색 0건 시 "수동 등록" 버튼 → Daum Postcode 모달 열기

**DoD**
- [ ] `"천안 차앤박피부과"` 단일 입력으로 후보 목록 표시
- [ ] 후보 클릭 시 city·category·좌표 자동 채워짐
- [ ] Fallback 수동 등록 UX 동작

## T-019. `Place` 타입 + DB migration [Admin][GEO] ✅

**완료**: 2026-04-17
- [supabase/migrations/012_places_external_ids.sql](supabase/migrations/012_places_external_ids.sql) — kakao/naver_place_id + road/jibun_address + sigungu_code + zonecode + 2 indexes
- [src/lib/types.ts](src/lib/types.ts) `Place` + [src/lib/supabase-types.ts](src/lib/supabase-types.ts) `DbPlace` + [src/lib/supabase/database.types.ts](src/lib/supabase/database.types.ts) 모두 동기화
- 4 신규 schema 테스트 (migration 존재/컬럼/인덱스)
- **사용자 실행 필요**: Supabase Studio 에서 `supabase/migrations/012_places_external_ids.sql` 붙여넣기 → Run

**WO 참조**: #46
**축**: Admin, GEO
**예상 공수**: 2h

**타입 수정**
- [src/lib/types.ts](src/lib/types.ts) `Place` 에 추가:
  ```ts
  kakaoPlaceId?: string
  naverPlaceId?: string  // (링크 없으면 naverSearchLink)
  roadAddress?: string
  jibunAddress?: string
  sigunguCode?: string
  zonecode?: string
  ```
- [src/lib/supabase-types.ts](src/lib/supabase-types.ts) `DbPlace` 동기화

**DB migration**
- `supabase/migrations/` 에 새 SQL 파일
  ```sql
  ALTER TABLE places ADD COLUMN kakao_place_id TEXT;
  ALTER TABLE places ADD COLUMN naver_place_id TEXT;
  ALTER TABLE places ADD COLUMN road_address TEXT;
  ALTER TABLE places ADD COLUMN jibun_address TEXT;
  ALTER TABLE places ADD COLUMN sigungu_code TEXT;
  ALTER TABLE places ADD COLUMN zonecode TEXT;
  CREATE INDEX ON places(kakao_place_id);
  CREATE INDEX ON places(naver_place_id);
  ```

**DoD**
- [ ] migration 실행 성공
- [ ] TypeScript 빌드 에러 없음
- [ ] 기존 레코드 영향 없음 (모두 NULL 허용)

## T-020. 등록 validation 완화 [Admin] ✅

**완료**: 2026-04-17
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts) validation 업데이트:
  - googlePlaceId 필수 → **외부 ID 중 하나(google/kakao/naver) OR manual=true** 중 하나 필요
  - RegisterPlaceInput 에 kakaoPlaceId/naverPlaceId/manual + roadAddress/jibunAddress/sigunguCode/zonecode 추가
  - insert payload 에 6개 신규 필드 전파
- 2 테스트 추가 (외부 ID 없음 에러 / manual=true 통과)

**WO 참조**: #46
**축**: Admin
**예상 공수**: 30m

**수정 파일**
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts) L287-289
  ```ts
  // Before
  if (!input.googlePlaceId) return { error: 'Google Place ID 필요' }

  // After
  const hasExternalId = input.googlePlaceId || input.kakaoPlaceId || input.naverPlaceId
  if (!hasExternalId && !input.manual) {
    return { error: '외부 ID(Kakao/Google/Naver) 중 하나 또는 수동 등록 플래그 필요' }
  }
  ```

**DoD**
- [ ] Kakao만 있는 업체 등록 가능
- [ ] 수동 등록 플래그로 외부 ID 없이도 가능
- [ ] 업체명·주소는 여전히 필수

---

# Phase 3 — LLM 품질 파이프라인 (3-4일)

## T-021. 네이버 블로그 검색 클라이언트 [GEO] ✅

**WO 참조**: #45 B-1 블로그
**축**: GEO (데이터 풍부도)
**예상 공수**: 2h
**선행**: Naver 검색 API Client ID (환경변수)

**신규 파일**
- [src/lib/naver/blog-search.ts](src/lib/naver/blog-search.ts)
  ```ts
  export async function searchBlog(query: string, display = 30): Promise<BlogPost[]>
  // GET https://openapi.naver.com/v1/search/blog.json
  // 반환: title, link, description, bloggername, postdate
  ```
- HTML `<b>` 태그 제거 유틸

**DoD**
- [ ] `searchBlog("닥터에버스 천안")` 30개 반환
- [ ] Rate limit 핸들링
- [ ] 유닛 테스트

## T-022. 네이버 카페 검색 클라이언트 [GEO] ✅

**WO 참조**: #45 B-1 카페
**축**: GEO
**예상 공수**: 1.5h

**신규 파일**
- [src/lib/naver/cafe-search.ts](src/lib/naver/cafe-search.ts)
  - `GET /v1/search/cafearticle.json`
- 스팸 1차 필터 (광고성 키워드 제거)

**DoD**
- [ ] `searchCafe("천안 피부과 추천")` 20개
- [ ] 스팸 필터 유닛 테스트

## T-023. Haiku 전처리: 블로그·카페 요약 [GEO] ✅

**WO 참조**: #34, #45
**축**: GEO
**예상 공수**: 3h
**의존**: T-021, T-022

**신규 파일**
- [src/lib/ai/haiku-preprocess.ts](src/lib/ai/haiku-preprocess.ts)
  ```ts
  export async function preprocessNaverReferences(
    blogPosts: BlogPost[],
    cafePosts: CafePost[]
  ): Promise<{
    commonTreatments: string[]
    priceSignals: string
    positiveThemes: string[]
    negativeThemes: string[]
    uniqueFeatures: string[]
    commonQuestions: string[]
  }>
  // Haiku 호출 — 3만자 → 2,000자 요약
  ```

**DoD**
- [ ] 블로그 30 + 카페 20 처리 성공
- [ ] 출력 구조화 (zod 스키마 검증)
- [ ] 광고성·반복 콘텐츠 걸러냄
- [ ] 토큰 사용량 로깅

## T-024. Sonnet 메인 모델 교체 [GEO] ✅

**WO 참조**: #34
**축**: GEO
**예상 공수**: 2h

**수정 파일**
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts) L135, L219
  ```ts
  // Before
  model: 'claude-haiku-4-5-20251001'
  // After
  model: 'claude-sonnet-4-6'
  ```
- 프롬프트 업그레이드: Princeton GEO 7 levers 반영
  ```
  반드시 포함:
  1. Statistics Addition (구체적 수치)
  2. Cite Sources (블로그·리뷰 출처 명시)
  3. Quotation (고객 리뷰 인용)
  4. Authoritative (전문 표현)
  5. Unique Words (일반론 회피)
  ```
- 입력 컨텍스트에 T-023 결과 추가

**DoD**
- [ ] description 품질 눈에 띄게 상승 (수치·출처 포함)
- [ ] FAQ 실제 블로그/카페 Q&A 반영
- [ ] A/B 비교: Haiku vs Sonnet 3건 샘플 검토

## T-025. Tool Use 구조화 출력 [GEO] ✅

**WO 참조**: #36
**축**: GEO (신뢰성)
**예상 공수**: 3h

**수정 파일**
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts)
  - 기존 정규식 JSON 파싱(L156-170) 제거
  - Anthropic Tool Use 로 변경
  ```ts
  tools: [{
    name: 'register_business',
    input_schema: zodToJsonSchema(BusinessContentSchema)
  }],
  tool_choice: { type: 'tool', name: 'register_business' }
  ```
- 모든 LLM 출력에 zod 검증

**DoD**
- [ ] JSON 파싱 실패 0건
- [ ] zod 스키마 불일치 시 재시도 (max 3회)
- [ ] 기존 케이스 regression 없음

## T-026. Few-Shot Exemplar 라이브러리 [GEO] ✅

**WO 참조**: #35
**축**: GEO
**예상 공수**: 3h

**신규 파일**
- [src/lib/ai/exemplars.ts](src/lib/ai/exemplars.ts)
  - 카테고리별 우수 등록 업체 예시 2-3개
  - `dermatology → [닥터에버스, 샤인빔, 얼라이브]`
  - `restaurant → [단비, ...]`
- 프롬프트 빌더에 카테고리 매칭 → exemplar 주입

**DoD**
- [ ] 피부과 등록 시 닥터에버스 예시 자동 주입
- [ ] 프롬프트 구조: `<exemplars>...</exemplars><target>...</target>`
- [ ] 시스템 프롬프트에 AEO Direct Answer Block 패턴 명시

## T-027. 품질 스코어링 게이트 [GEO] ✅

**WO 참조**: #39
**축**: GEO
**예상 공수**: 4h

**신규 파일**
- [src/lib/ai/quality-score.ts](src/lib/ai/quality-score.ts)
  ```ts
  export function scoreQuality(generated: BusinessContent): {
    score: number  // 0-100
    breakdown: { descLength, keywordDensity, stats, faqDiversity, generic, categoryFit }
    suggestions: string[]
  }
  ```

**수정 파일**
- [src/lib/actions/register-place.ts](src/lib/actions/register-place.ts) — 생성 후 스코어링 → <70 시 자동 재생성 (max 2회)

**DB migration**
- `ALTER TABLE places ADD COLUMN quality_score INTEGER;`

**DoD**
- [ ] 품질 스코어 자동 계산·저장
- [ ] 어드민 목록에 스코어 컬럼
- [ ] 70 미만 재생성 로직

## T-028. 생성 시간·토큰 로깅 [Admin][GEO] ✅

**WO 참조**: #34
**축**: Admin 측정, GEO
**예상 공수**: 1.5h

**신규 파일**
- `src/lib/ai/telemetry.ts` — 호출별 로깅

**DB migration**
- `ai_generations` 테이블 신규 (place_id, model, input_tokens, output_tokens, latency_ms, quality_score, created_at)

**DoD**
- [ ] 모든 LLM 호출 자동 기록
- [ ] 어드민 대시보드에 요약 통계 (월 평균 비용·지연)

---

# Phase 4 — GEO·AEO 구조화 데이터 (2-3일)

## T-029. sameAs 데이터 입력 파이프라인 [GEO] ✅

**WO 참조**: #17
**축**: GEO (핵심 신호)
**예상 공수**: 2h

**이미 인프라 완비** ([jsonld.ts](src/lib/jsonld.ts) L145-151, [types.ts](src/lib/types.ts) L109-111). 데이터 입력만 필요.

**작업**
- 기존 등록 업체 4곳에 수동으로 `naverPlaceUrl`, `kakaoMapUrl` 입력
- T-018 신규 등록 플로우에서 자동 입력 확인 (검색 결과의 URL 사용)

**DoD**
- [ ] 기존 업체 전체 sameAs URL 3개 입력
- [ ] 업체 상세 페이지 view-source 확인

## T-030. BreadcrumbList 레벨 통일 ❌ [SUPERSEDED → T-010h]

**WO 참조**: #12
**상태**: **폐기** — D-4 결정으로 **페이지 타입별 2종 분리** (업체 4단계 + 블로그 5단계)
**대체**: [T-010h Breadcrumb 2종 분리](#t-010h-breadcrumb-2종-분리-wo-12-seoaeo)

**잔여 책임**
- [ ] T-010h 완료 후 모든 페이지에서 breadcrumb 일관성 시각 검증

## T-031. 블로그 글 ItemList 스키마 (compare 타입) [AEO] ✅

**WO 참조**: #19
**축**: AEO
**예상 공수**: 1.5h
**의존**: T-010d (블로그 글 상세 라우트)
**변경 사유**: D-5 결정으로 `/compare/...` 라우트 제거 → `post_type='compare'` 인 블로그 글에 적용

**수정 파일**
- `src/app/blog/[city]/[sector]/[slug]/page.tsx` (T-010d 결과물)
- 또는 `src/lib/blog/jsonld.ts` 신규 헬퍼

**작업**
- [ ] BlogPost 타입 확장: 비교 타입에 `comparedItems: { name, url, ... }[]` 필드
- [ ] `post_type === 'compare'` 일 때 JSON-LD에 `ItemList` + 항목별 `Service` 출력
- [ ] Article + FAQPage + BreadcrumbList 는 모든 블로그 글 공통 유지

**DoD**
- [ ] Google Rich Results Test — ItemList 인식
- [ ] 비교 대상 업체가 Service 엔트리로 출력

## T-032. robots.ts — Yeti/Daum/Bingbot 추가 [SEO][GEO] ✅

**WO 참조**: #16
**축**: SEO, GEO
**예상 공수**: 15m

**수정 파일**
- [src/app/robots.ts](src/app/robots.ts)
  ```ts
  { userAgent: 'Yeti', allow: '/', disallow: ['/admin', '/api'] },
  { userAgent: 'Daumoa', allow: '/', disallow: ['/admin', '/api'] },
  { userAgent: 'Bingbot', allow: '/', disallow: ['/admin', '/api'] },
  ```

**DoD**
- [ ] `https://aiplace.kr/robots.txt` 에 3개 추가 User-Agent 표시
- [ ] Naver Search Central 인식 확인

## T-033. OG/Twitter 메타 보강 [SEO] ✅

**WO 참조**: #20
**축**: SEO
**예상 공수**: 30m

**수정 파일**
- [src/app/layout.tsx](src/app/layout.tsx)
  ```ts
  twitter: {
    card: 'summary_large_image',
    site: '@aiplace_kr',    // 브랜드 계정 있으면
    creator: '@aiplace_kr',
  }
  ```

**DoD**
- [ ] Twitter Card Validator 통과

## T-034. Thin 카테고리 처리 — 가이드 본문 채우기 [SEO] ✅

**WO 참조**: #6
**축**: SEO
**예상 공수**: 1-2일 (카테고리당 1,000-1,500자 가이드 본문 작성)
**결정**: ✅ D-3 옵션 B 확정 — 가이드 본문 채우기 (noindex 임계 상향 안 함)

**대상 카테고리** (현재 업체 1곳)
- `/cheonan/auto-repair` (자동차정비)
- `/cheonan/interior` (인테리어)
- `/cheonan/webagency` (웹에이전시)
- `/cheonan/restaurant` (음식점)

**작업**
- [ ] 각 카테고리별 가이드 본문 작성 (1,000-1,500자)
  - 지역 시장 개요
  - 평균 가격대
  - 선택 체크리스트
- [ ] **저장 위치**: T-010a (blog_posts 테이블) 완료 후엔 **블로그 포스트로 작성** (`post_type='guide'`)
  - 과도기에 작업할 경우 `src/lib/data.ts` 의 `guidePages` 배열에 추가 → T-010e 마이그레이션 시 자동 이전
- [ ] 카테고리 페이지에 가이드 본문 임베드 또는 강력 링크 노출

**DoD**
- [ ] 4개 카테고리 모두 가이드 본문 생성
- [ ] 페이지 thin content 신호 해소 (Google Search Console 모니터링)
- [ ] 블로그 시스템 마이그레이션 완료 후 가이드 콘텐츠가 `/blog/cheonan/[sector]/...-guide` 에 노출

## T-035. 날짜 자동화 [GEO] ✅

**WO 참조**: #22
**축**: GEO (freshness)
**예상 공수**: 30m

**수정 파일**
- [src/lib/seo.ts](src/lib/seo.ts) L145 — `"2026년 기준"` 하드코딩 제거
- T-003 `site-stats.ts` 의 `currentYear` 사용

**DoD**
- [ ] `grep "2026년" src/` 결과 모두 동적 치환됨

---

# Phase 5 — SEO·CWV·접근성 (3일)

## T-036. Pretendard self-host [SEO] ✅

**WO 참조**: #23
**축**: SEO (CWV)
**예상 공수**: 1h

**작업**
- `/public/fonts/pretendard-variable.woff2` 다운로드·배포
- `next/font/local` 사용으로 전환
- [src/app/layout.tsx](src/app/layout.tsx) jsdelivr link 3줄 제거

**DoD**
- [ ] Lighthouse CWV — LCP 개선 확인
- [ ] 외부 CDN 요청 0

## T-037. 이미지 sizes 감사 [SEO] ✅

**WO 참조**: #24
**축**: SEO
**예상 공수**: 30m

**수정 파일**
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L149 — `sizes="800px"` 고정 → 반응형

**DoD**
- [ ] 모든 Image 컴포넌트 반응형 sizes
- [ ] LCP 후보에 priority 적용

## T-038. 접근성 보강 [SEO] ✅

**WO 참조**: #26
**축**: SEO
**예상 공수**: 2h

- placeholder SVG 에 `aria-hidden="true"` 추가
- `#6a6a6a` 컬러 핵심 정보 (운영시간·가격)는 `#222222` 로 상향
- `prefers-reduced-motion` CSS 추가

## T-039. CWV 측정 도입 [SEO] ✅

**WO 참조**: #25
**축**: SEO
**예상 공수**: 1h

- `@vercel/speed-insights` 또는 Lighthouse CI
- PR 단위 회귀 감지 설정

## T-040. 보안 헤더 점검 [SEO] ✅

**WO 참조**: #27
**축**: SEO
**예상 공수**: 1h

- `next.config.mjs` `headers()` 함수 추가
- HSTS, CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy

## T-041. 태그 표기 점검 [SEO] ✅

**WO 참조**: #14
**축**: SEO
**예상 공수**: 1h

- DB에서 `tags` 필드가 문자열로 저장된 케이스 확인
- 배열화 migration
- [src/components/place-card.tsx](src/components/place-card.tsx) 정상 동작 확인

## T-042. `/admin/register` 직접 링크 grep [SEO] ✅

**WO 참조**: #15
**축**: SEO (crawl budget)
**예상 공수**: 30m

- `grep -rn "/admin/register" src/` 로 헤더 외 위치 확인
- 외부에 노출된 링크 있으면 공개 경로로 교체

## T-043. 업체 슬러그 규칙 통일 [SEO] ✅

**WO 참조**: #18
**축**: SEO (유지보수)
**예상 공수**: 2h

- Supabase `places.slug` 전수 조회
- 자동생성(`restaurant-6kty` 류) 슬러그 → 수동 슬러그로 수정
- 301 리다이렉트 설정

## T-044. 홈 "83개 업종" 해석 명확화 [SEO][AEO] ✅

**WO 참조**: #3
**축**: SEO, AEO
**예상 공수**: 30m
**의존**: T-003 (site-stats)

- "83개 업종 커버리지, 현재 {activeCategories}개 운영 중" 식으로 문구 개선

## T-045. 업체 상세 템플릿 점검 [SEO] ✅

**WO 참조**: #13
**축**: SEO
**예상 공수**: 1h

- 닥터에버스 상세에 "관련 콘텐츠" 섹션 미노출 이슈 확인
- `relatedGuides` / `relatedComparisons` 데이터 누락 여부 조사

---

# Phase 6 — 확장성·운영 (1-2주)

## T-046. Admin 목록 검색·필터·페이지네이션 ✅ [Admin]

**WO 참조**: #29 — 예상 공수: 6h

**목적**: `/admin/places` 목록에 검색·필터·페이지네이션을 추가해 업체 수 증가 시 운영성 확보.

**작업**
- [x] 순수 함수 `src/lib/admin/places-query.ts`
  - `parseListParams(searchParams)` — URL 파라미터 → 정규화 객체 (`q`, `city`, `category`, `sector`, `status`, `page`, `pageSize`)
  - `clampPage(page, totalPages)` — 1-based 페이지 안전 범위
  - `buildRange(page, pageSize)` — `{ from, to }` Supabase `.range()` 입력
  - `buildPageList(currentPage, totalPages, window)` — 페이지네이션 표시 번호 + ellipsis
- [x] 테스트 `src/lib/__tests__/admin/places-query.test.ts` — 21 tests, **커버리지 100%**
- [x] `/admin/places/page.tsx` — `searchParams: Promise<{...}>` 수신, Supabase `.ilike()` / `.eq()` / `.in()` / `.range()` + `count: 'exact'` 적용
- [x] `/admin/places/places-filter-form.tsx` (client) — 검색 입력·도시·섹터·업종·상태 select → URL 쿼리 반영 (섹터 선택 시 업종 옵션 자동 좁힘)
- [x] `/admin/places/places-pagination.tsx` (서버 컴포 — 링크 렌더)

**DoD**
- [x] 검색어로 이름 필터링 동작 (`ilike %q%`)
- [x] 도시·섹터·업종·상태 다중 필터 조합 동작 (섹터는 `categories.sector` 매핑으로 `.in()` 처리)
- [x] 페이지 이동 시 URL 파라미터 유지
- [x] `pageSize` 기본 20, 최대 100
- [x] 필터 후 결과 0개 empty state
- [x] 전체 테스트 670개 통과 (T-046 21개 추가)
- [x] Review log 기록

## T-047. Admin 일괄 작업 (Bulk Actions) ✅ [Admin]

**WO 참조**: #30 — 예상 공수: 6h

**목적**: 목록에서 체크박스 다중 선택 → 일괄 승인/반려/삭제로 대량 운영 속도 확보.

**작업**
- [x] `src/lib/admin/places-bulk.ts` — 순수 헬퍼 (`parseBulkAction`, `partitionIds`, `summarizeBulkResult`)
- [x] 테스트 10개, **커버리지 100%**
- [x] 서버 액션 `src/lib/actions/bulk-places.ts` — `.in('id', ids)` + `count: 'exact'` + 공개 경로 revalidate
- [x] `places-table.tsx` (client) — indeterminate 전체 선택 + 선택 N개 토올바 + activate/reject/delete 버튼
- [x] `/admin/places/page.tsx` — `PlacesTable` 교체 리팩터

**DoD**
- [x] 3가지 일괄 액션 동작
- [x] 전체/개별 체크박스 UX (indeterminate 상태 포함)
- [x] 빈 선택 시 버튼 disabled
- [x] 삭제 시 confirm
- [x] 전체 테스트 680개 통과 (T-047 10개 추가)
- [x] Review log 기록

## T-048. Admin 실시간 검증 + 미리보기 ✅ [Admin][GEO]

**WO 참조**: #31 — 예상 공수: 6h

**목적**: 등록 폼에서 실시간으로 필수·권장 항목을 검증하고 미리보기 카드를 보여 서버 왕복 전에 문제 발견.

**작업**
- [x] `src/lib/admin/place-validation.ts` — `validatePlaceDraft` + `{ errors, warnings, completeness }` (10개 시그널 × 10점)
- [x] 테스트 15개, **커버리지 100%**
- [x] `register-validation-preview.tsx` — 진행률 바 (색상 tier: green/yellow/red) + 에러·경고 리스트 + 프리뷰 카드
- [x] `register/page.tsx` 연결 — 등록 버튼 `hasErrors` 시 disabled + "필수 항목 N개 남음" 라벨

**DoD**
- [x] 필수 누락 필드 즉시 표시 + 등록 버튼 disabled
- [x] 완성도 0-100 % 실시간 갱신
- [x] 프리뷰 카드가 현재 입력값 반영 (도시·업종 한글명, 태그 pill)
- [x] 전체 테스트 712개 통과 (T-048 15개 추가)
- [x] Review log 기록

## T-049. Admin 인라인 편집 ✅ [Admin]

**WO 참조**: #32 — 예상 공수: 4h

**목적**: 목록에서 이름/전화/태그를 클릭 → 인라인 편집 → Enter/Blur 저장. 편집 페이지 이동 비용 제거.

**작업**
- [x] `src/lib/admin/inline-edit.ts` — 화이트리스트 (`name`, `phone`, `tags`) + 필드별 검증 + `normalizeTagsInput`
- [x] 테스트 17개, **커버리지 97%**
- [x] 서버 액션 `src/lib/actions/inline-edit-place.ts` — `isInlineField` + `validateInlineField` 이중 검증
- [x] `inline-edit-field.tsx` — 클릭 전환 / Enter 저장 / Esc 취소 / Blur 자동 저장

**DoD**
- [x] 이름·전화·태그 인라인 수정 동작
- [x] 화이트리스트 외 필드는 서버에서 거부
- [x] 태그는 공백·콤마 분리 + 중복 제거 후 배열로 저장
- [x] 검증 실패 시 inline 에러 표시
- [x] 전체 테스트 697개 통과 (T-049 17개 추가)
- [x] Review log 기록

## T-050. 이미지 업로드 (Supabase Storage) ✅ [Admin][SEO][GEO]

**WO 참조**: #33 — 예상 공수: 8h

**목적**: 업체 이미지를 Supabase Storage 에 업로드하고 `places.images` JSONB 로 alt/type 메타까지 저장. 대체 이미지 SVG placeholder 를 실사진으로 대체할 인프라 완성.

**작업**
- [x] `supabase/migrations/014_places_images_storage.sql` — `places.images` JSONB 컬럼 + `places-images` 버킷 + 공개 읽기 / service_role 쓰기 RLS
- [x] `src/lib/admin/place-images.ts` — `validateImageUpload`, `validateAlt`, `sanitizeFilenameStem`, `makeStorageKey`, `IMAGE_TYPE_OPTIONS` 상수
- [x] 검증 라이브러리 테스트 21개 (5MB 제한 / MIME 화이트리스트 / 디렉터리 이탈 방지 / alt 길이)
- [x] `src/lib/actions/upload-place-image.ts` — `uploadPlaceImage`, `removePlaceImage` (Storage upload + `places.images` JSONB 병합 + revalidate)
- [x] 서버 액션 테스트 12개 (mock Supabase client + storage)
- [x] `src/components/admin/place-image-uploader.tsx` — 파일 선택 + type/alt 입력 + 미리보기/삭제 UI
- [ ] 자동 리사이즈·CDN 변환은 향후 과제 — 우선 원본 업로드(최대 5MB) 허용

**DoD**
- [x] 업로드 전 MIME/크기/alt/type 검증 통과 필수
- [x] `placeId` 경로 이탈(`/`, `..`) 시도 차단
- [x] 업로드 후 public URL + alt/type 이 `places.images` JSONB 에 append
- [x] Uploader 컴포넌트는 기존 이미지 갤러리 + 삭제 버튼 포함
- [x] 전체 테스트 814개 통과 (T-050 33개 + T-052 generate-candidates 6개 추가)
- [x] Review log 기록
- [ ] 실제 버킷 provisioning 은 `014_places_images_storage.sql` 적용 후 Supabase 대시보드에서 확인 필요

## T-051. 메타데이터 중앙화 (`lib/seo/page-meta.ts`) ✅ [SEO][AEO][GEO]

**WO 참조**: #21 — 예상 공수: 1일 (대규모 리팩터)

**목적**: 모든 페이지의 `Metadata` 생성 로직을 `src/lib/seo/page-meta.ts` 로 중앙화.

**작업**
- [x] `src/lib/seo/page-meta.ts` 빌더 7종 — home / about / category / place / blogIndex / blogPost / guide / compare
- [x] 테스트 12개, **커버리지 94%**
- [x] 페이지 리팩터 — home / category (`[city]/[category]`) / place (`[city]/[category]/[slug]`) 적용
- [ ] 후속(별도 PR 권장): blog, guide, compare 페이지 migrate

**DoD**
- [x] title·description·canonical·OG 일관된 형식
- [x] 빈 카테고리 → robots: noindex 유지
- [x] 전체 테스트 743개 통과 (T-051 12개 추가)
- [x] Review log 기록

## T-052. 다중 후보 LLM 생성 + 어드민 선택 ✅ [GEO]

**WO 참조**: #37 — 예상 공수: 6h

**목적**: description 단일 후보를 자동 채택하는 대신, 3개 후보를 병렬 생성하고 어드민이 카드 UI 에서 직접 큐레이션할 수 있도록 한다.

**작업**
- [x] `src/lib/ai/multi-candidates.ts` — `rankDescriptionCandidates`, `mergeServicePool`, `mergeFaqPool`, `mergeTagPool`, `buildCandidatePool` + `normalizeForDedup`
- [x] 테스트 13개, 라이브러리 커버리지 **100%**
- [x] `generatePlaceContent` 에 선택적 `toneHint` / `feedback` 주입 (기존 API 유지)
- [x] 서버 액션 `src/lib/actions/generate-candidates.ts` — 3종 어조로 병렬 호출 후 풀 병합
- [x] UI `src/app/admin/register/candidate-picker.tsx` — description 카드 택일 + 서비스/FAQ/태그 체크박스 + 피드백 재생성 입력
- [x] `/admin/register` 페이지에 "다중 후보 생성" 버튼 + `CandidatePicker` 통합 — 기존 단일 생성 버튼과 공존
- [x] 누락 태스크 보강: `bulk-places` / `inline-edit-place` / `import-csv-places` 서버 액션 테스트 (18개 추가)

**DoD**
- [x] description 3개 후보가 품질 스코어 순으로 카드 렌더링 (중복 자동 제거)
- [x] 서비스·FAQ·태그는 풀 병합 후 체크박스로 큐레이션
- [x] 재생성 피드백("좀 더 간결하게") 입력 후 재호출 시 user-prompt 에 반영
- [x] 전체 테스트 774개 통과 (T-052 13개 + 액션 보강 18개 추가)
- [x] Review log 기록

## T-053. CSV 일괄 등록 ✅ [Admin]

**WO 참조**: #40 — 예상 공수: 1일

**목적**: CSV 파일로 수십~수백 업체를 한 번에 업로드 → 서버에서 검증·매핑·삽입, 결과 리포트 UI.

**작업**
- [x] `src/lib/admin/csv-import.ts` — `parseCsv` (인용부호/escaped quotes/CRLF), `normalizeRow`, `validateCsvRow`, `summarizeImport`, `CSV_TEMPLATE_HEADERS`
- [x] 테스트 19개, **커버리지 97.5%**
- [x] 서버 액션 `src/lib/actions/import-csv-places.ts` — 행별 검증 → 유효 행만 `insert` + revalidate
- [x] UI `/admin/import-csv/page.tsx` + `csv-import-client.tsx` — 파일 선택 / 붙여넣기 / 템플릿 로드 + 결과 표 (행 / 업체명 / 성공-실패 / 메시지)

**DoD**
- [x] CSV 파싱 — 인용부호·escaped quotes·CRLF·빈줄 허용
- [x] 행 단위 에러 표시 (rowNumber = header + 1)
- [x] 성공 행만 DB 삽입 (status=pending, source=csv-import)
- [x] 템플릿 로드 버튼 (`CSV_TEMPLATE_HEADERS` + 예시 한 줄)
- [x] 전체 테스트 731개 통과 (T-053 19개 추가)
- [x] Review log 기록

## T-054. 사장님 셀프 포털 ✅ [GEO][Admin]

**WO 참조**: #41 — 예상 공수: 3-5일

**목적**: 업체 사장님이 로그인 후 본인 소유 업체의 소개·전화·영업시간·태그·이미지를 직접 수정할 수 있도록 셀프 서비스 포털 제공.

**작업**
- [x] `supabase/migrations/017_place_owner_email.sql` — `places.owner_email` 컬럼 + 인덱스 + self-service RLS (select/update)
- [x] `src/lib/owner/permissions.ts` — 화이트리스트 5개 필드 + `canOwnerEdit` / `normalizeOwnerPatch` / `validateOwnerPatch` (16 tests, 100% 커버리지)
- [x] `src/lib/owner/auth.ts` — `getOwnerUser` / `requireOwnerUser` / `requireOwnerForAction`
- [x] `src/lib/actions/owner-places.ts` — `listOwnerPlaces` + `updateOwnerPlace` (소유권 검증 + 감사 로그 + revalidate) (11 tests)
- [x] `/owner` 포털 홈 — 본인 업체 목록 + 상태 뱃지
- [x] `/owner/places/[id]` 편집 페이지 + 클라이언트 폼
- [x] `middleware.ts` — `/owner/:path*` 로그인 필수 (admin 화이트리스트 미적용)
- [x] `register-place.ts` — insert 시 `owner_email` 도 함께 기록

**DoD**
- [x] 비로그인 사용자가 `/owner` 접근 시 `/admin/login?next=/owner` 로 리다이렉트
- [x] 본인 소유 아닌 업체 편집 시도 → 서버 액션 거부
- [x] 어드민 전용 필드(status/slug/city/category/owner_id) 는 owner-side 에서 거부
- [x] 모든 수정이 `place_audit_log` 에 `owner self-service` reason 으로 기록
- [x] 전체 테스트 899개 통과 (T-054 27개 추가)
- [x] Review log 기록
- [ ] 실제 배포 검증은 `017_place_owner_email.sql` 적용 후 Supabase Auth 테스트 사용자로 수동 확인 필요

## T-055. 버전 관리·감사 로그 ✅ [Ops]

**WO 참조**: #42 — 예상 공수: 2일

**목적**: 업체 변경 이력을 append-only 로 기록하여 감사·롤백·의심 활동 추적 기반 제공.

**작업**
- [x] `supabase/migrations/015_place_audit_log.sql` — `place_audit_log` 테이블 + 3개 인덱스 + RLS(서비스 롤 전용)
- [x] `src/lib/admin/audit.ts` — `diffUpdate`, `isAuditableField`, `summarizeAction`, `AUDIT_ACTIONS`, `AUDITABLE_FIELDS` (12 tests, 100% 커버리지)
- [x] `src/lib/actions/audit-places.ts` — `recordAudit`, `recordUpdateDiffs`, `listAuditForPlace` (10 tests)
- [x] `inline-edit-place.ts` 에 감사 로깅 hook — 변경 직후 diff 를 `place_audit_log` 에 append
- [x] `bulk-places.ts` 상태 변경 + 삭제 액션에 감사 로깅 추가
- [x] `/admin/places/[id]/history` 페이지 — 타임라인 (action / field / before-after JSON / 시각)

**DoD**
- [x] 모든 인라인 편집이 `place_audit_log` 에 1행 이상 기록
- [x] 일괄 상태 변경·삭제 시 ids 개수만큼 `status` / `delete` 행 기록
- [x] `/admin/places/[id]/history` 페이지에서 최근 100개 타임라인 렌더
- [x] 전체 테스트 836개 통과 (T-055 22개 추가)
- [x] Review log 기록
- [ ] 실제 롤백 UI(이전 값으로 되돌리기)는 향후 과제 — 현재는 읽기 전용 타임라인

## T-056. AI 인용 추적 대시보드 (admin 통합) ✅ [GEO]

**WO 참조**: #43
**축**: GEO (측정)
**예상 공수**: 3일

**작업**
- [x] `supabase/migrations/016_citation_results.sql` — `citation_results` 테이블 + 4개 인덱스 + RLS(서비스 롤)
- [x] `src/lib/citations/aggregate.ts` — `summarizeByEngine`, `summarizeByPrompt`, `topCitedPlaces`, `summarizeTrend` (8 tests, 100% 커버리지)
- [x] `src/lib/actions/citations.ts` — `insertCitations`(scripts/baseline-test.ts 연계용) + `listRecentCitations` (7 tests)
- [x] `/admin/citations` 대시보드 — 엔진별 카드 / 일자별 막대 그래프 / prompt×engine 매트릭스 / Top 15 업체
- [x] 기간 필터 (7/30/60/90일) URL 파라미터로 전환
- [ ] 저인용 업체 자동 재생성 트리거는 향후 과제 — 현재는 관측만
- [ ] `scripts/baseline-test.ts` 스크립트 insert 연동은 다음 커밋에서 처리

**DoD**
- [x] 인용 데이터가 집계되어 엔진별 인용률 / 추이 / Top 업체가 렌더링
- [x] promptId × engine 매트릭스로 세그먼트별 비교
- [x] RLS 는 service_role 전용 (일반 사용자 접근 deny)
- [x] 전체 테스트 851개 통과 (T-056 15개 추가)
- [x] Review log 기록

## T-057. 알림 시스템 (Webhook + 이메일) ✅ [Ops]

**WO 참조**: #44
**축**: Ops
**예상 공수**: 2일

**작업**
- [x] `src/lib/notify/events.ts` — 이벤트 정의(`place.registered` / `place.approved` / `place.rejected` / `pending.backlog`) + 이메일/슬랙 페이로드 빌더 (8 tests, 100% 커버리지)
- [x] `src/lib/notify/email.ts` — Resend API 연동 + `RESEND_API_KEY`/`RESEND_FROM` 없으면 콘솔 폴백 (4 tests)
- [x] `src/lib/notify/slack.ts` — 웹훅 POST + `SLACK_WEBHOOK_URL` 없으면 콘솔 폴백 (4 tests)
- [x] `src/lib/actions/notify.ts` — `dispatchNotify` 이메일/슬랙 병렬 발송, 한쪽 실패해도 다른 쪽 시도 (5 tests)
- [x] `bulk-places.ts` 승인/거절 → 사장님 이메일 (owner_email 기반)
- [x] `register-place.ts` insert 성공 → 어드민 이메일/슬랙 (ADMIN_NOTIFY_EMAIL)
- [ ] 카카오 알림톡은 향후 과제

**DoD**
- [x] Resend/Slack 키 없이도 테스트 통과 (콘솔 폴백)
- [x] 키 있으면 실제 발송 (fetch 호출 확인)
- [x] 한 채널 실패가 다른 채널 실패를 유발하지 않음
- [x] 전체 테스트 872개 통과 (T-057 21개 추가)
- [x] Review log 기록
- [ ] 프로덕션 동작 확인은 `RESEND_API_KEY`, `RESEND_FROM`, `SLACK_WEBHOOK_URL`, `ADMIN_NOTIFY_EMAIL`, `NEXT_PUBLIC_SITE_URL` 세팅 후 수동 검증

---

## 이 문서 유지 정책

- TASK 완료 시 `✅` 마킹 + 커밋 해시 기록
- 블락 시 `⏸` + 블락 사유 명시
- 새 TASK 발견 시 Phase 말단에 추가
- 주 1회 Phase 진행률 리뷰

---

## 📋 WO ↔ TASK 매핑 (정합성 검증 2026-04-17)

전체 WO 47개 항목 → TASK 매핑 결과.

| WO# | 결정/상태 | 주 TASK | 비고 |
|---|---|---|---|
| #1 수피부과 | 미해결 | **T-001** | ✅ |
| #2 카니발/recommend | blog 이전으로 자동 해소 | **T-010e** | T-002 폐기됨 (중복) |
| #3 83개업종 | 부분완료 | **T-003** + T-044 | ✅ |
| #4 면책 | 미해결 | **T-004** | ✅ |
| #5 푸터 | 미해결 | **T-005** | ✅ |
| #6 thin | 옵션B 결정 | **T-034** | ✅ 옵션 B 확정 (가이드 본문) |
| #7 H1 | 미해결 | **T-006** | ✅ |
| #8 주소 | 재검증 | **T-010** | ✅ |
| #9 영업시간 | 부분완료 | **T-010** | ✅ |
| #10 가격 | 거의해결 | **T-010** | ✅ |
| #11 리뷰/Review | 미해결 | **T-008** + T-009 | ✅ |
| #12 breadcrumb | 2종 분리 결정 | **T-010h** | T-030 폐기됨 (중복) |
| #13 템플릿 | 부분완료 | **T-007** + T-045 | ✅ |
| #14 태그 | 거의해결 | **T-041** | ✅ |
| #15 admin | 해결됨 | **T-042** | ✅ |
| #16 robots | 미해결 | **T-032** | ✅ |
| #17 sameAs | 인프라완비 | **T-029** | ✅ |
| #18 슬러그 | 재검증 | **T-043** | ✅ |
| #19 compare ItemList | 미해결 | **T-031** | ✅ blog용으로 변경 |
| #20 OG/Twitter | 부분완료 | **T-033** | ✅ |
| #21 메타중앙화 | 미해결 | **T-051** | ✅ |
| #22 날짜 | 미해결 | **T-035** | ✅ |
| #23 Pretendard | 미해결 | **T-036** | ✅ |
| #24 이미지 sizes | 부분완료 | **T-037** | ✅ |
| #25 CWV | 미해결 | **T-039** | ✅ |
| #26 접근성 | 부분완료 | **T-038** | ✅ |
| #27 보안헤더 | 재검증 | **T-040** | ✅ |
| #28 라우트 | /blog 통합 결정 | **T-010a~i** | ✅ #47 일환 |
| #29 admin 검색 | 미해결 | **T-046** | ✅ |
| #30 일괄작업 | 미해결 | **T-047** | ✅ |
| #31 실시간검증 | 미해결 | **T-048** | ✅ |
| #32 인라인편집 | 미해결 | **T-049** | ✅ |
| #33 이미지업로드 | 미해결 | **T-050** | ✅ |
| #34 LLM 모델 | 미해결 | **T-024** | ✅ Sonnet+Haiku 단순화 반영 |
| #35 Few-Shot | 미해결 | **T-026** | ✅ |
| #36 Tool Use | 미해결 | **T-025** | ✅ |
| #37 다중후보 | 미해결 | **T-052** | ✅ |
| #38 리뷰활용 | 미해결 | **T-021** + T-022 + T-023 | ✅ |
| #39 품질스코어 | 미해결 | **T-027** | ✅ |
| #40 CSV | 미해결 | **T-053** | ✅ |
| #41 사장님포털 | 미해결 | **T-054** | ✅ |
| #42 버전관리 | 미해결 | **T-055** | ✅ |
| #43 인용추적 | 미해결 | **T-056** | ✅ 신규 추가 |
| #44 알림 | 미해결 | **T-057** | ✅ 신규 추가 |
| #45 Multi-Source | 미해결 P0 | **T-021~T-023** + T-029 + T-054 | ✅ 분산 |
| #46 단일입력검색 | 미해결 P0 | **T-011~T-020** | ✅ Phase 2 |
| #47 블로그시스템 | 미해결 P0 | **T-010a~T-010i** | ✅ Phase 1.5 |

### 폐기·통합된 TASK
- **T-002** ❌ → T-010e (블로그 마이그레이션) 일환
- **T-030** ❌ → T-010h (블로그 + 업체 2종 분리)

### 정합성 검증 결과
- ✅ WO 47개 항목 모두 TASK 매핑 완료 (5개 결정 사항 양 문서 일관)
- ✅ 모든 활성 TASK 에 `WO 참조: #N` 표기
- ✅ 폐기된 TASK 는 `❌ [SUPERSEDED → T-XXX]` 마킹
- ✅ Phase 우선순위·작업 순서 노트 추가
