# Phase 7 — AI Place Admin 재설계 구현 계획서

> **소스 문서**
> - `docs/리뷰/추가리뷰.md` — 사업·시장·리스크 종합 리뷰 (85/100 유망)
> - `docs/admin 설계안.md` — IA·페이지별 요구사항·4주 로드맵
> - `docs/admin 속도 진단.md` — `/admin/places` 2.1초 실측 + 4가지 병목
>
> **기준선**: Phase 6 종료 시점 (T-000~T-057 완료, 899 tests pass, 5-gate 통과).
> **크로스체크 2026-04-18 반영**: 이미 구현되어 있는 항목은 제외. 기존 스키마(`place_audit_log`, `citation_results`, `ai_generations` 등)를 그대로 활용하고 **같은 개념에 컬럼을 중복 생성하지 않는다** 는 원칙 준수.

---

## 0. 전제

### 사업 목표 (추가리뷰 §1·§10)
- **월 33,000원 SaaS + AI 노출** 단일 상품. 결제는 **신용카드 정기결제(빌링키)** 단일 채널
- **1인 운영** → 수동 작업 시간 = 이탈률. 어드민은 **"하루 30분 안에 모든 의사결정"** 이 목표
- 단기 목표: 피부과 1개 지역 완성도 → 베타 10~20곳 → 100곳(1년차)

### Admin 의 4가지 축 (설계안 §1)
1. **검수자 콘솔** — AI 생성물의 승인/반려가 본업
2. **모니터링 대시보드** — 크롤러·색인·결제·구독
3. **콘텐츠 운영실** — 업체·서비스·블로그·FAQ·태그 통합 UI
4. **CRM 라이트** — 33,000원 구독 라이프사이클(등록→승인→갱신→이탈)

### 이미 해결된 항목 (계획서에서 제외)
- ✅ **Pretendard self-host** — T-036 에서 `next/font/local` + `PretendardVariable.woff2` preload 완료
- ✅ **Status 뱃지 중복 버그** — `places-table.tsx` `StatusPill` 단일 컴포넌트 (`active | pending | rejected`)
- ✅ **Places 목록 테이블 + 다중 필터 + URL 쿼리 동기화** — T-046 에서 `places-query.ts` + `places-filter-form` + `places-pagination` 완비. 현재 컬럼에 **구독상태·AI 노출 점수만 추가**하면 됨 (T-065 에서 처리)

---

## 1. Pre-Phase 7 Hotfix (코드-DB 정합)

### H-01 `citation_results` 스키마 정합화
- **문제**: `001_initial_schema.sql` 이 먼저 `citation_results` 를 정의함 — `prompt_id uuid FK`, `cited_sources text[]`, `cited_places text[]`, `session_id NOT NULL`. Phase 6 의 `016_citation_results.sql` 은 `create table if not exists` 라 **실질 noop**. 그런데 `src/lib/actions/citations.ts` 는 `jsonb`·nullable session_id 가정.
- **결정**: **기존 001 스키마를 정식으로 채택**. 코드만 정합화.
- **작업**:
  - [ ] `src/lib/actions/citations.ts` — `cited_sources / cited_places` 를 `string[]` 로, `session_id` 를 required 로 변경
  - [ ] `src/lib/citations/aggregate.ts` 의 `CitationRow` 타입 동기화
  - [ ] `supabase/migrations/016_citation_results.sql` 은 삭제하거나 "001 을 보조 인덱스만 추가" 로 축소 (`idx_citations_tested_at desc`, `idx_citations_aiplace_cited partial`)
  - [ ] 기존 테스트 8+7 모두 통과
- **DoD**: 실제 DB 스키마(001) 와 앱 코드 타입이 일치, 프로덕션에서 insert 정상 동작

---

## 2. 우선순위 버킷 (전체 26개 TASK)

| 버킷 | 기간 | TASK 범위 | 목적 |
|---|---|---|---|
| **A. 성능 응급 패치** | 1~2일 | T-058~T-060 | `/admin/places` 2.1초 → 600ms |
| **B. IA 재구성** | 1주 | T-061~T-063 | 사이드바·검수 큐·토스트/모달 |
| **C. 대시보드·목록·상세** | 2주 | T-064~T-069 | 운영 대시보드·탭·체크리스트·성능·메타 |
| **D. 결제·구독** | 2주 | T-070~T-074 | MRR 이탈 방어 |
| **E. 자동화·콘텐츠** | 1~2개월 | T-075~T-080 | 검수 큐 확장·파이프라인·블로그 |
| **F. 분석·고도화** | 3개월+ | T-081~T-084 | SEO 봇 분석·LTV·⌘K·A/B |
| **컴플라이언스** | 병렬 | T-CP1, T-CP2 | 의료·리뷰 저작권 리스크 가드 |

