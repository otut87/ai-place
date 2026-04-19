# TASKS — aiplace.kr 실행 작업 목록

> **기반**: [WORK_ORDER_aiplace_review.md](WORK_ORDER_aiplace_review.md) + `docs/admin 구현 계획서.md`
> **원칙**: "무엇을"은 WO, "어떻게·언제·어떤 파일"은 이 문서. 단일 PR 단위(1~8시간)로 분해.
> **상태**: `🔜 대기` · `⏳ 진행` · `✅ 완료` · `⏸ 블락` · `❌ 취소`
> **축 태그**: `[SEO]` `[AEO]` `[GEO]` `[Admin]` `[Ops]` `[Billing]` `[Compliance]`
> **완료 이력 원본**: [TASKS_archive.md](TASKS_archive.md) — Phase -1~6 의 상세 DoD/작업 목록은 아카이브에 보존

---

## 📊 Phase 요약

| Phase | 목적 | TASK 범위 | 상태 | 기간 |
|---|---|---|---|---|
| **-1** Bootstrap | 개발 하네스 | T-000 | ✅ | 반나절 |
| **0** | 사실 정확도 확보 | T-001~T-005 | ✅ | 1-2일 |
| **1** | 템플릿·포맷 정리 | T-006~T-010 | ✅ | 2일 |
| **1.5** ⭐ | 블로그 시스템 + 12개 페이지 마이그레이션 | T-010a~T-010i | ✅ | 4-6일 |
| **2** | Admin 대량 등록 UX | T-011~T-020 | ✅ | 4-5일 |
| **3** | LLM 품질 파이프라인 | T-021~T-028 | ✅ | 3-4일 |
| **4** | GEO·AEO 구조화 데이터 | T-029~T-035 | ✅ | 2-3일 |
| **5** | SEO·CWV·접근성 | T-036~T-045 | ✅ | 3일 |
| **6** | 확장성·운영 자동화 | T-046~T-057 | ✅ | 1-2주 |
| **7** | Admin 재설계 (IA·성능·검수·결제·자동화·분석) | **H-01 + T-058~T-084 + T-085/086** | 🔜 | 3개월 |

**기준선**: Phase 6 종료 시점 — 899 tests / 79 test files / 5-gate 통과.

---

## 🛡️ Workflow Policy (T-000 이후 모든 TASK 적용)

```
TASK 등록 (🔜) → Tests 먼저 (TDD) → 구현 (tests green) → coverage ≥80%
  → harness:review 기록 → TASK 상태 ✅ → commit (T-NNN 참조 필수) → npm run build
```

하네스가 빌드 오류로 처리: 테스트 없는 src / coverage <80% / 리뷰 기록 없는 커밋 / TASK 참조 없는 커밋 / 상태 미업데이트.

**예외 우회**: `SKIP_HARNESS=1 npm run build` (비상시만).

---

## ✅ 완료된 TASK (Phase -1 ~ 6)

### Phase -1 · Bootstrap
| ID | 제목 | 축 | 커밋 |
|---|---|---|---|
| T-000 | Development Harness 구축 (5 gate) | [Ops] | 하네스 초기화 |

### Phase 0 · 사실 정확도
| ID | 제목 | 축 | 커밋 |
|---|---|---|---|
| T-001 | 수피부과 전면 제거 (data.ts) | [GEO][AEO] | T-001 커밋 |
| T-002 | ❌ SUPERSEDED → T-010e | — | — |
| T-003 | 숫자 단일 소스 `lib/site-stats.ts` | [GEO] | 6953589 |
| T-004 | 업종별 면책 분기 컴포넌트 | [AEO][GEO] | 48a7b8e |
| T-005 | 푸터 동적화 | [SEO] | 16dcbbe |

### Phase 1 · 템플릿·포맷 정리
| ID | 제목 | 축 |
|---|---|---|
| T-006 | 업체 상세 H1 포맷 통일 | [SEO][AEO][GEO] |
| T-007 | "비교 비교" 중복 버그 수정 | [AEO] |
| T-008 | AggregateRating JSON-LD 버그 수정 | [AEO][GEO] |
| T-009 | 리뷰/평점 포맷 유틸 `lib/format/rating.ts` | [AEO] |
| T-010 | 영업시간·가격·주소 포맷 유틸 | [AEO] |