---

## 3. 버킷 A — 성능 응급 패치 (속도 진단 §우선순위)

### T-058 Admin Link prefetch 비활성화 *(1일)*
- **근거**: 속도 진단 원인 1 — `/admin/register?_rsc=...` 6회 반복(평균 450ms × 6 = 2.7초)
- **작업**:
  - [ ] `src/app/admin/**/*.tsx` 전수 `<Link prefetch={false}>` 적용
  - [ ] shared 컴포넌트(`AdminNavLink` 추출) — prefetch 기본값 false
  - [ ] 유닛 테스트: 스냅샷 또는 `toHaveAttribute('prefetch', 'false')` 체크
- **DoD**: DevTools Network 에서 admin 이동 시 `_rsc` prefetch 호출 0건

### T-059 Production 빌드 검증 *(반일)*
- **근거**: 속도 진단 원인 2 — 청크 11개 + `turbopack-*` 청크 의심
- **작업**:
  - [ ] Vercel build logs 에서 `next build` + `NODE_ENV=production` 확인
  - [ ] `package.json` `dev/build` 스크립트에 `--turbo` 플래그 없는지 재확인
  - [ ] `/admin/*` 에 `export const runtime = 'nodejs'` 명시 (edge 회피)
  - [ ] bundle analyzer 실행 후 admin 청크 리포트 첨부
- **DoD**: 프로덕션 빌드 청크 목록에 turbopack 흔적 없음

### T-060 GA / 외부 스크립트 `lazyOnload` *(반일)*
- **근거**: 속도 진단 §그 외 — GA 503 에러 + 메인 번들 점유. 현재 `analytics.tsx` 는 `strategy="afterInteractive"`.
- **작업**:
  - [ ] `src/components/analytics.tsx` 의 `<Script strategy>` 를 `lazyOnload` 로 변경
  - [ ] 어드민 레이아웃(`/admin/*`, `/owner/*`) 에서는 Analytics 컴포넌트 제외
- **DoD**: `/admin/places` 로드 시 GA 스크립트가 `DOMContentLoaded` 이후에만 로드

---

## 4. 버킷 B — IA 재구성 (설계안 §2·§4)

### T-061 좌측 사이드바 + 글로벌 바 *(2일)*
- **근거**: 설계안 §2 IA (대시보드 / 검수 / 업체 / 블로그 / 파이프라인 / SEO / 고객 / 결제 / 설정)
- **작업**:
  - [ ] `src/components/admin/sidebar.tsx` — 아이콘 + 라벨 + 접기 (localStorage persist)
  - [ ] `src/components/admin/topbar.tsx` — ⌘K 자리(T-083) + 검수 큐 뱃지 + 결제 실패 뱃지 + 알림 + 프로필
  - [ ] `src/app/admin/layout.tsx` 리팩터 — 기존 모든 admin 페이지 동일 섀시로 래핑
  - [ ] Admin-only 색상 팔레트: 회색 베이스 + Place Green `#00a67c` 액션 컬러 (shadcn `--primary` 오버라이드)
- **DoD**: 모든 admin 페이지가 동일 섀시, 본문 max-width 제거(풀폭)

### T-062 `/admin/review` 검수 큐 v1 (업체만) *(3일)*
- **근거**: 설계안 §3.2 — "가장 자주 쓰는 페이지"
- **작업**:
  - [ ] 좌측: 큐 리스트(`status = 'pending'` 업체, 최신순), 우측: 좌우 분할 뷰
  - [ ] 왼쪽 AI 원본 / 오른쪽 편집 가능 최종본 (diff 하이라이트)
  - [ ] 단축키: `⌘↵` 승인, `⌘⌫` 반려, `J/K` 다음/이전
  - [ ] 반려 사유 태그(`fact_error | tone | seo | duplicate`) → 차후 프롬프트 개선 근거
  - [ ] 서버 액션 `approvePlace(id)` / `rejectPlace(id, reasonTag, note)` — 내부적으로 기존 `bulk-places.ts` 의 status 변경 로직 + 감사 로깅 재사용