→ **커밋**: `37b8f14` (T-006~T-010 Phase 1 일괄)

### Phase 1.5 · 블로그 시스템 (WO #47)
| ID | 제목 | 축 |
|---|---|---|
| T-010a | DB 스키마: `blog_posts` 테이블 | [SEO][GEO] |
| T-010b | BlogPost 타입 + 데이터 레이어 | [SEO][GEO] |
| T-010c | 블로그 홈 `/blog` | [SEO][GEO] |
| T-010d | 블로그 글 상세 | [SEO][AEO][GEO] |
| T-010e | 마이그레이션 스크립트 | [SEO][GEO] |
| T-010f | 301 Redirect | [SEO] |
| T-010g | 기존 라우트 제거 | [SEO] |
| T-010h | Breadcrumb 2종 분리 (WO #12) | [SEO][AEO] |
| T-010i | 사이트맵·llms.txt·IndexNow | [SEO][GEO] |

→ **커밋**: `cf9f348`, `8568597` 외

### Phase 2 · Admin 대량 등록 (WO #46)
| ID | 제목 | 축 |
|---|---|---|
| T-011 | Kakao Local Search 클라이언트 | [Admin][GEO] |
| T-012 | Google Places 매칭 보강 | [Admin][GEO] |
| T-013 | Naver 지역 검색 클라이언트 | [Admin][GEO] |
| T-014 | 통합 검색 + Dedup/Merge | [Admin][GEO] |
| T-015 | 카테고리 자동 판별 (Tier 1-2-3) | [Admin][GEO] |
| T-016 | 도시 자동 매핑 (sigunguCode) | [Admin] |
| T-017 | Daum Postcode (수동 Fallback) | [Admin] |
| T-018 | 검색 UI 리팩터 (단일 입력) | [Admin] |
| T-019 | `Place` 타입 + DB migration | [Admin][GEO] |
| T-020 | 등록 validation 완화 | [Admin] |

→ **커밋**: `708c149` (T-011~T-020 Phase 2), `1da3c89` (T-018 수정)

### Phase 3 · LLM 품질 파이프라인
| ID | 제목 | 축 |
|---|---|---|
| T-021 | 네이버 블로그 검색 클라이언트 | [GEO] |
| T-022 | 네이버 카페 검색 클라이언트 | [GEO] |
| T-023 | Haiku 전처리: 블로그·카페 요약 | [GEO] |
| T-024 | Sonnet 메인 모델 교체 | [GEO] |
| T-025 | Tool Use 구조화 출력 | [GEO] |
| T-026 | Few-Shot Exemplar 라이브러리 | [GEO] |
| T-027 | 품질 스코어링 게이트 | [GEO] |
| T-028 | 생성 시간·토큰 로깅 | [Admin][GEO] |

→ **커밋**: `8b66f63` (T-021~T-028 Phase 3)

### Phase 4 · GEO/AEO 구조화
| ID | 제목 | 축 |
|---|---|---|
| T-029 | sameAs 데이터 입력 파이프라인 | [GEO] |
| T-030 | ❌ SUPERSEDED → T-010h | — |
| T-031 | 블로그 글 ItemList 스키마 | [AEO] |
| T-032 | robots.ts — Yeti/Daum/Bingbot 추가 | [SEO][GEO] |
| T-033 | OG/Twitter 메타 보강 | [SEO] |
| T-034 | Thin 카테고리 처리 — 가이드 본문 | [SEO] |
| T-035 | 날짜 자동화 | [GEO] |

→ **커밋**: `8587620` (T-029~T-035), `761c61a`/`8b8077a` (T-029 ESM 수정)

### Phase 5 · SEO·CWV·접근성
| ID | 제목 | 축 |
|---|---|---|
| T-036 | Pretendard self-host | [SEO] |
| T-037 | 이미지 sizes 감사 | [SEO] |
| T-038 | 접근성 보강 | [SEO] |
| T-039 | CWV 측정 도입 | [SEO] |
| T-040 | 보안 헤더 점검 | [SEO] |
| T-041 | 태그 표기 점검 | [SEO] |
| T-042 | `/admin/register` 직접 링크 grep | [SEO] |
| T-043 | 업체 슬러그 규칙 통일 | [SEO] |
| T-044 | 홈 "83개 업종" 해석 명확화 | [SEO][AEO] |
| T-045 | 업체 상세 템플릿 점검 | [SEO] |

→ **커밋**: `b47a1ec` (T-036~T-045 Phase 5)

### Phase 6 · 확장성·운영 자동화
| ID | 제목 | 축 | 커밋 |
|---|---|---|---|
| T-046 | Admin 목록 검색·필터·페이지네이션 | [Admin] | `ec729db` |
| T-047 | Admin 일괄 작업 (Bulk Actions) | [Admin] | `ec729db` |
| T-048 | Admin 실시간 검증 + 미리보기 | [Admin][GEO] | `ec729db` |
| T-049 | Admin 인라인 편집 | [Admin] | `ec729db` |
| T-051 | 메타데이터 중앙화 `lib/seo/page-meta.ts` | [SEO][AEO][GEO] | `ec729db` |
| T-053 | CSV 일괄 등록 | [Admin] | `ec729db` |
| T-052 | 다중 후보 LLM 생성 + 어드민 선택 | [GEO] | `7851bb7` |
| T-050 | 이미지 업로드 (Supabase Storage) | [Admin][SEO][GEO] | `22e236f` |
| T-055 | 업체 감사 로그 | [Ops] | `84b01f1` |
| T-056 | AI 인용 추적 대시보드 | [GEO] | `776068b` |
| T-057 | 알림 시스템 (이메일 + 슬랙) | [Ops] | `60b4f57` |
| T-054 | 사장님 셀프 포털 | [GEO][Admin] | `6cb61d5` |

<details>
<summary>📎 완료 TASK 헤더 스터브 (하네스 G5 파싱용 — 표시 숨김)</summary>

하네스(`scripts/harness/gates/task-status.ts`)가 `## T-NNN` 섹션 헤더를 스캔하여 상태(✅/⏳/🔜)를 파싱합니다. 본문 축약 이후에도 G5 가 통과하도록 아래 스터브를 유지합니다. 상세 내용은 위 표 + git history + `TASKS_archive.md` 참조.

## T-000. Development Harness ✅
## T-001. 수피부과 전면 제거 ✅
## T-003. 숫자 단일 소스 site-stats.ts ✅
## T-004. 업종별 면책 분기 컴포넌트 ✅
## T-005. 푸터 동적화 ✅
## T-006. 업체 상세 H1 포맷 통일 ✅
## T-007. "비교 비교" 중복 버그 수정 ✅
## T-008. AggregateRating JSON-LD 버그 수정 ✅
## T-009. 리뷰/평점 포맷 유틸 ✅
## T-010. 영업시간·가격·주소 포맷 유틸 ✅
## T-010a. blog_posts 테이블 ✅
## T-010b. BlogPost 타입 + 데이터 레이어 ✅
## T-010c. /blog 홈 라우트 ✅
## T-010d. 블로그 글 상세 라우트 ✅
## T-010e. 블로그 마이그레이션 스크립트 ✅
## T-010f. 301 Redirect ✅
## T-010g. 기존 라우트 제거 ✅
## T-010h. Breadcrumb 2종 분리 ✅
## T-010i. 사이트맵·llms.txt·IndexNow ✅
## T-011. Kakao Local Search 클라이언트 ✅
## T-012. Google Places 매칭 보강 ✅
## T-013. Naver 지역 검색 클라이언트 ✅
## T-014. 통합 검색 + Dedup/Merge ✅
## T-015. 카테고리 자동 판별 ✅
## T-016. 도시 자동 매핑 ✅
## T-017. Daum Postcode 컴포넌트 ✅
## T-018. 검색 UI 리팩터 ✅
## T-019. Place 타입 + DB migration ✅
## T-020. 등록 validation 완화 ✅
## T-021. 네이버 블로그 검색 ✅
## T-022. 네이버 카페 검색 ✅
## T-023. Haiku 전처리 ✅
## T-024. Sonnet 메인 모델 교체 ✅
## T-025. Tool Use 구조화 출력 ✅
## T-026. Few-Shot Exemplar 라이브러리 ✅
## T-027. 품질 스코어링 게이트 ✅
## T-028. 생성 시간·토큰 로깅 ✅
## T-029. sameAs 데이터 입력 파이프라인 ✅
## T-031. 블로그 글 ItemList 스키마 ✅
## T-032. robots.ts 봇 추가 ✅
## T-033. OG/Twitter 메타 보강 ✅
## T-034. Thin 카테고리 처리 ✅
## T-035. 날짜 자동화 ✅
## T-036. Pretendard self-host ✅
## T-037. 이미지 sizes 감사 ✅
## T-038. 접근성 보강 ✅
## T-039. CWV 측정 도입 ✅
## T-040. 보안 헤더 점검 ✅
## T-041. 태그 표기 점검 ✅
## T-042. /admin/register 직접 링크 grep ✅
## T-043. 업체 슬러그 규칙 통일 ✅
## T-044. 홈 "83개 업종" 해석 명확화 ✅
## T-045. 업체 상세 템플릿 점검 ✅
## T-046. Admin 목록 검색·필터·페이지네이션 ✅
## T-047. Admin 일괄 작업 ✅
## T-048. Admin 실시간 검증 ✅
## T-049. Admin 인라인 편집 ✅
## T-050. 이미지 업로드 (Supabase Storage) ✅
## T-051. 메타데이터 중앙화 ✅
## T-052. 다중 후보 LLM 생성 ✅
## T-053. CSV 일괄 등록 ✅
## T-054. 사장님 셀프 포털 ✅
## T-055. 업체 감사 로그 ✅
## T-056. AI 인용 추적 대시보드 ✅
## T-057. 알림 시스템 ✅

### 폐기된 TASK
## T-002. /k/recommend 카니발 ❌ SUPERSEDED → T-010e
## T-030. Breadcrumb 레벨 통일 ❌ SUPERSEDED → T-010h

</details>

---

## 🔜 Phase 7 — Admin 재설계 (활성 작업)

> 소스: `docs/admin 구현 계획서.md` · 설계안 · 속도 진단 · 추가리뷰
> 원칙: 기존 테이블(`ai_generations`/`place_audit_log`/`citation_results`/`blog_posts` 등)에 **alter table** 로 증분. 같은 개념에 컬럼 산포 금지.

### Milestone 0 — Hotfix

## T-057h. `citation_results` 코드-DB 정합화 ✅ [GEO]
(하네스 호환: T-NNN 형식. 구 명칭 H-01)
`001_initial_schema.sql` 이 이미 `citation_results` 정의 (prompt_id uuid FK, text[], session_id NOT NULL). Phase 6 의 `016_*` 은 `create table if not exists` 라 noop. 코드만 정합화 필요.
- [ ] `src/lib/actions/citations.ts` — `cited_sources/places` `string[]`, `session_id` required
- [ ] `src/lib/citations/aggregate.ts` `CitationRow` 타입 동기화
- [ ] `016_citation_results.sql` 삭제 또는 001 보조 인덱스만 유지
- **DoD**: 기존 15 tests 통과, 001 스키마와 앱 타입 일치

### Milestone 1 — 성능·UX 패치 (1주)

## T-058. Admin Link prefetch 비활성화 ✅ [Ops]
속도 진단 원인 1 — `_rsc` 6회 반복(2.7초).
- [ ] admin 전수 `<Link prefetch={false}>`, `AdminNavLink` 공용 추출
- **DoD**: admin 이동 시 `_rsc` prefetch 0건

## T-059. Production 빌드 검증 ✅ [Ops]
속도 진단 원인 2 — turbopack 청크 의심.
- [ ] Vercel build logs 에서 `next build` + `NODE_ENV=production` 확인
- [ ] `/admin/*` 에 `runtime = 'nodejs'` 명시
- [ ] bundle analyzer 리포트
- **DoD**: 청크에 turbopack 흔적 없음

## T-060. GA `lazyOnload` ✅ [Ops]
현재 `analytics.tsx` = `afterInteractive`.
- [ ] `<Script strategy="lazyOnload">` 로 변경
- [ ] `/admin/*`, `/owner/*` 에서 Analytics 제외
- **DoD**: GA 가 DOMContentLoaded 이후에만 로드

### Milestone 2 — IA 재구성 + 대시보드 (2주)

## T-061. 좌측 사이드바 + 글로벌 바 ✅ [Admin]
- [ ] `components/admin/sidebar.tsx` (접기, localStorage persist)
- [ ] `components/admin/topbar.tsx` (⌘K 자리 · 검수 뱃지 · 결제 실패 뱃지)
- [ ] `admin/layout.tsx` 리팩터, shadcn `--primary` Place Green 오버라이드
- **DoD**: 모든 admin 페이지 동일 섀시 + 풀폭

## T-062. `/admin/review` 검수 큐 v1 ✅ [Admin]
설계안 §3.2 — 가장 자주 쓰는 페이지.
- [ ] 좌측 pending 리스트 + 우측 diff 분할 뷰
- [ ] 단축키 `⌘↵`/`⌘⌫`/`J/K`
- [ ] 반려 사유 태그(`fact_error | tone | seo | duplicate`)
- [ ] `approvePlace` / `rejectPlace` 서버 액션 — 기존 `bulk-places` + audit 로깅 재사용
- **DoD**: 키보드만으로 pending 처리 가능

## T-063. 저장 토스트 + 파괴 액션 모달 ✅ [Admin]
- [ ] `sonner` 도입 또는 `useToast` hook
- [ ] `<ConfirmNameModal>` — 삭제·대량 비활성
- [ ] `window.confirm()` 2곳 교체
- **DoD**: 파괴 액션은 업체명 타이핑 일치 강제

## T-064. `/admin` 운영 대시보드 ✅ [Admin]
현재 2-link 런처.
- [ ] 액션 카드 4개 (검수 대기 / 발행 예정 / 실패 작업 / 결제 실패·만료임박)
- [ ] 중단 지표 (AI 크롤러 추이 · MRR · 결제 실패)
- [ ] 하단 활동 로그 (T-068 actor_type 아이콘)
- **DoD**: "오늘 해야 할 일" 한 장 파악

## T-065. Places 목록 보강 (증분) ✅ [Admin]
T-046 위에 증분. 필터·URL 쿼리·일괄 액션은 완료됨.
- [ ] 컬럼 추가: 구독상태(T-070 조인), AI 노출 점수(`quality_score`)
- [ ] 필터 `subscription` · `min_quality_score`
- **DoD**: `?subscription=paid&min_quality_score=70` 동작

## T-066. `/admin/places/[id]` 탭 + 체크리스트 ✅ [Admin]
현재 145줄 flat form.
- [ ] 탭: 개요/서비스/FAQ/태그/블로그/SEO/자동화 이력/변경 로그
- [ ] 자동저장 + 토스트 + diff (`recordUpdateDiffs` 재사용)
- [ ] 우측 사이드바 체크리스트 — `place-validation.ts` 재활용
- **DoD**: 완성도 90점 미만 업체는 경고 배너

## T-067. SC 병렬화 + `cache()` ✅ [Ops]
속도 진단 원인 4 — DOM Ready 1.8s 직렬.
- [ ] `/admin/places` places query `Promise.all`
- [ ] admin 내부 `requireAuth()` 중복 제거 (middleware 단일화)
- [ ] `React.cache()` + `loading.tsx` Suspense
- **DoD**: `/admin/places` DOM Ready < 600ms

## T-068. `place_audit_log.actor_type` ✅ [Ops]
T-055 누락분.
- [ ] `018_audit_actor_type.sql` — `alter table place_audit_log add column actor_type text default 'human'`
- [ ] `recordAudit`/`recordUpdateDiffs` 에 `actorType?: 'human' | 'pipeline'`
- [ ] 파이프라인 호출 지점 `actorType='pipeline'`
- **DoD**: 변경 로그 UI 에 사람/로봇 구분

## T-069. `places.field_meta` JSONB ✅ [GEO][Admin]
필드별 출처·신뢰도 메타. **1 컬럼 통합**.
- [ ] `019_place_field_meta.sql` — `alter table places add column field_meta jsonb`
- [ ] 구조: `{ description: { source, confidence, generated_at }, services: {...} }`
- [ ] `src/lib/admin/field-meta.ts` (TDD)
- [ ] T-066 탭에 칩 렌더
- **DoD**: AI 필드는 "AI·0.82" 뱃지, 수동은 "수동"

### Milestone 3 — 결제·구독 (2주)

## T-070. 결제 스키마 ✅ [Billing]
- [ ] `020_billing.sql`: `customers / subscriptions / payments / billing_keys`
- [ ] RLS: service role 전용, 사장님 포털에서 본인 구독 select
- [ ] `places.customer_id` 연결
- **DoD**: 마이그레이션 + 타입 동기화

## T-071. PG 어댑터 + 토스페이먼츠 🔜 [Billing]
- [ ] `src/lib/billing/adapter.ts` — `issueBillingKey / chargeOnce / scheduleNext / revoke / verifyWebhook`
- [ ] `toss.ts` 1차 구현 + mock 폴백 (notify 패턴). 공개 테스트키로 시작
- [ ] 테스트: 성공/실패/만료/한도초과 4경로 (테스트 카드번호 규칙)
- **DoD**: 가맹점 가입 전 공개 테스트키로 테스트 완결

## T-072. 결제 정책 문구 단일 소스 🔜 [Billing]
"카드매출전표가 부가세 적격증빙…" 4곳 일괄.
- [ ] `src/lib/billing/policy.ts` 상수
- [ ] 렌더: 결제 / 약관 / 영수증 / FAQ
- **DoD**: 4곳 동일 상수 import

## T-073. `/admin/billing/failures` 결제 실패 큐 🔜 [Billing]
- [ ] PG 응답코드 한국어 매핑 + 재시도 스케줄(+1d/+3d/+7d)
- [ ] 3회 실패 → `suspended`
- [ ] 알림: `payment.failed`, `payment.retry_exhausted` (notify/* 재사용)
- **DoD**: 실패 1건 4영업일 이내 재시도 3회

## T-074. 카드 만료임박 자동 안내 ✅ [Billing]
- [ ] Vercel Cron 매일 스캔
- [ ] 30일/7일 이내 만료 고객 이메일 (`billing.expiry_warning`)
- **DoD**: 만료 30/7일 전 각 1회 발송

### Milestone 4 — 자동화·콘텐츠 (6주)

## T-075. Regenerate 공통 컴포넌트 ✅ [GEO][Admin]
현재 `CandidatePicker` register 전용.
- [ ] `<RegenerateButton field options={tone,length,keywords}>`
- [ ] T-052 `generateContentCandidates` 재사용
- [ ] T-066 탭 + T-078 블로그 편집기에 삽입
- **DoD**: description/services/faqs/tags 재생성 가능

## T-076. `/admin/pipelines` 작업 모니터링 🔜 [Ops][Admin]
- [ ] `021_pipeline_jobs.sql` — job_type/status/input_payload/error/retried
- [ ] UI: 실패 필터 + 재시도 + 페이로드
- [ ] API 쿼터 표시 (네이버/카카오/Google)
- [ ] LLM 토큰·비용은 **기존 `ai_generations`(013) 재사용** — 신규 테이블 금지
- **DoD**: 실패 가시화 + 재시도 원클릭

## T-077. 프롬프트 템플릿 버전 관리 🔜 [GEO]
- [ ] `022_prompt_templates.sql` — `(category, version, system_prompt, user_template, active)`
- [ ] list/upsert/activate 서버 액션
- [ ] A/B 집계: **기존 `ai_generations` 에 `prompt_template_id` 컬럼 1개 추가**
- **DoD**: 버전별 저장·활성화·통과율 비교

## T-078. 블로그 캘린더 + 검수 큐 🔜 [SEO][GEO]
- [ ] `/admin/blog` 월/주 캘린더
- [ ] 토픽 큐 — `blog_posts`(004) `status` 재사용
- [ ] 편집기: 마크다운 + 프리뷰 + 내부링크
- [ ] T-062 `/admin/review` 에 블로그 타입 탭 추가 (별도 라우트 금지)
- **DoD**: 주간 발행 캘린더로 조율

## T-079. 자동발행 안전장치 🔜 [Ops]
- [ ] `023_autopublish_policy.sql` — `categories.autopublish_enabled` + `review_delay_hours default 24`
- [ ] 24시간 이내 생성물은 pending 유지
- **DoD**: 카테고리별 ON/OFF + 유예 설정

## T-080. 수동 등록 → 자동 파이프라인 ✅ [Admin]
- [ ] `/admin/register` "AI 자동완성 등록" 버튼 → `pipeline_jobs` insert
- [ ] 수집 → 생성 → 검수 통합 테스트
- **DoD**: 업체명 한 줄 입력 → pending 진입

### Milestone 5 — 분석·고도화 (10주+)

## T-081. `/admin/seo` AI 봇 로그 ✅ [GEO]
추가리뷰 §10 — "증명 도구가 제품의 핵심".
- [ ] 미들웨어에서 AI 봇 UA 감지 → `bot_visits` insert
- [ ] GPTBot/ClaudeBot/PerplexityBot/CCBot/Google-Extended 10+ 종
- [ ] 집계는 **기존 `citations/aggregate.ts` 패턴 재사용**
- **DoD**: 월 1회 리포트 자동 생성 기반 확보

## T-082. `/admin/customers` 라이프사이클·LTV·코호트 🔜 [Billing]
- [ ] 구독 상태별 보기 + LTV
- [ ] 월별 코호트 리텐션
- [ ] 해지 사유 태그 집계
- **DoD**: 코호트 리텐션 관측 가능

## T-083. 커맨드 팔레트 (⌘K) 🔜 [Admin]
- [ ] `cmdk` 도입
- [ ] 업체 검색 · 페이지 이동 · 최근 본 항목 · 검수 큐
- **DoD**: 전역 ⌘K 검색

## T-084. A/B 프롬프트 실험 ✅ [GEO]
- [ ] T-077 버전 ↔ T-027 `quality_score` 연결
- [ ] 버전별 평균 스코어 + 통과율 비교 UI
- **DoD**: "v3 대비 +12%" 관측 가능

### 컴플라이언스 (병렬)

## T-085. 의료 카테고리 정책 가드 🔜 [Compliance]
추가리뷰 §4 리스크 2.
- [ ] 피부과·치과·한의원은 가격 "상담 문의" 강제 (T-048 확장)
- [ ] 시술명 자동 생성 시 의료광고 금칙어 필터
- [ ] 참고 문구 강제 표시 (T-004 재사용)

## T-086. 리뷰 저작권 안전 🔜 [Compliance]
추가리뷰 §4 리스크 3.
- [ ] Google/Naver 리뷰 본문 스크래핑 금지 — URL + 점수만
- [ ] `review_summaries.sampleQuote` 패러프레이즈 여부 플래그로 재정의
- [ ] T-021~T-023 요약 파이프라인에 인용 길이 50자 제한

---

## 📐 Phase 7 스키마 중복 방지 원칙

1. 같은 개념(AI 생성 메타 등)은 **1 테이블의 JSONB 1 컬럼** 으로 통합
2. `ai_generations`(013) / `place_audit_log`(015) / `citation_results`(001) / `blog_posts`(004) 등 기존 테이블에 **alter table** 로 증분
3. 유사 이름의 새 테이블 금지 — 조인 키 먼저 확인
4. 알림·로깅은 Phase 6 의 `notify/*`, `audit/*` 인프라만 확장

---

## 📋 WO ↔ TASK 매핑 요약

47개 WO 항목 모두 TASK 매핑 완료. 상세 매핑표는 [TASKS_archive.md](TASKS_archive.md) `## 📋 WO ↔ TASK 매핑` 섹션 참조.

### 폐기·통합 TASK
- **T-002** ❌ → T-010e (블로그 마이그레이션) 일환
- **T-030** ❌ → T-010h (블로그 + 업체 breadcrumb 2종 분리)

---

## 🗂 문서 유지 정책

- TASK 완료 시 Phase 6 완료 테이블처럼 커밋 해시와 함께 한 줄 요약으로 이동
- 블락 시 `⏸` + 사유 명시
- 새 TASK 발견 시 해당 Phase 말단에 추가
- 상세 구현 DoD·작업 목록은 완료 시점에 git history / `TASKS_archive.md` 로 이관
- 이 문서는 **활성 작업(🔜/⏳) 중심**으로 유지 — 500줄 이내 목표