- **DoD**: pending 업체를 키보드만으로 승인/반려 처리 가능, 반려 사유 집계 가능

### T-063 저장 토스트 + 파괴 액션 모달 *(반일)*
- **근거**: 설계안 §4 — "파괴적 액션은 이름 입력 확인 모달", 현재 `window.confirm()` 2곳
- **작업**:
  - [ ] 공용 `useToast` hook (or `sonner` 라이브러리 도입) + 모든 서버 액션 결과에 토스트
  - [ ] `<ConfirmNameModal name={업체명}>` — 삭제·대량 비활성·강제 해지
  - [ ] `places-table.tsx`, `place-actions.tsx` 의 `window.confirm()` 교체
- **DoD**: 어드민에서 파괴 액션 실행 시 업체명 타이핑 일치 강제

---

## 5. 버킷 C — 대시보드·목록·상세 (설계안 §3.1·§3.3·§3.4)

### T-064 `/admin` 운영 대시보드 *(3일)*
- **근거**: 설계안 §3.1, 현재 `admin/page.tsx` 는 단순 2-link 런처
- **카드 4개 (상단, 액션형)**:
  - 검수 대기 (업체/블로그/FAQ 숫자 + 클릭 → 검수 큐)
  - 오늘 발행 예정 (블로그)
  - 실패한 자동화 작업
  - 결제 실패 / 카드 만료임박
- **중단 지표**: AI 크롤러 방문 추이(T-081), 색인 페이지 수, 활성 구독 / MRR / 이번 달 결제 실패
- **하단**: 최근 활동 로그(`place_audit_log` 재사용) — **T-068 의 `actor_type` 컬럼 필수**
- **DoD**: 운영자가 이 페이지 한 장으로 "오늘 해야 할 일" 파악 가능

### T-065 Places 목록 보강 *(1일, 기존 T-046 위에 증분)*
- **근거**: 설계안 §3.3. **테이블·필터·URL 쿼리·일괄 액션은 이미 구현됨**. 잔여 컬럼 2개만 추가.
- **작업**:
  - [ ] `places-table.tsx` 에 컬럼 추가:
    - 구독상태 — T-070 `subscriptions` 조인
    - AI 노출 점수 — 기존 `quality_score` (013 마이그레이션) 값 그대로 표시
  - [ ] 필터에 `subscription` · `min_quality_score` 추가
- **DoD**: 필터 `?subscription=paid&min_quality_score=70` 동작

### T-066 `/admin/places/[id]` 탭 구조 + AI 노출 체크리스트 *(3일)*
- **근거**: 설계안 §3.4, 현재 `[id]/edit/page.tsx` 는 145줄 flat form
- **탭**: 개요 / 서비스 / FAQ / 태그 / 블로그 / SEO / 자동화 이력 / 변경 로그
- **자동저장** + 토스트 + **변경 diff 보기** (기존 `recordUpdateDiffs` 재사용)
- **우측 사이드바 체크리스트**:
  - 이름 / 설명 ≥ 40자 / 전화 / 카카오 / 네이버 / 서비스 ≥ 3 / FAQ ≥ 5 / 태그 ≥ 8 / 이미지 ≥ 1
  - 진척도 바(100점 만점) + 누락 항목 → 해당 탭으로 스크롤
  - 기존 `lib/admin/place-validation.ts` 의 완성도 score 재활용
- **DoD**: 완성도 90점 미만 업체는 공개 노출 경고 배너

### T-067 서버 컴포넌트 병렬화 + `cache()` 적용 *(2일)*
- **근거**: 속도 진단 원인 4 — DOM Ready 1.8s 직렬 DB 호출
- **작업**:
  - [ ] `/admin/places/page.tsx` — places query 도 `Promise.all` 로 병렬화
  - [ ] 인증 체크 미들웨어로 단일화 (현재 `middleware.ts` 가 이미 처리 중 — admin 내부 `requireAuth()` 중복 호출 제거)
  - [ ] `React.cache()` 로 같은 요청에서 `getCities()`/`getCategories()` 메모이제이션
  - [ ] `loading.tsx` Suspense 경계 — 검수 큐 카운트는 스트리밍으로 늦게 와도 OK
- **DoD**: `/admin/places` DOM Ready < 600ms

### T-068 `place_audit_log.actor_type` 컬럼 추가 *(1일)*
- **근거**: 설계안 §4 "활동 로그에 자동 vs 사람 구분". **T-055 당시 누락**.
- **작업**:
  - [ ] `018_audit_actor_type.sql` — `alter table place_audit_log add column actor_type text default 'human'`
  - [ ] `src/lib/actions/audit-places.ts` — `recordAudit` / `recordUpdateDiffs` 에 `actorType?: 'human' | 'pipeline'` 추가
  - [ ] 파이프라인 호출 지점(generate-candidates 등) → `actorType='pipeline'`
  - [ ] 변경 로그 UI (T-066 변경 로그 탭) 에 사람/로봇 아이콘
- **DoD**: 감사 로그에서 자동 vs 수동 변경이 시각적으로 구분

### T-069 데이터 출처 + 신뢰도 메타 *(2일)*
- **근거**: 설계안 §5 — "AI생성·신뢰도 0.82·네이버플레이스 출처 칩"
- **원칙**: 기존 `ai_generations` 테이블(013) + `places.quality_score` 는 그대로 두고, **필드 단위 메타만 JSONB 1컬럼으로 통합**. 컬럼 산포 금지.
- **작업**:
  - [ ] `019_place_field_meta.sql` — `alter table places add column field_meta jsonb`
  - [ ] 구조: `{ description: { source: 'ai:sonnet-4-6', confidence: 0.82, generated_at: '...' }, services: {...}, ... }`
  - [ ] `src/lib/admin/field-meta.ts` — 검증/머지 라이브러리 (TDD, 화이트리스트 필드만)
  - [ ] 업체 상세 페이지(T-066) 각 필드 옆 칩 렌더
- **DoD**: LLM 생성 description 은 "AI생성·0.82" 뱃지, 수동 편집은 "수동" 뱃지

---

## 6. 버킷 D — 결제·구독 (설계안 §3.9·§3.10·§3.11)

> **현재 코드베이스에 billing 관련 파일 0** 이므로 전부 신규 구축.

### T-070 결제 스키마 + 빌링키 테이블 *(2일)*
- **작업**:
  - [ ] `020_billing.sql`:
    - `customers (id, business_name, contact_phone, owner_email, ltv, created_at, ...)`
    - `subscriptions (id, customer_id, status enum, billing_key_id, next_charge_at, ...)`
    - `payments (id, subscription_id, amount, status, pg_response_code, retried_count, ...)`
    - `billing_keys (id, customer_id, pg, last4, expiry_month, status, ...)`
  - [ ] RLS: 서비스 롤 전용, 사장님 셀프 포털(T-054)에서 본인 구독만 select
  - [ ] `places.customer_id` 연결 (1 고객 ↔ N 업체)
- **DoD**: 마이그레이션 적용 후 타입 동기화

### T-071 PG 어댑터 인터페이스 + 포트원 1순위 *(3일)*
- **근거**: 설계안 §3.10
- **작업**:
  - [ ] `src/lib/billing/adapter.ts` — `issueBillingKey / chargeOnce / scheduleNext / revoke` 인터페이스
  - [ ] `src/lib/billing/portone.ts` — 1차 구현 (토스페이먼츠 호환)
  - [ ] 환경변수 없으면 mock 어댑터 폴백 (기존 `notify/email.ts`, `notify/slack.ts` 패턴 준용)
  - [ ] 테스트: 성공/실패/만료/한도초과 4개 경로
- **DoD**: 실제 PG 키 없이도 개발·테스트 완결

### T-072 결제 정책 문구 단일 소스 *(1일)*
- **근거**: 설계안 §3.11 — "카드매출전표가 부가세 적격증빙…" 4곳 일괄 반영
- **작업**:
  - [ ] `src/lib/billing/policy.ts` — 상수로 하드코딩 (어드민 CRUD 는 MVP 이후)
  - [ ] 렌더 지점: 결제 화면 / 이용약관 / 영수증 이메일 / FAQ
  - [ ] `lib/notify/email.ts` 영수증 템플릿에 삽입
- **DoD**: 4곳 문구가 동일 상수 import

### T-073 `/admin/billing/failures` 결제 실패 큐 *(3일)*
- **근거**: 설계안 §3.10 — "MRR 이탈 방어 전용 섹션"
- **컬럼**: 고객명 · 실패 사유(PG 응답코드 한국어 매핑) · 재시도 일정 · 마지막 시도 · 액션(재시도 / 재등록 링크 발송 / 해지)
- **재시도 전략**: +1d, +3d, +7d (3회) → 실패 시 `suspended`
- **알림**: T-057 `notify/email` + `notify/slack` 재사용 (이벤트 타입 추가: `payment.failed`, `payment.retry_exhausted`)
- **DoD**: 실패 1건당 4영업일 이내 재시도 3회 자동 수행

### T-074 카드 만료임박 자동 안내 *(1일)*
- **근거**: 설계안 2-3주차
- **작업**:
  - [ ] Vercel Cron → 매일 1회 `billing_keys` 스캔
  - [ ] 30일/7일 이내 만료 고객에게 이메일 (기존 `notify/email` 재사용, 이벤트 타입 `billing.expiry_warning` 추가)
  - [ ] 어드민 대시보드(T-064) 에 발송 이력 카운트 표시
- **DoD**: 만료 30일 전 1회 + 7일 전 1회 발송

---

## 7. 버킷 E — 자동화·콘텐츠 (설계안 1-2개월)

### T-075 Regenerate 공통 컴포넌트 *(2일)*
- **근거**: 설계안 §5 — "거의 모든 텍스트 필드에 재생성 버튼". 현재 `CandidatePicker` 는 `/admin/register` 전용.
- **작업**:
  - [ ] `<RegenerateButton field="description" options={{ tone, length, keywords }}>`
  - [ ] 내부적으로 T-052 `generateContentCandidates` 서버 액션 재사용 (단일/다중 후보 모드 지원)
  - [ ] 업체 상세 탭(T-066) / 블로그 편집기(T-078) 에 삽입
- **DoD**: description/services/faqs/tags 모두 재생성 가능

### T-076 `/admin/pipelines` 작업 모니터링 *(4일)*
- **근거**: 설계안 §3.7
- **작업**:
  - [ ] `021_pipeline_jobs.sql` — `(id, job_type, status enum, input_payload jsonb, error, retried, created_at)`
  - [ ] UI: 작업 카드 리스트 + 필터(실패만) + 재시도 버튼 + 입력 페이로드 확인
  - [ ] 수집 소스별 API 쿼터 표시 (네이버·카카오·Google Places)
  - [ ] 일일 LLM 토큰/비용 집계는 **기존 `ai_generations` 테이블(013) 재사용** — 신규 컬럼 추가 금지
- **DoD**: 파이프라인 실패가 실시간 가시화, 재시도 원클릭

### T-077 프롬프트 템플릿 버전 관리 *(3일)*
- **근거**: 설계안 §3.11
- **작업**:
  - [ ] `022_prompt_templates.sql` — `(id, category, version, system_prompt, user_template, created_at, active)`
  - [ ] 서버 액션 `listPrompts` / `upsertPromptVersion` / `activatePrompt`
  - [ ] A/B 집계: **기존 `ai_generations` 테이블에 `prompt_template_id` 컬럼 1개만 추가**. 별도 트래킹 테이블 금지.
- **DoD**: 카테고리별 프롬프트를 버전별로 저장·활성화, 통과율 비교 가능

### T-078 블로그 캘린더 + 검수 큐 *(4일)*
- **근거**: 설계안 §3.6 + 기존 블로그 라우트(Phase 1.5 완료)
- **작업**:
  - [ ] `/admin/blog` 월/주 캘린더 뷰
  - [ ] 토픽 큐 (자동 생성 주제 + 수동 추가) — `blog_posts` 테이블(004) 재사용, `status='draft' | 'scheduled' | 'published'` 활용
  - [ ] 편집기: 마크다운 + 프리뷰 분할 + 내부링크 자동 추천
  - [ ] 검수 큐(T-062) 에 블로그 타입 추가 — **동일 `/admin/review` 라우트에서 타입 탭만 분리**
- **DoD**: 주 1회 블로그 발행 주기를 캘린더로 조율 가능

### T-079 자동발행 안전장치 *(1일)*
- **근거**: 설계안 §5
- **작업**:
  - [ ] `023_autopublish_policy.sql` — `categories.autopublish_enabled boolean` + `review_delay_hours int default 24`
  - [ ] 파이프라인이 24시간 이내 생성물은 자동 pending 유지
- **DoD**: 카테고리별 ON/OFF + 유예 시간 설정 가능

### T-080 수동 등록 → 자동 파이프라인 트리거 *(2일)*
- **근거**: 설계안 §3.5
- **작업**:
  - [ ] `/admin/register` 에 "AI 자동완성 등록" 버튼 추가 → `pipeline_jobs` insert (T-076 테이블 재사용)
  - [ ] 수집 → 생성 → 검수 흐름 통합 테스트
- **DoD**: 업체명 한 줄 입력으로 검수 큐에 pending 진입 가능

---

## 8. 버킷 F — 분석·고도화 (3개월+)

### T-081 `/admin/seo` — AI 봇 로그 수집 *(4일)*
- **근거**: 설계안 §3.8 + 추가리뷰 §10 — "증명 도구가 제품의 핵심"
- **작업**:
  - [ ] 미들웨어에서 `User-Agent` 가 AI 봇이면 `bot_visits` 테이블에 insert
  - [ ] GPTBot / ClaudeBot / PerplexityBot / CCBot / Google-Extended 등 10+종
  - [ ] 봇별 방문 추이 + hit URL + 404 비율 시각화
  - [ ] 집계 라이브러리는 **기존 `citations/aggregate.ts` 패턴 재사용** — 별도 유틸 중복 금지
- **DoD**: "ChatGPT 봇이 이번 주 12번 방문, /cheonan/dermatology 가 TOP hit" 관측 가능
- **비고**: 추가리뷰의 "월 1회 리포트" 는 이 데이터로 자동 생성 → **고객 락인의 핵심**

### T-082 `/admin/customers` 라이프사이클·LTV·코호트 *(5일)*
- **근거**: 설계안 §3.9
- **작업**:
  - [ ] 구독 상태별 보기(체험/유료/연체/해지) + LTV 계산
  - [ ] 월별 가입 코호트 리텐션 차트
  - [ ] 해지 사유 태그 집계
- **DoD**: "2026-03 코호트 리텐션 80%" 관측 가능

### T-083 커맨드 팔레트 (⌘K) *(2일)*
- **근거**: 설계안 §4
- **작업**:
  - [ ] cmdk 라이브러리 도입
  - [ ] 액션: 업체 검색 / 페이지 이동 / 최근 본 항목 / 검수 큐 이동
- **DoD**: 어드민 어느 화면에서도 ⌘K 로 업체 검색 가능

### T-084 A/B 프롬프트 실험 + 품질 지표 *(3일)*
- **근거**: 설계안 §3.11
- **작업**:
  - [ ] T-077 프롬프트 버전과 T-027 `quality_score` 연결
  - [ ] 버전별 평균 스코어 + 검수 통과율 비교 UI
- **DoD**: "v3 프롬프트가 v2 대비 검수 통과율 +12%" 관측 가능

---

## 9. 의료·리뷰 컴플라이언스 (추가리뷰 §4 리스크 2·3)

Phase 7 진행과 **병렬로** 선제 대응.

### T-CP1 의료 카테고리 정책 가드 *(1일)*
- [ ] 피부과·치과·한의원 카테고리는 가격을 "상담 문의" 로 강제 (T-048 validation 확장)
- [ ] 시술명 자동 생성 시 금칙어 필터 (의료광고 심의 대상 표현 차단)
- [ ] 업체 상세 페이지 하단 "이 정보는 참고용이며 실제 시술 전 전문의 상담 필요" 강제 표시 (T-004 재사용)

### T-CP2 리뷰 저작권 안전 *(1일)*
- [ ] Google/Naver 리뷰 본문 스크래핑 금지 — URL + 점수만 보관
- [ ] 기존 `review_summaries` 테이블의 `sampleQuote` 를 패러프레이즈 여부 플래그로 재정의
- [ ] T-021~T-023 블로그/카페 요약 파이프라인에 인용 길이 50자 제한

---

## 10. 외부 의존 + 환경변수

배포 전 필수:

| 변수 | 용도 | TASK |
|---|---|---|
| `PORTONE_API_KEY`, `PORTONE_STORE_ID` | 빌링키 발급·결제 | T-071 |
| `TOSS_PAYMENTS_SECRET_KEY` | Fallback PG | T-071 |
| `VERCEL_CRON_SECRET` | 만료임박·결제 재시도 배치 | T-073, T-074 |
| `RESEND_API_KEY`, `RESEND_FROM`, `ADMIN_NOTIFY_EMAIL` | 이메일 알림 | Phase 6 완료 |
| `SLACK_WEBHOOK_URL` | 어드민 슬랙 | Phase 6 완료 |
| `NEXT_PUBLIC_SITE_URL` | 이메일 링크 | Phase 6 완료 |

---

## 11. 리스크 ↔ 완화 매핑

| 리스크 (추가리뷰 §4) | 완화 TASK |
|---|---|
| AI 크롤러 정책 변경 | T-081 봇 로그로 감지 + T-069 소스 메타로 저품질 선제 차단 |
| 증명 가능성 한계 | T-081 봇 로그 + Phase 6 T-056 인용 추적 → 월 1회 리포트 자동 생성 |
| 의료 법적 리스크 | T-CP1 가드 |
| 리뷰 저작권 | T-CP2 가드 |
| 1인 번아웃 | T-062 검수 큐 + T-075 재생성 버튼 + T-076 파이프라인 + T-080 자동 등록 |
| 플랫폼 흡수 | 디두 본업 업셀 경로 유지 (비즈니스 디자인) |

---

## 12. 실행 순서 & 마일스톤

### Milestone 0: Hotfix *(반일)*
H-01 `citation_results` 코드-DB 정합화

### Milestone 1: "어드민이 빨라진다" *(1주)*
T-058, T-059, T-060, T-063 → 2.1초 → 600ms, 뱃지·토스트·확인 모달 정비

### Milestone 2: "검수 큐가 중심이다" *(2주)*
T-061, T-062, T-064, T-065, T-066, T-067, T-068, T-069 → 운영자가 대시보드 + 검수 큐 두 페이지로 하루 시작

### Milestone 3: "33,000원 이탈 방어" *(3주)*
T-070~T-074 → 빌링키 + 재시도 + 만료 안내 + 영수증. PG 키 세팅 후 실사용 가능

### Milestone 4: "자동화가 돈다" *(6주)*
T-075~T-080 → AI 원본 → 검수 → 발행 한 파이프라인

### Milestone 5: "증명·분석" *(10주)*
T-081~T-084 → 월 1회 리포트 자동 생성, ⌘K, A/B

---

## 13. 이 계획의 TDD·하네스 준수

Phase 6 까지와 동일 규칙 유지:

- 모든 src 파일 변경 → 대응 테스트 파일 존재 (G2)
- 변경된 lib 파일 coverage ≥ 80% (G3)
- 모든 커밋 메시지에 `T-NNN` 참조 (G1)
- 각 커밋 전 `npm run harness:review --task T-NNN --notes "..."` 기록 (G4)
- TASKS.md 에 TASK 상태 진행 (G5)

Phase 6 종료 기준선: **899 tests / 79 test files / 5-gate pass**
Phase 7 완료 목표: **1,100+ tests / 5-gate 유지**

---

## 14. 스키마 중복 방지 체크리스트

계획 실행 시 아래를 반복 확인:

- [ ] 같은 개념(예: "AI 생성 메타")을 위해 **한 테이블의 JSONB 1 컬럼** 으로 통합 (`places.field_meta`) — 필드별 컬럼 산포 금지
- [ ] `ai_generations`(013), `place_audit_log`(015), `citation_results`(001), `blog_posts`(004) 등 기존 테이블에 필요한 컬럼을 **alter table** 로 추가할 것. 유사 이름의 새 테이블 금지.
- [ ] 새 테이블 신설 시 기존 테이블과의 조인 키를 먼저 확인. 2-3곳에서 같은 정보를 중복 조회하지 않도록.
- [ ] 알림/로깅은 Phase 6 의 `notify/*`, `audit/*` 인프라만 확장. 신규 notification helper 금지.

---

## 15. 다음 단계

1. 이 계획서 리뷰 → 승인
2. `docs/리뷰/TASKS.md` 에 T-058~T-084 + T-CP1/CP2 + H-01 을 `🔜 대기` 로 일괄 등록
3. Milestone 0 (H-01 hotfix) → Milestone 1 순서로 착수

> 본 계획은 `추가리뷰.md` §6 "얼마나 빨리 최소 기능으로 런칭하고 반복 개선하느냐" 원칙을 따른다. 완성도보다 **속도** 우선.
