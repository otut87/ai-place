# WORK ORDER: aiplace.kr 통합 리뷰 & 작업 지시서

> **작성일**: 2026-04-17 (통합본)
> **검토 기반**: 2026-04-17 전체 크롤링 리뷰 + SEO/기술 리뷰
> **담당**: Claude Code (지수님 지시)
> **목표**: B-level AI 인용 검증 이전에 데이터 불일치 / 컴포넌트 버그 / SEO 약점 제거

---

## 0. 사이트 평가 요약 (TL;DR)

**한 줄 평**: SEO·AEO·GEO 3축 최적화를 전면에 내세운 Next.js 기반 로컬 디렉토리. 메타·스키마 설계는 상위 5% 수준으로 탄탄하지만, 콘텐츠 공급량 부족과 일부 템플릿 중복 / 숫자 불일치가 현재 가장 큰 약점.

| 영역 | 평가 | 핵심 메모 |
|---|---|---|
| robots / sitemap | A | AI 봇(OAI, Claude, GPTBot, Perplexity 등) 화이트리스트 명시적 — GEO 의도 명확 |
| 메타 / OG / Twitter | A | 모든 페이지 canonical·OG·Twitter Card 존재. 동적 OG 이미지 |
| 구조화 데이터 (JSON-LD) | A+ | MedicalClinic / Restaurant / ProfessionalService / AutoRepair / HomeAndConstructionBusiness / Article / FAQPage / BreadcrumbList — 카테고리별 schema.org 매핑 정확 |
| 제목·헤딩 위계 | B | H1 1개 유지. 업체 상세 H1이 단어 1개(예: "단비", "디두")로 빈약. 상세 페이지에 H3 부재 |
| 콘텐츠 품질 | C | 일부 카테고리 업체 1곳만 등록(thin). "3곳 비교"가 실제 2곳 노출 |
| 중복 / 카니발라이제이션 | C | `/cheonan/dermatology` ≈ `/cheonan/dermatology/k/recommend` 동일 H1·타이틀 |
| 템플릿 누수 | C | 비의료 업체 페이지에 의료 면책 문구 노출 |
| 프레임워크 / 퍼포먼스 | B+ | Next.js App Router, Pretendard 변수 폰트(jsdelivr CDN), 이미지 최적화 여지 |
| 접근성 | B- | placeholder SVG `alt` 미설정. `#6a6a6a` 컬러 컨트라스트 AAA 미달 |

**최우선 수정 Top 5**
1. `/cheonan/dermatology` vs `/k/recommend` 카니발라이제이션 해결
2. 업체 수 숫자 단일 소스화 — "3곳"/"2곳" 불일치 제거 (수피부과 처리 포함)
3. 카테고리별 푸터/면책 문구 분기 (피부과 템플릿 비의료 누수 차단)
4. Thin 카테고리(auto-repair / interior / webagency) noindex 또는 본문 보강
5. 업체 상세 H1 포맷 통일 ("이름 — 지역 카테고리") + 이미지 `alt` 자동화

---

## ⚠️ 선행 확인 (작업 시작 전 필수)

본 리뷰는 web fetch 기반이며, 일부 항목은 **CDN/ISR 캐시된 구버전**을 관찰한 결과일 수 있음.
각 항목 진입 전 브라우저에서 **실제 현재 상태 확인** → 이미 해결된 항목이면 `[SKIP: 해결됨]` 표기 후 스킵.

- [ ] 작업 시작 전, 각 P0 항목을 실제 브라우저에서 시크릿 모드로 재확인
- [ ] 캐시 오판 항목은 `[SKIP]` 표기 후 진행

---

## 🗺️ 실제 경로 매핑 (리뷰 문서 → 실제 코드)

리뷰 문서는 일반론적 경로로 작성됨. **실제 코드베이스의 경로는 아래와 같음** — 작업 전 반드시 확인.

### 핵심 경로 매핑

| 리뷰 문서 표기 | 실제 경로 | 비고 |
|---|---|---|
| `content/businesses/*.ts` | **`src/lib/data.ts`** (seed) + **Supabase `places` 테이블** | 콘텐츠 파일 시스템 없음. data.ts는 fallback + 가이드/비교/키워드 콘텐츠 저장소 |
| `content/guides/*.ts` | `src/lib/data.ts` 내 `GuidePage` 객체 + Supabase | 별도 파일 구조 아님 |
| `app/[city]/[industry]/[slug]/page.tsx` | **`src/app/[city]/[category]/[slug]/page.tsx`** | segment명 `industry` → `category` |
| `app/[city]/[industry]/page.tsx` | **`src/app/[city]/[category]/page.tsx`** | 동일 |
| `components/layout/Footer.tsx` | **`src/components/footer.tsx`** | 평면 구조, lowercase |
| `components/layout/Breadcrumb.tsx` | **존재 안 함** (JSON-LD만 `src/lib/seo.ts#generateBreadcrumbList`) | HTML breadcrumb 컴포넌트 신규 작성 필요 |
| `components/business/Disclaimer.tsx` | **존재 안 함** | 신규 작성 필요 |
| `lib/format/{address,hours,price,rating}.ts` | **존재 안 함** | 4개 유틸 신규 작성 필요 |
| `lib/seo/jsonld.ts` | **`src/lib/jsonld.ts`** | `seo/` 하위 폴더 없음, 평면 |
| `lib/seo/page-meta.ts` | **존재 안 함** (각 page.tsx 내 `generateMetadata`) | 중앙화 필요 (#21) |
| `lib/seo/schema/business.ts` | **존재 안 함** (`src/lib/jsonld.ts` 내 함수로 혼재) | 분리 필요 (#21) |
| `lib/site-stats.ts` | **존재 안 함** | 신규 작성 필요 (숫자 단일 소스화) |
| `lib/constants/disclaimers.ts` | **존재 안 함** | 신규 작성 필요 |

### 데이터 레이어 이중 구조 주의

- **`src/lib/data.ts`**: 시드 데이터 + 쿼리 함수. **가이드/비교/키워드 페이지의 본문 콘텐츠가 여기에 있음** (수피부과 언급 8군데 잔존)
- **`src/lib/data.supabase.ts`**: Supabase 어댑터. DB 미가용 시 `data.ts` fallback. 쿼리 함수 API는 동일
- **`src/lib/supabase-types.ts`**: DB 행 타입 (`DbPlace` 등) + 변환 함수

→ WO에서 "업체 데이터 수정"은 **Supabase `places` 테이블 + `data.ts` 양쪽 모두** 처리해야 할 수 있음. Fallback 시드에만 있고 DB에 없는 콘텐츠(가이드 본문, FAQ)는 `data.ts` 직접 수정.

### 기존 컴포넌트 (활용 가능)

```
src/components/
├── footer.tsx              (현재 하드코딩, #5 대상)
├── header.tsx
├── place-card.tsx          (카드 컴포넌트)
├── author-card.tsx
├── guide-section.tsx
├── comparison-table.tsx
├── source-list.tsx
├── statistics-box.tsx
├── inquiry-modal.tsx
├── phone-button.tsx
├── analytics.tsx
└── ui/                     (shadcn)
```

### 라우트 구조

```
src/app/
├── page.tsx                        # 홈 (이미 동적 집계 사용)
├── about/
├── admin/                          # 이미 존재, 인증 미들웨어 확인 필요
│   └── register/page.tsx
├── [city]/
│   └── [category]/
│       ├── page.tsx                # 카테고리 목록 (이미 noindex 로직 존재)
│       ├── [slug]/page.tsx         # 업체 상세
│       └── k/
│           └── [keyword]/page.tsx  # 키워드 랜딩 (recommend도 여기)
├── compare/[city]/[category]/[topic]/
├── guide/[city]/[category]/
├── sitemap.ts
├── robots.ts
├── llms.txt/
├── feed.xml/
├── manifest.ts
└── opengraph-image.tsx
```

**주의**: `/k/recommend` 는 별도 라우트가 아니라 `[keyword]` 동적 라우트의 한 값. `getKeywordPage(city, category, 'recommend')` 가 KeywordPage 데이터를 반환. → #2 해결은 **KeywordPage 데이터에서 recommend 제거 or 제목 차별화**로 처리.

---

## 📊 현재 코드 상태 요약 (2026-04-17 전수 검증)

모든 28개 항목을 실제 코드 대비 확인한 결과. 작업 착수 전 이 표로 빠르게 우선순위 판단.

### 상태 레이블
- 🔴 **미해결** — 코드 수정 필요
- 🟡 **부분완료** — 일부 구현, 잔여 작업 있음
- 🟢 **해결됨** — 추가 작업 불필요
- ⚪ **재검증 필요** — DB/런타임 확인 후 판단
- ❓ **정책 결정** — 옵션 중 선택 필요

### 전체 28개 항목

| # | 제목 | 상태 | 핵심 근거 | 예상 공수 |
|---|---|---|---|---|
| 1 | 수피부과 단일화 + 숫자 단일소스 | 🔴 미해결 | [data.ts](src/lib/data.ts) 8곳 잔존 (L126, 283, 285, 358, 490-491, 507, 526, 553) | 2h (제거) / 4h (등록) |
| 2 | `/k/recommend` 카니발라이제이션 | 🔴 미해결 ❓ | [k/[keyword]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/k/%5Bkeyword%5D/page.tsx) L29: `page.title` 그대로 사용 → KeywordPage 데이터 수정 필요 | 1h |
| 3 | 홈 "83개 업종" 표기 | 🟡 부분완료 | 홈 이미 동적 (`{categories.length}`). `getCategories()`가 83개 전체 반환하는 게 문제 | 30m |
| 4 | 업종별 면책 문구 분기 | 🔴 미해결 | [slug]/page.tsx L382, [k/keyword]/page.tsx L155, [compare/topic]/page.tsx L162 **3곳 모두 하드코딩** `"의료 결정은 전문의와 상담하세요"` | 2h |
| 5 | 푸터 동적화 | 🔴 미해결 | [footer.tsx](src/components/footer.tsx) L12-30 전체 하드코딩 (피부과 전용) | 1.5h |
| 6 | Thin 카테고리 처리 | 🟡 부분완료 ❓ | 0곳만 noindex. 1-2곳은 미처리. sitemap은 `activeCategoryKeys` 필터 이미 있음 | 1h |
| 7 | 업체 상세 H1 포맷 통일 | 🔴 미해결 | [slug]/page.tsx L161: `{place.name}` 단독 렌더. title metadata만 `"이름 - 도시 카테고리"` 형식 | 30m |
| 8 | 주소 포맷 정규화 | ⚪ 재검증 | seed는 모두 `"충남"` 통일됨. Supabase DB 데이터는 Google Places API 유입이라 다를 가능성 → DB 쿼리 필요 | 2h + DB확인 |
| 9 | 영업시간 포맷 통일 | 🟡 부분완료 | seed는 `"Mo-Fr ..."` OSM 스타일 통일됨. [slug]/page.tsx L255-260 regex 변환으로 화면 렌더. `lib/format/hours.ts` 미구현 | 2h |
| 10 | 가격 표기 포맷 | 🟢 거의 해결 | seed 모두 `"20-80만원"` 하이픈 통일. 단위(`/회`)는 미사용. DB 혼재만 확인 | 30m + DB확인 |
| 11 | 리뷰/평점 표기 + Review 스키마 | 🔴 미해결 | `aggregateRating`만 출력. [place-card.tsx](src/components/place-card.tsx) L42 "Google 리뷰", [slug]/page.tsx L166 "후기" 표기 혼재. 개별 `Review` 엔트리 없음. **[slug]/page.tsx L394-402 `AggregateRating` 단독 `@type`이 비표준** | 2h |
| 12 | BreadcrumbList 레벨 통일 | 🟡 부분완료 ❓ | [category]/page.tsx 3단계, [slug]/page.tsx 4단계(Sector 경유), compare/keyword 3단계. 혼재. HTML breadcrumb 컴포넌트 미존재 | 1h |
| 13 | 업체 상세 템플릿 + "비교 비교" 버그 | 🟡 부분완료 | 템플릿 순서 이미 양호. **"비교 비교" 버그는 [slug]/page.tsx L373 `{comp.topic.name} 비교`** 확인됨. topic.name이 "비교" 포함 시 중복 | 30m |
| 14 | 태그 표기 간격/중복 | 🟢 거의 해결 | [place-card.tsx](src/components/place-card.tsx) L55-60 배열+span+gap 정상 렌더. 리뷰의 "리프팅보톡스필러..." 는 다른 위치/방식일 가능성 → 런타임 확인만 | 30m |
| 15 | `/admin/register` 보호 | 🟢 해결됨 | [middleware.ts](src/middleware.ts) L49 `matcher: ['/admin/:path((?!login).*)']` 이미 보호 중. 헤더 CTA는 `InquiryButton` 모달 (공개 URL) | 0 |
| 16 | robots.txt — Yeti/Daum/Bing 추가 | 🔴 미해결 | [robots.ts](src/app/robots.ts) 12개 User-Agent. Yeti·NaverBot·Daum·Bingbot 전부 없음 (`*` 폴백만) | 15m |
| 17 | sameAs 외부 링크 | 🟡 인프라완비, 데이터없음 | [types.ts](src/lib/types.ts) L109-111 필드 존재, [jsonld.ts](src/lib/jsonld.ts) L145-151 출력 로직 존재. **데이터 수집/입력만 남음** | 데이터작업 |
| 18 | 업체 슬러그 규칙 통일 | ⚪ 재검증 | seed 슬러그는 모두 수동. 리뷰의 `restaurant-6kty` 류는 DB 자동생성 추정 → Supabase `places.slug` 쿼리 확인 | 1h + DB확인 |
| 19 | compare 페이지 스키마 보강 | 🔴 미해결 | [compare/topic/page.tsx](src/app/compare/%5Bcity%5D/%5Bcategory%5D/%5Btopic%5D/page.tsx) L61-74: Article + FAQPage + Breadcrumb만. ItemList/Service 없음 | 1h |
| 20 | OG/Twitter 메타 보강 | 🟡 부분완료 | [layout.tsx](src/app/layout.tsx) L15-17 `og:locale=ko_KR`, `og:siteName="AI Place"` 이미 있음. **Twitter Card 전체 누락** | 20m |
| 21 | 메타데이터/스키마 빌더 중앙화 | 🔴 미해결 | JSON-LD는 `lib/jsonld.ts`에 어느 정도 집중. `generateMetadata`는 각 page.tsx 산재. `lib/seo/page-meta.ts` 미존재 | 3h (큰 리팩터) |
| 22 | 날짜·연도 자동화 | 🔴 미해결 | [seo.ts](src/lib/seo.ts) L145 `generateCategoryDAB`에 `"2026년 기준"` 하드코딩. 다른 하드코딩 존재 가능 | 30m |
| 23 | Pretendard self-host | 🔴 미해결 | [layout.tsx](src/app/layout.tsx) L43-49 jsdelivr CDN 의존. `next/font/local` 미사용 | 1h |
| 24 | 이미지 sizes 감사 | 🟡 부분완료 | [place-card.tsx](src/components/place-card.tsx) L20 반응형 sizes 양호. [slug]/page.tsx L149 `sizes="800px"` 고정 → 반응형 미활용 | 20m |
| 25 | CWV 측정 도입 | 🔴 미해결 | Lighthouse CI / Vercel Speed Insights 미도입 | 1h |
| 26 | 접근성 (alt, 컨트라스트) | 🟡 부분완료 | `<Image alt={place.name}>` 설정됨. **placeholder SVG(장식)에 alt 없음 — decorative라 OK 가능**. `#6a6a6a` AAA 미달 | 1h |
| 27 | 보안 헤더 점검 | ⚪ 재검증 | 코드에 `next.config` 헤더 설정 확인 필요. 런타임 `curl -I` 로 HSTS/CSP 확인 | 30m |
| 28 | 라우트 컨벤션 통일 | ❓ 정책 결정 | `/compare/`, `/guide/`, `/[city]/[category]/k/` 3종 prefix 혼재. 유지보수 관점 | 0~반나절 |

### 상태 집계 (사이트 본체 28개)
- 🔴 미해결: 12개 (#1, 2, 4, 5, 7, 11, 16, 19, 21, 22, 23, 25)
- 🟡 부분완료: 9개 (#3, 6, 9, 12, 13, 17, 20, 24, 26)
- 🟢 해결됨/거의해결: 4개 (#10, 14, 15 + #17의 인프라)
- ⚪ 재검증 필요: 3개 (#8, 18, 27)
- ❓ 정책 결정: 4개 (#2, 6, 12, 28) — 옵션 중 선택

### Admin/LLM 개선 (16개, 모두 신규 — 상세는 본문 "🛠️ Admin Workflow & LLM Quality 개선" 섹션)

| # | 그룹 | 제목 | 우선순위 |
|---|---|---|---|
| 29 | A. Admin UX | 업체 목록 검색·필터·정렬·페이지네이션 | P1 |
| 30 | A. Admin UX | 일괄 작업 (Bulk Actions) | P1 |
| 31 | A. Admin UX | 등록 폼 실시간 검증 + 미리보기 | P1 |
| 32 | A. Admin UX | 인라인 편집 | P1 |
| 33 | A. Admin UX | 이미지 업로드 (Supabase Storage) | P2 |
| 34 | B. LLM 품질 | 모델 업그레이드 + 2-Pass (Draft → Critique) | **P0** |
| 35 | B. LLM 품질 | Few-Shot 예시 + Exemplar 라이브러리 | **P0** |
| 36 | B. LLM 품질 | 구조화 출력 (Tool Use / JSON Mode) | **P0** |
| 37 | B. LLM 품질 | 다중 후보 + 사람 선택 | P1 |
| 38 | B. LLM 품질 | 리뷰 데이터 활용 강화 | P1 |
| 39 | B. LLM 품질 | 품질 스코어링 + 게이트 | **P0** |
| 40 | C. 확장성 | CSV/엑셀 일괄 등록 | P2 |
| 41 | C. 확장성 | 사장님 셀프 서비스 포털 | P2 |
| 42 | C. 확장성 | 콘텐츠 버전 관리·감사 로그 | P2 |
| 43 | C. 확장성 | AI 인용 추적 대시보드 | P3 |
| 44 | C. 확장성 | 알림 시스템 (Webhook + 이메일) | P3 |
| **46** | 🔥 신규 | **단일 입력 업체 검색 (3-Source + Dedup + Fallback)** | **P0** |
| **47** | 🔥 신규 (CEO 승인) | **블로그 시스템 + 12개 페이지 마이그레이션 (/k/·/compare/·/guide/ → /blog/)** | **P0** |

**전체 항목**: 47개 (사이트 28 + Admin/LLM 16 + 데이터 소스 1 + 검색 리팩터 1 + 블로그 시스템 1)

---

## 🎯 SEO / AEO / GEO 3축 전략 (프로젝트 철학)

**핵심 원칙**: 본 프로젝트는 세 축을 **동시에** 최적화한다. 각 축은 타겟 엔진·신호·전술이 다르므로 섞어 쓰지 않는다.

### 3축 정의

| 축 | 정식 명칭 | 타겟 엔진 | 답변 위치 | 사용자 경험 | 핵심 신호 |
|---|---|---|---|---|---|
| **SEO** | Search Engine Optimization | Google / Naver / Daum / Bing | SERP 링크 목록 | 파란 링크 클릭 → 사이트 방문 | 백링크 · 키워드 · 페이지 권위 · CWV · 크롤러 접근성 |
| **AEO** | **Answer** Engine Optimization | Google 답변박스 · Featured Snippet · Voice (Siri/Alexa) | SERP **상단 박스** · 음성 응답 | 박스의 직답을 보고 필요시 클릭 | **직답 40-60자** · FAQ schema · How-to schema · Position Zero · Speakable |
| **GEO** | **Generative** Engine Optimization | **ChatGPT / Claude / Perplexity / Gemini / Copilot** | AI 응답 **본문 내 인용·언급** | AI가 생성한 문장 속 출처로 등장 | **Princeton 7 levers** · sameAs entity linking · 외부 권위 인용 · Freshness · llms.txt · fact density |

### 축별 전술 매핑

#### SEO 전술 (전통 검색엔진 랭킹)
- 크롤러 접근성: `robots.txt`, `sitemap.xml`, canonical, hreflang
- 페이지 권위: 내부링크 구조, 백링크, thin content 제거
- 성능: Core Web Vitals (LCP/INP/CLS), 이미지 최적화, 폰트
- 기술 기초: OG/Twitter, 메타 태그, Schema.org 기본

#### AEO 전술 (답변 엔진 = Featured Snippet·Voice)
- **Direct Answer Block**: 40-60자 한국어 직답 (H1/H2 직후)
- **FAQ schema**: 현재 잘 구현됨
- **How-to schema**: 가이드 페이지에 미적용 → 추가 권장
- **Speakable schema**: 음성 검색 최적화, 미적용
- **Opening Hours / Review / Price** 정확한 구조화 데이터
- 한 번에 한 질문·한 답변 원칙

#### GEO 전술 (LLM 인용 최적화)
**Princeton GEO 7 levers** (연구 기반 인용률 상승 순):
1. **Statistics Addition** — 수치·통계 삽입 (+32% 인용률)
2. **Cite Sources** — 외부 권위 출처 인용 (+27%)
3. **Quotation Addition** — 직접 인용문 추가 (+24%)
4. **Authoritative** — 전문가·기관명 명시
5. **Keyword Simple** — 간결한 키워드 사용
6. **Unique Words** — 일반론 회피, 고유 표현
7. **Fluency** — 자연스러운 문장

**추가 GEO 신호**:
- `sameAs` entity linking (네이버 플레이스·카카오·인스타 연결)
- Freshness: `dateModified`, `datePublished`, `lastUpdated` 시각화
- `llms.txt` 동적 생성
- AI 크롤러 명시 허용 (OAI-SearchBot, ClaudeBot, PerplexityBot 등)
- 네이버 블로그·뉴스·지식iN 한국어 권위 인용 (#45 B-1)
- 업종·지역 fact 데이터 (도메인 통계, 가격대 등)

### 45개 항목 × 3축 매핑

| # | 제목 | SEO | AEO | GEO | 주축 |
|---|---|:---:|:---:|:---:|---|
| 1 | 수피부과 단일화 + 숫자 단일소스 | ✅ | ✅ | ✅ | **GEO** (일관성 = 인용 신뢰) |
| 2 | `/k/recommend` 카니발라이제이션 | ✅ | ✅ | | **SEO** |
| 3 | 홈 "83개 업종" | ✅ | ✅ | ✅ | **SEO** |
| 4 | 업종별 면책 분기 | | ✅ | ✅ | **AEO** |
| 5 | 푸터 동적화 | ✅ | | | **SEO** (내부링크) |
| 6 | Thin 카테고리 처리 | ✅ | ✅ | | **SEO** |
| 7 | 업체 상세 H1 포맷 | ✅ | ✅ | ✅ | **GEO** (entity 식별) |
| 8 | 주소 포맷 정규화 | ✅ | | ✅ | **GEO** (entity linking) |
| 9 | 영업시간 포맷 통일 | | ✅ | ✅ | **AEO** (답변박스) |
| 10 | 가격 표기 포맷 | | ✅ | ✅ | **AEO** |
| 11 | 리뷰·평점 + Review 스키마 | ✅ | ✅ | ✅ | **AEO + GEO** |
| 12 | BreadcrumbList 레벨 통일 | ✅ | ✅ | | **SEO** |
| 13 | 업체 상세 템플릿 + "비교 비교" 버그 | ✅ | ✅ | | **SEO** |
| 14 | 태그 표기 간격/중복 | ✅ | | | **SEO** |
| 15 | `/admin` 보호 | ✅ | | | **SEO** (crawl budget) |
| 16 | robots.txt Yeti/Daum/Bing | ✅ | | ✅ | **SEO + GEO** |
| 17 | sameAs 외부 권위 링크 | ✅ | | ✅ | **GEO** (핵심 신호) |
| 18 | 업체 슬러그 규칙 통일 | ✅ | | | **SEO** |
| 19 | compare 페이지 ItemList 스키마 | | ✅ | ✅ | **AEO** |
| 20 | OG/Twitter 메타 보강 | ✅ | | | **SEO** |
| 21 | 메타데이터·스키마 빌더 중앙화 | ✅ | ✅ | ✅ | **유지보수** |
| 22 | 날짜·연도 자동화 | | | ✅ | **GEO** (freshness) |
| 23 | Pretendard self-host | ✅ | | | **SEO** (CWV) |
| 24 | 이미지 sizes 감사 | ✅ | | | **SEO** (CWV) |
| 25 | CWV 측정 도입 | ✅ | | | **SEO** |
| 26 | 접근성 | ✅ | | | **SEO** |
| 27 | 보안 헤더 | ✅ | | | **SEO** |
| 28 | 라우트 컨벤션 | ✅ | | | **유지보수** |
| 29 | 업체 목록 검색·필터·정렬 | | | | **Admin UX** |
| 30 | 일괄 작업 | | | | **Admin UX** |
| 31 | 실시간 검증 + 미리보기 | | | ✅ | **Admin + GEO 품질** |
| 32 | 인라인 편집 | | | | **Admin UX** |
| 33 | 이미지 업로드 | ✅ | | ✅ | **SEO + GEO (image context)** |
| 34 | LLM 3-Tier + 2-Pass | | ✅ | ✅ | **GEO** (핵심) |
| 35 | Few-Shot Exemplar | | | ✅ | **GEO** |
| 36 | Tool Use 구조화 출력 | | ✅ | ✅ | **GEO** (신뢰성) |
| 37 | 다중 후보 + 사람 선택 | | | ✅ | **GEO** |
| 38 | 리뷰 데이터 활용 강화 | | | ✅ | **GEO** |
| 39 | 품질 스코어링 | | ✅ | ✅ | **GEO** |
| 40 | CSV 일괄 등록 | | | | **Scale** |
| 41 | 사장님 셀프 포털 | | | ✅ | **GEO** (unique data) |
| 42 | 버전 관리·감사 로그 | | | | **Governance** |
| 43 | AI 인용 추적 대시보드 | | | ✅ | **GEO** (측정) |
| 44 | 알림 시스템 | | | | **Ops** |
| 45 | Multi-Source Enrichment | ✅ | | ✅ | **GEO** (데이터 소스) |
| 46 | 단일 입력 업체 검색 (Unified Search + Dedup) | ✅ | | ✅ | **Admin + GEO** (P0) |
| 47 | 블로그 시스템 + 12개 페이지 마이그레이션 | ✅ | ✅ | ✅ | **SEO + GEO** (P0, CEO 승인) |

### 축별 항목 집계

| 축 | 항목 수 | 주축으로 배정된 항목 |
|---|---|---|
| **SEO 주축** | 14 | #2, 3, 5, 6, 12, 13, 14, 15, 16, 18, 20, 23~28 |
| **AEO 주축** | 5 | #4, 9, 10, 11, 19 |
| **GEO 주축** | 14 | #1, 7, 8, 11(AEO+), 17, 22, 31, 33, 34, 35, 36, 37, 38, 39, 41, 43, 45 |
| **Admin/Scale/Ops** | 8 | #29, 30, 32, 40, 42, 44 + UX 전반 |
| **유지보수** | 2 | #21, 28 |

> 중복: #7·#11은 세 축 모두 영향. #16·#33은 두 축 공동.

### 🔥 전략 항목 (별도 섹션)

| # | 제목 | 우선순위 | 본문 위치 |
|---|---|---|---|
| **45** | **Multi-Source Data Enrichment** (Google + 네이버 블로그·뉴스 API + 사장님 포털 + 도메인 데이터 + Exa) | **P0** | "💎 LLM 전략 & 데이터 소스" 섹션 |
| — | **LLM 2-Tier 라우팅** (Sonnet 4.6 메인 + Haiku 4.5 블로그 전처리. Opus 제외) | **P0** | 동 섹션. #34에서 구현 |

---

## 전제 규칙

- 모든 수정은 **단일 소스 원칙 (Single Source of Truth)** 준수
- 데이터는 `content/businesses/*.ts` 또는 Supabase 단일 테이블에서 읽고, 페이지는 해당 소스만 참조한다. 페이지별 하드코딩 금지
- 포맷 통일은 **유틸 함수로 추출** (`/lib/format/*.ts`) 후 모든 페이지에서 동일 함수 호출
- 작업 완료 시 각 체크박스 체크 + 커밋 메시지에 `[WO-aiplace-001-#N]` 형식 포함
- 완료 후 `.claude/checkpoints.log`에 기록

---

## 사이트 구조 참고

### 사이트맵 (총 27개 URL)

```
/                                              # 메인
/about                                         # 소개/큐레이터
/cheonan/{auto-repair|dermatology|interior|restaurant|webagency}     # 카테고리(5)
/cheonan/{category}/{business-slug}            # 업체 상세(8)
/cheonan/dermatology/k/{keyword}               # 키워드 랜딩(8)
/compare/cheonan/dermatology/{topic}           # 비교(3)
/guide/cheonan/dermatology                     # 가이드(1)
```

피부과만 `k/`, `compare/`, `guide/` 3종 보유 → **사실상 피부과가 pilot 카테고리**.

업체 슬러그가 `restaurant-6kty` 같은 프리픽스+해시 자동생성과 `dr-evers`, `didu` 수동 슬러그가 **혼재** → 규칙 통일 필요 (P2 #18).

---

## P0 — Critical (AI 인용 시 신뢰도 치명적, 오늘 중 처리)

### [🔴 미해결] #1. 피부과 업체 수 단일화 (4곳 vs 5곳 불일치) + 카니발라이제이션 해소

**📌 코드 검증 (2026-04-17)**: [src/lib/data.ts](src/lib/data.ts) 에 수피부과 언급 **8곳 잔존**:
- L126 주석 "폐업으로 시드에서 제거"라고 적혀 있지만
- L283, L285, L358 — FAQ 답변
- L490, L491 — 가이드 섹션 content
- L507 — 영업시간 items
- L526, L553 — 다른 FAQ
- [data.supabase.ts](src/lib/data.supabase.ts) 는 깨끗 (DB에는 없음 → fallback seed만 문제)

**현상**
- `/cheonan/dermatology` 목록: **4곳**
- `/guide/cheonan/dermatology` 가이드: **5곳** (수피부과의원 포함)
- `/cheonan/dermatology/k/acne`: 메타·본문 "3곳" → 카드 2곳
- `/compare/cheonan/dermatology/acne-treatment`: "3곳 비교" → 실제 카드 2곳, 1곳(수피부과의원)은 FAQ에만 등장
- 가이드 본문 / 증상별 추천 / FAQ / 통계에서 "수피부과의원" 6군데 이상 언급

**판정 필요**
- [ ] 수피부과의원을 **신규 등록**할 것인가, **가이드/비교에서 완전 제거**할 것인가 결정
- 지수님 의사 결정 후 작업 시작

**작업 (제거 케이스)**
- [ ] `content/guides/cheonan-dermatology.ts` 에서 수피부과의원 언급 전부 제거
- [ ] 가이드 통계 블록 `"5곳"` → 실제 업체 수로 교체
- [ ] 증상별 추천 매핑에서 수피부과 라인 제거 및 대체 업체 지정
- [ ] FAQ 답변 중 수피부과 언급 리라이팅
- [ ] `compare/cheonan/dermatology/acne-treatment` "3곳" → "2곳" 정정

**작업 (등록 케이스)**
- [ ] `content/businesses/su-dermatology.ts` 신규 생성 (스키마는 기존 업체 파일 참조)
- [ ] 목록/홈 최근 등록 섹션에 반영
- [ ] 상세 페이지 라우트 검증

**근본 해결: 숫자 단일 소스화**
- [ ] 페이지에 등장하는 모든 업체 수치(`N곳`, `N개 업종`)는 **서버에서 계산한 결과를 그대로 카피에 바인딩**
- [ ] `lib/site-stats.ts` 또는 동적 집계 함수 도입 — 수동 카피 작성 금지

**검증**
- [ ] 홈, `/cheonan/dermatology`, `/guide/cheonan/dermatology`, `k/acne`, `compare/.../acne-treatment` 5곳의 업체 수 숫자가 모두 일치
- [ ] 가이드 내 모든 업체명 언급이 실제 등록 업체와 일치하는지 grep 검증
- [ ] 유령 업체("수피부과" 등) 코드베이스 grep 결과 0건 (제거 케이스)

---

### [🔴 미해결 ✅ 결정완료] #2. 카니발라이제이션 해결: `/cheonan/dermatology` vs `/k/recommend`

**📌 코드 검증 (2026-04-17)**: [k/[keyword]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/k/%5Bkeyword%5D/page.tsx) L29-33 는 KeywordPage 데이터의 `page.title`, `page.summary` 를 그대로 사용. → **`getKeywordPage(city, category, 'recommend')` 가 반환하는 KeywordPage 데이터의 title 필드가 카테고리 페이지 title과 동일**한 것이 원인.

**✅ 결정 (2026-04-17)**: 키워드 페이지 자체를 **블로그 시스템(#47)으로 이전**. `/k/recommend` 단독 처리가 아니라 12개 페이지(키워드 8 + 비교 3 + 가이드 1) 일괄 마이그레이션의 일환으로 처리. → #47 참조.

**현상**
- 두 URL의 H1과 `<title>` 이 완전히 동일: `"천안 피부과 추천 — 2026년 업데이트"`
- Google / AI 엔진 관점에서 두 URL이 같은 쿼리에 경쟁 → 어느 쪽도 안정적 랭크 어려움

**판정 필요 → 옵션 선택**
- [ ] **옵션 A**: `k/recommend` 제거하고 카테고리 페이지(`/cheonan/dermatology`)로 canonical 통합
- [ ] **옵션 B**: `k/recommend` 를 "추천 TOP / 랭킹" 성격으로 H1·본문 재작성 (예: `"천안 피부과 Top 5 — 전문 분야별 추천"`)

**검증**
- [ ] 두 URL의 `<title>`, H1, meta description 모두 차별화됨
- [ ] 옵션 A 선택 시: `/k/recommend` 가 sitemap에서 제외되고 카테고리 페이지로 301 리다이렉트

---

### [부분완료] #3. 홈 "83개 업종" 표기 제거 또는 수정

**📌 코드 검증 결과 (2026-04-17)**: 홈페이지 ([src/app/page.tsx](src/app/page.tsx))는 **이미 동적 집계** 사용 중.
- L87: `현재 천안 지역 {categories.length}개 업종이 등록되어 있습니다`
- L122: `{activeCategories.length}개 업종의 업체를 AI 검색에 최적화합니다`
- 리뷰는 캐시된 구버전 또는 시드 데이터 기준 `categories.length === 83` 상황을 본 것으로 추정

**잔여 작업 (검증만 필요)**
- [ ] 프로덕션 빌드에서 `categories.length` 값이 실제로 활성 카테고리만 세는지 확인
  - 현재 `getCategories()` 는 83개 전체 반환 → **"등록된 업종 수"** 의미로는 부정확
  - 홈에서 "83개 업종이 등록되어 있습니다" 문구는 업체 수 0인 카테고리까지 포함
- [ ] `getCategories()` 를 `getActiveCategoryCount()` 로 교체하거나, 문구를 `"83개 업종 커버리지, 현재 {activeCategories.length}개 운영 중"` 식으로 해석 분리
- [ ] 시드(`data.ts`)와 Supabase의 카테고리 수 일치 확인

---

### [🔴 미해결] #4. 업종별 면책 문구 분기 처리 (템플릿 누수)

**📌 코드 검증 (2026-04-17)**: `"의료 결정은 전문의와 상담하세요"` 하드코딩 **3곳 확인**:
- [src/app/[city]/[category]/[slug]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/%5Bslug%5D/page.tsx) L382
- [src/app/[city]/[category]/k/[keyword]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/k/%5Bkeyword%5D/page.tsx) L155
- [src/app/compare/[city]/[category]/[topic]/page.tsx](src/app/compare/%5Bcity%5D/%5Bcategory%5D/%5Btopic%5D/page.tsx) L163

모든 업체 상세 + 키워드 랜딩 + 비교 페이지에서 카테고리 무관하게 동일 문구 출력 중.

**현상**
- 디두(웹에이전시), 브이아이피모터스(자동차정비) 등 **비의료 업체 상세 페이지**에도
  `"※ 의료 결정은 전문의와 상담하세요"` 문구가 하드코딩되어 출력됨
- 피부과 템플릿의 공통 컴포넌트를 전 업종 재사용한 결과
- `didu` 페이지 하단에 피부과 관련 내부 링크도 노출

**작업**
- [ ] `components/business/Disclaimer.tsx` 로 면책 문구 컴포넌트 분리
- [ ] Props로 `industry: 'medical' | 'auto' | 'web' | 'interior' | 'restaurant'` 받도록 설계
- [ ] `/lib/constants/disclaimers.ts` 업종별 사전 정의
  ```ts
  const categoryMeta = {
    dermatology: { disclaimer: "의료 결정은 전문의와 상담하세요", ... },
    'auto-repair': { disclaimer: "실제 수리 비용은 차량 상태에 따라 달라질 수 있습니다", ... },
    webagency: { disclaimer: "프로젝트 비용은 요구사항에 따라 협의됩니다", ... },
    interior: { disclaimer: "시공 비용은 현장 실측 후 확정됩니다", ... },
    restaurant: { disclaimer: null, ... }, // 미렌더
  } as const
  ```
- [ ] 업체 데이터 스키마에 `industry` 필드 추가 (이미 있으면 재사용)
- [ ] 모든 상세 페이지에서 기존 하드코딩 제거 후 컴포넌트 교체
- [ ] 비의료 페이지의 피부과 내부 링크 차단

**검증**
- [ ] 디두 페이지에서 "의료 결정" 문구 사라졌는지
- [ ] 피부과 4곳은 여전히 의료 면책 문구 출력되는지

---

### [🔴 미해결] #5. 푸터 네비게이션 동적화

**📌 코드 검증 (2026-04-17)**: [src/components/footer.tsx](src/components/footer.tsx) L12-30 **전체 피부과 하드코딩**. 모든 섹션(도시/업종/서비스)의 링크가 `/cheonan/dermatology` 와 피부과 가이드/비교로 고정. 자동차/웹에이전시 페이지에서도 동일 푸터 렌더.

**현상**
- **전 페이지 푸터**의 도시/업종/서비스 섹션이 **피부과 링크만** 포함
- 자동차정비 페이지 푸터의 "천안" 링크가 `/cheonan/dermatology` 로 이동
- 푸터 컴포넌트가 하드코딩된 피부과 전용

**작업**
- [ ] `components/layout/Footer.tsx` 리팩토링
- [ ] Props로 현재 페이지 context 받거나, 전체 도시/업종 목록을 서버 컴포넌트에서 조회
- [ ] "도시" 섹션: 등록된 전체 도시 리스트 (현재는 천안만, 추후 확장 대비)
- [ ] "업종" 섹션: 현재 도시에 등록된 전체 업종 리스트 (자동차정비, 피부과, 인테리어, 맛집, 웹에이전시)
- [ ] "서비스" 섹션: 현재 도시 × 현재 업종에 해당하는 가이드/비교 콘텐츠만 표시
- [ ] 현재 업종이 없는 페이지(홈/about)에서는 대표 콘텐츠 표시

**검증**
- [ ] 자동차정비 페이지 푸터에서 "천안" 클릭 → 자동차정비 목록 또는 천안 hub 으로 이동
- [ ] 웹에이전시 페이지 푸터의 "서비스" 섹션에 피부과 가이드 링크 없는지

---

## P1 — 콘텐츠 품질 & 일관성 (이번 주 내)

### [부분완료 ✅ 결정완료] #6. Thin 카테고리 처리 (업체 1곳 카테고리)

**📌 코드 검증 결과 (2026-04-17)**: [src/app/[city]/[category]/page.tsx](src/app/%5Bcity%5D/%5Bcategory%5D/page.tsx) L49에
```ts
...(hasPlaces ? {} : { robots: { index: false, follow: true } }),
```
이 이미 구현됨. **업체 0곳 카테고리는 이미 noindex 처리됨**.

**✅ 결정 (2026-04-17)**: **옵션 B (가이드 본문 채우기)**. 업체는 곧 채워질 예정이므로 콘텐츠 보강 방향이 더 나음. noindex 상향은 안 함.

**작업**
- [ ] 가이드 본문 신규 작성 (1,000-1,500자 각): `auto-repair`, `interior`, `webagency`, `restaurant`
  - 지역 시장 개요 + 평균 가격대 + 선택 체크리스트
  - **#47 블로그 시스템 이전 후에는 블로그 포스트로 작성** (즉시 이전 권장)
  - 과도기에는 `src/lib/data.ts` 의 `guidePages` 배열에 추가
- [ ] 가이드 페이지 → 카테고리 페이지에 임베드 또는 강력 링크 노출
- [ ] `src/app/sitemap.ts` 의 noindex 처리 로직은 현행(0곳만) 유지

---

### [🔴 미해결] #7. 업체 상세 H1 포맷 통일 + 이미지 alt 자동화

**📌 코드 검증 (2026-04-17)**:
- [slug]/page.tsx L161: `<h1>{place.name}</h1>` — **단어 1개로 렌더** (`"디두"`, `"단비"` 등)
- title metadata L45는 이미 `"{name} - {city} {category}"` 포맷 — **HTML H1만 부족**
- [place-card.tsx](src/components/place-card.tsx) L17 `alt={place.name}` 설정됨
- [slug]/page.tsx L149 `<Image alt={place.name}>` 설정됨
- **placeholder SVG (L152-155, place-card L23-28) 에는 alt 없음** — 다만 decorative SVG라 aria-hidden 처리 가능

**현상**
- 업체 상세(예: `단비`, `디두`) H1이 단어 1개 → SERP/AI 답변에서 컨텍스트 부족
- 이미지가 대부분 placeholder SVG 추정, `alt` 미설정

**작업**
- [ ] H1 포맷 통일: `"{업체명} — 천안 {카테고리}"` (예: `단비 — 천안 맛집(돼지갈비/한우)`, `디두 — 천안 웹에이전시`)
- [ ] `app/[city]/[industry]/[slug]/page.tsx` 단일 지점에서 H1 생성 로직 통일
- [ ] 카드 placeholder에 최소 `alt="{업체명} 썸네일"` 자동 주입
- [ ] 업체 상세 본문에 H3 추가 (제공 서비스 → 시술/메뉴별 H3, 이용 후기 → 출처별 H3)

**검증**
- [ ] 모든 업체 상세 H1이 "이름 — 지역 카테고리" 패턴
- [ ] 모든 `<img>` 에 `alt` 속성 존재

---

### [⚪ 재검증 필요] #8. 주소 포맷 정규화

**📌 코드 검증 (2026-04-17)**: [data.ts](src/lib/data.ts) 시드의 주소는 모두 `"충남 천안시..."` 로 **이미 통일**됨 (L135, 171, 207, 242 등 동일 패턴). `"충청남도"` vs `"충남"` 혼재는 **Supabase `places` 테이블의 DB 데이터**에서 발생할 가능성 — Google Places API / 네이버 API 유입 시 다양한 포맷. 결론: **DB 쿼리 확인이 선행**, 실제로 혼재된다면 정규화 유틸 구현.

**현상**
- `충청남도 천안시 동남구 유량동 281`
- `충남 천안시 서북구 불당21로 67-18`
- `충청남도 천안시 동남구 신방동 464-1번지`

`충청남도` vs `충남`, 지번/도로명 혼재, `번지` 접미사 유무 제각각.

**작업**
- [ ] `lib/format/address.ts` 생성
  ```ts
  export function normalizeAddress(raw: string): NormalizedAddress {
    // { full, short, sido, sigungu, dong, detail }
    // 규칙:
    // - sido 는 "충청남도" 로 통일 (약어 금지)
    // - "번지" 접미사 제거
    // - 도로명 우선, 지번은 fallback
  }
  ```
- [ ] 모든 업체 데이터의 주소를 정규화 함수 통과하도록 수정
- [ ] 원본 주소는 `rawAddress` 로 보존, UI 표시는 `normalizeAddress(raw).full` 사용
- [ ] JSON-LD `PostalAddress` 출력 시에도 동일 함수 사용

---

### [🟡 부분완료] #9. 영업시간 포맷 통일

**📌 코드 검증 (2026-04-17)**:
- seed 데이터는 **`"Mo-Fr 09:00-21:00"` OSM 스타일로 통일**됨 ([data.ts](src/lib/data.ts) L137, 173, 209, 244)
- [jsonld.ts](src/lib/jsonld.ts) L26-52 `parseOpeningHours()` 가 Schema.org `OpeningHoursSpecification` 변환 구현됨
- 화면 렌더는 [slug]/page.tsx L255-260 **regex replace로 한글 변환** (`Mo→월`, `-→~`) — 전용 유틸 없이 인라인
- 리뷰에서 지적한 "샤인빔 `월~화 10:30-20:30`" 류 한글 입력은 **DB 데이터**일 가능성 → DB 확인 필요
- `lib/format/hours.ts` 유틸은 미구현 (타입화된 BusinessHours 구조 없음)

**현상**
| 업체 | 포맷 |
|---|---|
| 닥터에버스 | `Mo-Fr 09:00-21:00, Sa 09:00-17:00` (OSM 스타일) |
| 샤인빔 | `월~화 10:30-20:30, 수 10:00-18:00, 목~금 10:30-20:30` (한글) |
| 디두 | `월 09:00-18:00, 화 09:00-18:00, ...` (요일 풀어쓰기) |

**작업**
- [ ] `lib/format/hours.ts` 생성
  ```ts
  // 내부 데이터 구조: Array<{ day: 'mon'|..., open: 'HH:mm', close: 'HH:mm', closed?: boolean }>
  export function formatHoursKo(hours: BusinessHours): string;
  export function toSchemaOrgHours(hours: BusinessHours): OpeningHoursSpecification[];
  ```
- [ ] UI 표시는 `formatHoursKo` 통해 **한글 형식 1종**으로 통일
  - 제안 포맷: `"월-금 09:00-21:00, 토 09:00-17:00, 일 휴무"`
  - 같은 시간대 요일은 자동 병합
- [ ] JSON-LD 출력은 `toSchemaOrgHours` 로 Schema.org 표준 형식 생성
- [ ] 기존 업체 데이터를 신규 구조로 마이그레이션

---

### [🟢 거의 해결] #10. 가격 표기 포맷 통일

**📌 코드 검증 (2026-04-17)**: seed 데이터의 `priceRange` 는 모두 `"20-80만원"` **하이픈 통일** ([data.ts](src/lib/data.ts) L140-143, 176-179, 212-213 등). `~` 물결표 혼재는 DB 유입 데이터 또는 일부 leftover일 가능성.

**잔여 작업**
- [ ] DB에서 `priceRange` 값 전수 확인 (`~`, `/회`, `/월` 혼재 여부)
- [ ] 유틸 `lib/format/price.ts` 는 혼재가 실제로 확인될 때만 구현. 현재는 **seed 기준 양호**
- [ ] 단위 표기 정책 결정 (`/회`, `/월`, `/프로젝트` 추가할지)

**현상**
- `20-80만원` (하이픈)
- `5~15만원/회` (물결표)
- `20-50만원/월`
- `150-300만원`

**작업**
- [ ] `lib/format/price.ts` 생성
  ```ts
  export function formatPriceRange(
    min: number,
    max: number,
    unit?: 'per-session' | 'per-month' | 'per-project'
  ): string;
  ```
- [ ] 통일 규칙: **하이픈만 사용** (`20-80만원`), 단위는 한글 (`/회`, `/월`, `/프로젝트`)
- [ ] 숫자는 내부적으로 원 단위로 저장하고 표시할 때 변환 (`15_000_000` → `1,500만원`)

---

### [🔴 미해결] #11. 리뷰/평점 표기 포맷 통일 + Review 스키마

**📌 코드 검증 (2026-04-17)**:
- [jsonld.ts](src/lib/jsonld.ts) L104-111 에 `aggregateRating` 만 출력. **개별 `Review` 엔트리 빌더 없음**
- [place-card.tsx](src/components/place-card.tsx) L42: `"Google 리뷰 {N}건"` 하드코딩
- [slug]/page.tsx L166: `"후기 {N}건"` + L168 `(Google)` 조건부
- **⚠ 버그 발견**: [slug]/page.tsx L394-402 `AggregateRating` 이 **별도 `<script @type=AggregateRating>`** 로 출력됨 — 이는 **비표준 사용**. AggregateRating은 LocalBusiness 내부 속성이어야 함 (이미 L110 `generateLocalBusiness` 에서 내부 출력 중). **중복 + 비표준**

**현상**
- `Google 리뷰 7건`
- `후기 2건(Google)`
- `후기 178건` (출처 표기 누락)
- `평점 4.6점 (Google/네이버 기준)` vs `(네이버 플레이스 기준)` 혼재
- 현재 `aggregateRating` 만 있고 개별 `Review` 엔트리 없음

**작업**
- [ ] `lib/format/rating.ts` 생성
  ```ts
  export function formatRatingLine(
    rating: number,
    count: number,
    source: 'google' | 'naver' | 'mixed'
  ): string;
  // 출력 예: "★ 4.5 · 리뷰 178건 (Google)"
  ```
- [ ] 소스 필드는 필수, 누락 시 빌드 에러 처리
- [ ] 목록 카드 / 상세 Hero / `aggregateRating` schema 모두 동일 함수 사용
- [ ] 업체별 1~2개 실제 후기를 `Review` 개별 엔트리로 추가 (SERP 별점 노출 확률↑)

---

### [부분완료 ✅ 결정완료] #12. 브레드크럼 — 페이지 타입별 2종 분리

**📌 코드 검증 결과 (2026-04-17)**:
- `BreadcrumbList` **JSON-LD는 이미 구현됨** — [src/lib/seo.ts#generateBreadcrumbList](src/lib/seo.ts) 유틸 존재, 카테고리 페이지 L77-84에서 **3단계**로 적용 중
- 현재 혼재: 카테고리 3단계, 업체 상세 4단계, 키워드/비교 3단계 — 일관성 없음

**✅ 결정 (2026-04-17)**: 페이지 타입별로 **2종 분리**.

#### 타입 1: 업체 관련 페이지 (4단계)

```
홈 › [도시] › [업종] › [업체 or 카테고리]
```

예시:
- 카테고리: `홈 › 천안 › 피부과`
- 업체 상세: `홈 › 천안 › 피부과 › 닥터에버스의원`

적용 라우트:
- `/[city]/[category]` — 카테고리 목록
- `/[city]/[category]/[slug]` — 업체 상세

#### 타입 2: 블로그 콘텐츠 페이지 (5단계)

```
홈 › 블로그 › [도시] › [대분류] › [글 제목]
```

예시:
- `홈 › 블로그 › 천안 › 의료 › 천안 피부과 여드름 치료 비교`
- `홈 › 블로그 › 천안 › 의료 › 천안 피부과 선택 가이드`

적용 라우트 (#47 블로그 이전 후):
- `/blog/[city]/[sector]/[slug]` — 모든 블로그 콘텐츠 (키워드·비교·가이드 통합)

#### 작업

- [ ] [src/lib/seo.ts](src/lib/seo.ts) `generateBreadcrumbList` 에 2종 빌더 추가
  - `buildBusinessBreadcrumb(city, category, placeName?)` — 4단계
  - `buildBlogBreadcrumb(city, sector, title)` — 5단계
- [ ] Sector 경유(`천안 의료`) 중간 hub 제거 → 도시 바로 아래 업종 배치
- [ ] HTML breadcrumb 컴포넌트 신규 (`src/components/breadcrumb.tsx`) — route params 기반 자동 생성
- [ ] 모든 페이지에 HTML breadcrumb + JSON-LD 동기화
- [ ] "천안" 클릭 시 갈 페이지는 지금 미존재 → 추후 `/[city]` hub 신설 예정 (본 TASK와 별개)

---

### [🟡 부분완료] #13. 업체 상세 페이지 템플릿 통일

**📌 코드 검증 (2026-04-17)**:
- [slug]/page.tsx 단일 템플릿. 블록 순서 이미 양호: Hero → 추천대상/강점 → 기본정보 → 서비스 → 태그 → Google 리뷰 → FAQ → 관련 콘텐츠 → 면책
- **"비교 비교" 버그 확인**: [slug]/page.tsx L373 `{comp.topic.name} 비교` — `comp.topic.name` 이 이미 "비교" 포함 시 (예: `"레이저 시술 비교"`) → `"레이저 시술 비교 비교"` 출력
- 닥터에버스/디두 상세에 "관련 콘텐츠" 미노출 보고 → `relatedGuides`/`relatedComparisons` 가 빈 배열일 때 섹션 숨김 (L354 조건). 실제로 데이터 누락 문제일 수 있음

**현상**
- 닥터에버스 상세: "관련 콘텐츠" 섹션 **없음**
- 샤인빔 상세: 있음 (단, `"레이저 시술 비교 비교"` 로 "비교" 단어 중복 버그)
- 디두 상세: 없음

**작업**
- [ ] `app/[city]/[industry]/[slug]/page.tsx` 단일 템플릿 확인
- [ ] 모든 업체 상세 페이지가 다음 블록을 동일 순서로 출력하도록 컴포넌트화
  1. Hero (이름, 평점, 한줄 설명, CTA)
  2. 기본 정보 (주소/전화/영업시간)
  3. 제공 서비스
  4. 이용 후기 (있을 때만)
  5. 자주 묻는 질문
  6. 관련 콘텐츠 (가이드/비교 링크)
  7. 면책 문구
- [ ] "비교 비교" 중복 버그 확인: `content/compare/*.ts` 의 title 필드가 이미 "비교" 포함하는데 링크 텍스트에서 "비교" 접미사 추가 로직 수정
- [ ] 관련 콘텐츠 블록은 업종별 자동 매칭 (피부과 → 피부과 가이드/비교, 웹에이전시 → 웹에이전시 관련 콘텐츠)

---

### [🟢 거의 해결] #14. 태그 표기 간격/중복 수정

**📌 코드 검증 (2026-04-17)**:
- [place-card.tsx](src/components/place-card.tsx) L53-63: `place.tags.slice(0, 4).map(tag => <span class="px-2 ... gap-1.5">{tag}</span>)` — **배열 정상 렌더, 공백 있음**
- [slug]/page.tsx L292-300: 동일 패턴, `gap-2` — 정상
- 리뷰의 "리프타링보톡스필러야간진료여드름색소" 는 **DB의 `tags` 필드가 배열이 아닌 단일 문자열**로 저장되었거나, 다른 페이지의 다른 렌더 위치 문제일 가능성 → DB 확인 필요
- 상세/목록/홈 태그 차이는 `slice(0, 4)` 와 전체 표시 차이 — 의도된 동작

**현상**
- 닥터에버스 태그: `리프팅보톡스필러야간진료여드름색소` (공백/구분자 없이 붙음)
- 상세/목록/홈의 태그 목록이 서로 다름 (샤인빔은 상세에만 "야간진료" 있음)

**작업**
- [ ] 태그는 `string[]` 으로 저장하고, 표시할 때 `<Tag>` 컴포넌트로 렌더 (공백 자동)
- [ ] 태그 표시는 모든 페이지에서 동일한 `<TagList>` 컴포넌트 사용
- [ ] 중복 태그 제거 로직
- [ ] 상세/목록/홈의 태그가 단일 소스(업체 데이터의 `tags` 필드)에서만 오는지 확인

---

## P2 — SEO/AEO/GEO 보강 & 인프라 (이번 달)

### [🟢 해결됨] #15. `/admin/register` 경로 노출 차단

**📌 코드 검증 (2026-04-17)**:
- [middleware.ts](src/middleware.ts) L48-50: `matcher: ['/admin/:path((?!login).*)']` — **`/admin/register` 포함 모든 admin 경로 보호**, 로그인 페이지만 공개
- [header.tsx](src/components/header.tsx) L14: `<InquiryButton>` 모달 사용 (직접 `/admin/register` 링크 아님)
- [robots.ts](src/app/robots.ts) 모든 User-Agent에 `disallow: ['/admin', '/api']` 적용됨

**잔여 작업 (선택)**
- [ ] sitemap에서 `/admin` 경로 제외 확인 — sitemap 생성 로직 ([seo.ts](src/lib/seo.ts) `generateSitemapEntries`)에서 admin 경로 미포함 (확인됨)
- [ ] 헤더 외 다른 페이지에 직접 `/admin/register` 링크 잔존 여부 grep — 별도 작업 필요 시 추가

**현상**
- 피부과 상세 페이지 헤더 CTA: `[업체 등록](https://aiplace.kr/admin/register)`
- 홈/다른 페이지에서는 "업체 등록 문의" 텍스트 (경로 모호)

**작업**
- [ ] 공개 랜딩 경로 신설: `/register` 또는 `/contact` (문의 폼)
- [ ] 헤더 CTA 전부 공개 경로로 교체
- [ ] `/admin/*` 에 인증 미들웨어 추가 (Supabase Auth)
- [ ] `robots.txt` 에 `/admin` disallow 추가 (이미 있으면 확인)
- [ ] `sitemap.xml` 에 `/admin` 제외 확인

---

### [🔴 미해결] #16. robots.txt / llms.txt / sitemap.xml 재검증

**📌 코드 검증 (2026-04-17)**:
- [robots.ts](src/app/robots.ts): 12개 User-Agent (OAI/ChatGPT/Perplexity/Claude×2/Googlebot/GPTBot/ClaudeBot/Google-Extended/Applebot-Extended/CCBot/`*`)
- **누락**: `Yeti` (네이버), `NaverBot`, `Daum` (다음), `Bingbot` — `*` 폴백으로 커버되지만 명시적 화이트리스트 권장
- [sitemap.ts](src/app/sitemap.ts) + [seo.ts#generateSitemapEntries](src/lib/seo.ts) L46-58: **이미 `activeCategoryKeys` 필터로 빈 카테고리 제외** + URL 중복 제거 (L104-110)
- llms.txt 동적 생성 여부는 `src/app/llms.txt/` 라우트 확인 필요

**현상**
- robots.txt 12개 User-Agent 화이트리스트는 우수, 다만 **Bingbot / NaverBot(Yeti) / DaumBot** 명시 누락
- 한국 트래픽 관점에서 `User-Agent: Yeti` 명시 권장

**작업**
- [ ] `/public/robots.txt` AI 크롤러(GPTBot, ClaudeBot, PerplexityBot, Google-Extended) 허용 유지 확인
- [ ] **Yeti (네이버), Daum, Bingbot 명시적 Allow 추가**
- [ ] `/public/llms.txt` 에 P0~P1 작업 완료 후 업데이트된 업체 수/URL 반영
- [ ] `app/sitemap.ts` 가 동적으로 전체 URL 생성하는지 확인, 유령 URL(수피부과 등) 없는지 검증
- [ ] 빌드 후 실제 production URL 로 3종 파일 접근 가능 확인

---

### [🟡 인프라완비, 데이터없음] #17. 외부 권위 링크 (sameAs) — GEO 핵심

**📌 코드 검증 (2026-04-17)**:
- [types.ts](src/lib/types.ts) L109-111 `Place` 타입에 `naverPlaceUrl`, `kakaoMapUrl`, `googleBusinessUrl` 필드 **이미 정의**
- [jsonld.ts](src/lib/jsonld.ts) L145-151 `generateLocalBusiness()` 가 **세 필드를 sameAs 배열로 자동 출력**
- 결론: **빌더 인프라 완성됨. 데이터 수집/입력만 남음**

**잔여 작업 (데이터 작업)**
- [ ] 등록된 모든 업체에 대해 네이버 플레이스 URL, 카카오맵 URL 수집
- [ ] 어드민 UI 또는 SQL UPDATE로 일괄 입력
- [ ] (선택) 인스타그램 등 추가 sameAs 필드를 `Place` 타입에 추가

**근거**: LLM 답변 생성 단계(GEO)에서 외부 권위 인용을 선호. `sameAs` 로 네이버 플레이스 / 카카오맵 / 인스타그램 URL 연결 시 entity linking 강화. 국내 GEO(Naver Clova / Perplexity 한국어 / ChatGPT 한국어 응답)에서 결정적.

**작업**
- [ ] 업체 데이터 스키마에 `external` 필드 추가
  ```ts
  external: {
    naverPlace?: string;
    kakaoMap?: string;
    instagram?: string;
    googleMaps?: string;
  }
  ```
- [ ] JSON-LD 빌더에서 `sameAs: [...Object.values(b.external)]` 출력
- [ ] 업체 상세 페이지에 외부 링크 UI 노출 (네이버 플레이스로 이동 등)

---

### [⚪ 재검증 필요] #18. 업체 슬러그 규칙 통일

**📌 코드 검증 (2026-04-17)**:
- [data.ts](src/lib/data.ts) seed의 슬러그는 모두 **수동** (`dr-evers`, `cleanhue`, `shinebeam-cheonan`, `alive-cheonan-asan` 등)
- 리뷰가 본 `restaurant-6kty`, `auto-repair-jyw4` 류는 **DB 자동생성** 추정 (어드민 register 액션이 자동 부여)
- [register-place.ts](src/lib/actions/register-place.ts) 슬러그 생성 로직 확인 필요

**현상**
- `restaurant-6kty`, `auto-repair-jyw4` (자동생성, 프리픽스+해시)
- `dr-evers`, `didu` (수동 슬러그)
- 혼재 → 유지보수 비용

**작업**
- [ ] 규칙 결정: **수동 슬러그 우선, 미설정 시 자동생성**
- [ ] 기존 자동생성 슬러그를 수동 슬러그로 마이그레이션 (예: `restaurant-6kty` → `danbi`)
- [ ] 마이그레이션 시 301 리다이렉트 설정
- [ ] 슬러그 규칙 문서화 (lowercase, 영문/하이픈, 카테고리 프리픽스 금지)

---

### [🔴 미해결] #19. compare 페이지 스키마 보강

**📌 코드 검증 (2026-04-17)**: [compare/topic/page.tsx](src/app/compare/%5Bcity%5D/%5Bcategory%5D/%5Btopic%5D/page.tsx) L61-74 의 JSON-LD는 **`Article` + `FAQPage` + `BreadcrumbList`** 만 출력. 비교 대상 업체들이 `entries` 배열로 있는데 `ItemList` 로 출력하지 않음.

**현상**
- `/compare/cheonan/dermatology/{topic}` 가 현재 `Article` 만 사용
- 비교 페이지는 `ItemList` + `Service` (또는 `Product`) 조합이 더 적절

**작업**
- [ ] `compare/[city]/[category]/[topic]/page.tsx` 의 JSON-LD 빌더 수정
- [ ] `ItemList` (비교 대상 리스트) + `Service` 개별 엔트리 추가
- [ ] 기존 `Article` 은 페이지 본문 메타로 유지

---

### [🟡 부분완료] #20. OG / Twitter 메타 보강

**📌 코드 검증 (2026-04-17)**: [layout.tsx](src/app/layout.tsx) L13-17:
```ts
openGraph: {
  type: "website",
  locale: "ko_KR",      // ✅ 이미 있음
  siteName: "AI Place", // ✅ 이미 있음
}
```
- **`og:locale`, `og:siteName` 이미 OK**
- **누락**: `twitter` 필드 전체. `twitter:card`, `twitter:site`, `twitter:creator` 모두 미설정

**현상**
- `og:site_name`, `og:locale` 홈에서 미관측
- Twitter Card에 `twitter:site`, `twitter:creator` 미노출

**작업**
- [ ] `og:locale=ko_KR`, `og:site_name="AI Place"` 명시
- [ ] 브랜드 X 계정 있으면 `twitter:site`, `twitter:creator` 추가
- [ ] `app/layout.tsx` 의 `metadata` 객체에 일괄 적용

---

### [🔴 미해결] #21. 메타데이터 / 스키마 빌더 중앙화

**📌 코드 검증 (2026-04-17)**:
- JSON-LD 빌더는 [src/lib/jsonld.ts](src/lib/jsonld.ts) 에 이미 어느 정도 집중 (`generateLocalBusiness`, `generateItemList`, `generateFAQPage`, `generateArticle`, `generateWebPage`, `generateWebSite`, `generatePerson`, `generateProfilePage`)
- **메타데이터 팩토리는 미존재** — 각 page.tsx의 `generateMetadata` 가 title 문자열을 직접 조합. 페이지별 일관성은 좋으나 변경 시 5~6곳 수정 필요
- 카테고리 → schema 타입 매핑은 [jsonld.ts](src/lib/jsonld.ts) L11-18 + [data.supabase.ts](src/lib/data.supabase.ts) `getSchemaTypeForCategory` 두 곳에 분산

**현상**
- 페이지별 일관성은 좋으나 문자열 템플릿이 각 페이지에 흩어져 있을 가능성

**작업**
- [ ] `src/lib/seo/page-meta.ts` — `buildPageMeta({ city, category, type, businessName })` 팩토리
- [ ] `src/lib/seo/schema/business.ts` — `buildBusinessJsonLd(b)` 빌더
  ```ts
  const typeMap = {
    dermatology: 'MedicalClinic',
    restaurant: 'Restaurant',
    webagency: 'ProfessionalService',
    interior: 'HomeAndConstructionBusiness',
    'auto-repair': 'AutoRepair',
  } as const
  ```
- [ ] 모든 페이지의 `generateMetadata` 가 이 팩토리 하나만 호출
- [ ] 카테고리 추가 시 단일 지점만 수정

---

### [🔴 미해결] #22. 날짜 자동화

**📌 코드 검증 (2026-04-17)**: [seo.ts](src/lib/seo.ts) L145 `generateCategoryDAB()`:
```ts
return `2026년 기준 ${cityName} ${catName} ${places.length}곳이 등록되어 있습니다.`
```
**`"2026년 기준"` 하드코딩**. `getFullYear()` 미사용.

[home page](src/app/page.tsx) L41 `note: '2026년 4월 기준'` 도 하드코딩 가능성.

추가 grep 필요 위치: 가이드/비교 페이지 본문, page.title 템플릿.

**현상**
- 헤드라인의 `"2026년 업데이트"` 문구가 정적 문자열일 가능성 → 연도 롤오버 시 수동 수정 필요

**작업**
- [ ] `new Date().getFullYear()` 또는 `lib/site-stats.ts` 의 `currentYear` 사용
- [ ] 콘텐츠의 마지막 수정일은 git 커밋 시각 또는 데이터 갱신일과 바인딩

---

## P3 — 퍼포먼스 / 접근성 / 보안 (다음 스프린트)

### [🔴 미해결] #23. Pretendard self-host

**📌 코드 검증 (2026-04-17)**: [layout.tsx](src/app/layout.tsx) L38-49 — jsdelivr CDN 의존:
```tsx
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
<link rel="preload" as="style" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/.../...min.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/.../...min.css" />
```
`next/font/local` 미사용. `public/fonts/` 디렉토리 미존재.

**현상**
- Pretendard v1.3.9 Variable via jsdelivr CDN 의존
- 퍼블릭 CDN 장애 시 FOIT/FOUT 위험

**작업**
- [ ] `/public/fonts/pretendard-variable.woff2` 배포
- [ ] `next/font/local` 사용으로 빌드 타임 최적화
- [ ] 외부 CDN preconnect 제거

---

### [🟡 부분완료] #24. 이미지 최적화 감사

**📌 코드 검증 (2026-04-17)**:
- [place-card.tsx](src/components/place-card.tsx) L20: `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"` — **반응형 sizes 양호**
- [slug]/page.tsx L149: `sizes="800px"` — **고정 크기**, 반응형 미활용. 모바일에서 과대 다운로드 가능성
- `priority` 속성 미사용 → LCP 후보 이미지에 적용 검토 필요

**작업**
- [ ] 업체별 실사진 확보 후 `next/image` 로 placeholder SVG 교체
- [ ] `<Image>` `sizes` 속성 감사: `sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw"`
- [ ] LCP 후보 이미지에 `priority` 속성 적용 범위 재검토

---

### [🔴 미해결] #25. CWV 측정 도입

**📌 코드 검증 (2026-04-17)**: [analytics.tsx](src/components/analytics.tsx) 컴포넌트 존재. Lighthouse CI 설정 / `@vercel/speed-insights` 패키지 / 별도 측정 도구 없음.

**작업**
- [ ] Lighthouse CI 또는 Vercel Speed Insights 도입
- [ ] LCP / INP / CLS 수치화 및 PR 단위 회귀 감지
- [ ] PageSpeed Insights 정기 측정

---

### [🟡 부분완료] #26. 접근성 보강

**📌 코드 검증 (2026-04-17)**:
- 실사진 이미지 `alt` 설정됨 (`alt={place.name}`)
- placeholder SVG는 alt 없음 — **장식용이라 `aria-hidden="true"` 처리가 정답** (alt 추가가 아님)
- 컬러 컨트라스트: `#6a6a6a` 텍스트 다수 사용 (footer, body) — AA 통과(4.84:1) AAA 미달(7)
- FAQ는 `<details>/<summary>` 사용 — 접근성 양호
- `prefers-reduced-motion` CSS 미확인

**작업**
- [ ] 모든 이미지(placeholder 포함) `alt` 속성 강제 (#7과 동일 인프라)
- [ ] `#6a6a6a` 컬러 컨트라스트 점검: AA 통과(4.84:1)지만 AAA(7) 미달 → 핵심 정보(운영시간·가격)는 더 짙은 톤
- [ ] FAQ `<details>` 사용 유지 (접근성 우수)
- [ ] 모바일 sticky 헤더에 `prefers-reduced-motion` 반영 여부 확인
- [ ] 카드 전체를 링크로 감쌀 때 `<a>` 안 `<a>` 중첩 없는지 regression 체크

---

### [⚪ 재검증 필요] #27. 보안 헤더 점검

**📌 코드 검증 (2026-04-17)**: 코드 레벨에서는 `next.config.*` 의 `headers()` 설정 미확인 → 별도 점검 필요. Vercel 배포 시 자동 헤더는 일부 적용됨. 런타임 `curl -I https://aiplace.kr` 로 실측 필요.

**작업** (브라우저 DevTools / `curl -I` 로 직접 확인)
- [ ] `Strict-Transport-Security` (max-age ≥ 15552000)
- [ ] `Content-Security-Policy` (jsdelivr 화이트리스트 포함 여부 — Pretendard self-host 시 제거)
- [ ] `X-Frame-Options: SAMEORIGIN` or `frame-ancestors`
- [ ] `Referrer-Policy: strict-origin-when-cross-origin`
- [ ] `Permissions-Policy`
- [ ] 이미지 응답에 `Cache-Control: public, max-age=31536000, immutable` + `Vary: Accept`
- [ ] `/_next/static/` 응답에 1년 immutable 캐시

---

### [✅ 결정완료] #28. 라우트 컨벤션 — `/blog/` 하나로 통합

**📌 코드 검증 (2026-04-17)**: 3종 prefix 도메인 혼재 확인:
- `src/app/[city]/[category]/k/[keyword]/` — 키워드
- `src/app/compare/[city]/[category]/[topic]/` — 비교
- `src/app/guide/[city]/[category]/` — 가이드

**✅ 결정 (2026-04-17)**: 세 종류 **전부 블로그 시스템(#47)으로 통합**. 기존 URL은 301 redirect.

**새 URL 구조**
```
/                                    # 홈
/[city]/[category]                   # 카테고리 목록 (유지)
/[city]/[category]/[slug]            # 업체 상세 (유지)
/blog                                # 블로그 홈 (신규)
/blog/[city]                         # 도시별 블로그 (선택적, 신규)
/blog/[city]/[sector]                # 대분류별 블로그 (선택적, 신규)
/blog/[city]/[sector]/[slug]         # 블로그 글 상세 (신규, 통합 대상)
```

**마이그레이션 대상 (12개 페이지)**
- 키워드 랜딩 8개 (`/cheonan/dermatology/k/*`)
- 비교 3개 (`/compare/cheonan/dermatology/*`)
- 가이드 1개 (`/guide/cheonan/dermatology`)

**작업 상세는 #47 참조**.

---

---

## 💎 LLM 전략 & 데이터 소스 (핵심 의사결정, 2026-04-17 추가)

### LLM 2-Tier 라우팅 전략 (Sonnet 주력 + Haiku 전처리)

**현재**: [register-place.ts](src/lib/actions/register-place.ts) L135, L219 — `claude-haiku-4-5` 단독 사용. Haiku는 분류·요약은 강하지만 한국어 마케팅 카피 생성은 약함 → 일반론 양산.

**권장 구조** (#34 구현 시 적용):

| 작업 | 모델 | 이유 | 빈도 |
|---|---|---|---|
| **메인 생성** (description, services, faqs, tags, recommendedFor, strengths) | **Claude Sonnet 4.6** (`claude-sonnet-4-6`) | 한국어 마케팅 카피·창의적 판단. 한 번의 호출로 전체 생성 | 업체당 1회 |
| **블로그·리뷰 대량 전처리** (네이버 블로그 20~30개 본문 → 키워드·테마 요약) | **Claude Haiku 4.5** (`claude-haiku-4-5-20251001`) | **정당한 분업 사례**: 원문 3만자 → 정제 컨텍스트 2,000자. Sonnet 토큰 85% 절감 + 품질 향상 | 업체당 1회 |
| (선택) **Self-Critique** — 품질 문제 발견 시 | **Claude Sonnet 4.6** 재호출 | 같은 모델에 "이 초안의 약점 3개 + 개선판" 요청. Opus 불필요 | 옵션 |

**왜 Opus를 뺐는가**
- 단순 정보 채우기(description + services + faqs + tags)는 Sonnet이면 충분
- Opus Critique는 호출당 $0.05~0.08 추가 → 체감 품질 개선 대비 비용 높음
- Self-Critique가 필요하면 Sonnet 재호출로 충분 (동일 모델 2-pass)

**왜 Haiku를 남겼는가 (정당한 이유 단 하나)**
- 네이버 블로그 검색 API 연동 시 20~30개 블로그 원문을 Sonnet에 그대로 넣으면 **토큰 폭발**
- Haiku로 1차 요약·키워드 추출 → Sonnet에 정제 컨텍스트 전달이 **효율·품질 둘 다 이득**
- 그 외 슬러그·태그 정규화 같은 순수 로직은 **TypeScript로 충분, AI 불필요**

### 비용 & 규모별 가이드

| 규모 | 전략 | 업체 1건당 비용 | 일 처리 비용 | 권장 |
|---|---|---|---|---|
| **소규모 (일 1-10건)** | Sonnet 단독 | ~$0.03 | $0.3 이하 | ✅ 파이프라인 복잡도 회피 |
| **중규모 (일 10-100건, 블로그 참조)** | Sonnet + Haiku 전처리 | ~$0.035 | $3.5 | ✅ **본 프로젝트 권장** |
| **대규모 (일 100-1,000건)** | Sonnet + Haiku + 배치 큐 | ~$0.035 | $35 | Rate limit 관리 추가 |
| **초대규모 (일 1,000건+)** | Haiku 주력 + Sonnet Critique만 | ~$0.01 | $10+ | 품질 저하 감수 |

### 파이프라인 분리의 숨은 비용 (솔직한 평가)

**분리가 정당한 경우** (현재 프로젝트에 해당)
- 네이버 블로그 20~30개 전처리 → Haiku로 토큰 절감 효과 명확
- 입력 데이터가 크고 요약·분류 선행 필요

**분리가 과잉인 경우** (피해야 할 안티패턴)
- 슬러그 생성 같은 결정론적 작업에 Haiku 투입 → TS 로직이면 충분
- Critique 단계마다 Opus 투입 → 단순 정보 채우기엔 비용 대비 효과 미미
- "혹시 품질 나쁠 수도 있어서" 예방적 3-Tier → **측정 없이 복잡도만 ↑**

**도입 원칙**
1. **단순화 먼저**: Sonnet 단독으로 시작
2. **병목 발견 후 분리**: 실제로 토큰 초과·품질 불만이 나오면 Haiku 추가
3. **측정 기반**: [scripts/baseline-test.ts](scripts/baseline-test.ts) AI 인용률로 효과 검증 후 확장

**원칙**: 사이트 본질이 "LLM 인용 디렉토리"(GEO). 인용되려면 콘텐츠가 일반론이 아니어야 함. **LLM 비용은 절대 아끼지 말되, 복잡도는 정당한 이유로만 추가**.

---

### 데이터 소스 한계 분석 (근본 문제)

**현재 구조 (단일 소스 의존)**
```
[Google Places API] → 이름·주소·전화·영업시간·평점·리뷰 5개·editorial summary(가끔)
       ↓
[Haiku LLM] → description / services / faqs / tags
```

**5가지 근본 한계**

1. **Google 리뷰는 한국 로컬의 진짜 데이터가 아님**
   - 한국 사용자 대부분 네이버 플레이스·카카오맵에 리뷰 작성
   - Google은 5~30건 수준, 한국 업체의 **네이버 500건 리뷰**와 양·질 격차
   - 결과: AI 생성 콘텐츠가 표면적·일반론화

2. **비즈니스의 진짜 차별점은 Google에 없음**
   - "원장이 강남 모 병원 출신", "월 100건 시술 경력", "J-Slim 정품 장비 보유"
   - 이런 specifics가 GEO 인용의 원동력인데 데이터 소스에 부재

3. **업종 도메인 권위 데이터 0**
   - 피부과: 건강보험심사평가원 병원평가·의료광고심의 통과 이력
   - 음식: 미슐랭·블루리본·식약처 위생등급
   - 자동차: 자동차정비사업조합 등록·자격증
   - 이런 권위 데이터가 entity authority 핵심

4. **Editorial summary 의존**
   - Google이 제공하는 업체만 사용 가능. 한국 업체 대부분 없음

5. **갱신 메커니즘 부재**
   - 1회 등록 후 정적. 6개월 후 메뉴·가격 변동 반영 안 됨
   - GEO에서 freshness 신호 활용 불가

**결론**: #34~#39 LLM 개선만으로는 **빈약한 인풋의 천장**을 뚫을 수 없음. 데이터 소스 다양화가 선행되어야 진정한 품질 향상 가능.

---

### [🔴 미해결 P0] #45. Multi-Source Data Enrichment (데이터 소스 다양화)

현재 Google Places 단일 의존 → **5개 소스 통합**.

#### A. 사장님 구조화 셀프 입력 (🥇 최고 ROI)
- 소상공인이 5분짜리 폼으로 입력:
  - 핵심 차별점 3가지 (자유 입력)
  - 시술/메뉴별 가격 (반복 입력)
  - 인증·자격증·수상 이력 (체크리스트 + 첨부)
  - 추천 대상 (다중 선택 + 자유 입력)
  - 사진 5~10장
- #41 사장님 포털과 연계 (→ #41을 P1으로 승격 권장)

#### B. 네이버 검색 API + 데이터랩 활용 (🥈 한국어 특화 권위 데이터)

**사용 가능 API 3종** (현재 프로젝트 연결):
1. 검색 API (블로그 / 뉴스 / 카페 / 지식iN / 쇼핑 엔드포인트 통합)
2. 데이터랩 — 검색어 트렌드
3. 데이터랩 — 쇼핑인사이트

##### B-1. 검색 API — 엔드포인트별 우선순위 (4개)

프로젝트에 연결된 검색 API 엔드포인트 활용 (문서: [docs/네이버 검색 api/](docs/네이버%20검색%20api/)):

| 엔드포인트 | 우선순위 | 용도 | 효과 |
|---|---|---|---|
| **블로그** (`/v1/search/blog.json`) | **P0** | 실제 사용자 후기 → description·services·faqs 보강 | **최고 ROI** |
| **카페글** (`/v1/search/cafearticle.json`) | **P1** | 커뮤니티 Q&A → FAQ 재료 | 스팸 필터링 필요 |
| **지역** (`/v1/search/local.json`) | **P2** | 주소 정규화(#8) + 미등록 업체 발견 | 부차적 |
| **이미지** (`/v1/search/image.json`) | **P3** | 생성 AI 프롬프트 레퍼런스 (간접) | 저작권 문제로 직접 사용 불가 |

---

###### [P0] 블로그 검색 API — 메인 활용

**엔드포인트**: `https://openapi.naver.com/v1/search/blog.json`
**파라미터**: `query={업체명}`, `display=30`, `sort=sim`

**업체 상세 페이지 품질 향상 파이프라인**:
```
업체 등록 Step 3.5: 네이버 블로그 레퍼런스 수집
  ↓
query="{업체명}" → 블로그 30개 수집 (title·description·bloggername·postdate)
  ↓
Haiku 전처리: 30개 본문 → 공통 테마·수치·용어 추출 (2,000자 요약)
  ↓
Sonnet 메인 생성: Google Places 데이터 + Haiku 요약 컨텍스트
  → description (실제 블로거 언급 반영)
  → services (공통 시술 우선 순위)
  → faqs (블로거들이 공통 궁금해하는 질문)
  → tags (자주 등장 키워드 상위 5-8개)
```

**블로그 글 생성 파이프라인** (신규 `/blog` 시스템):
- `query="천안 피부과 추천"` → 기획 글 경쟁 분석
- 여러 블로거 관점 종합 → 원본 콘텐츠 작성 시 레퍼런스
- Princeton GEO lever "Cite Sources": "여러 블로그에서 공통 언급되는 시술 TOP 5" 같은 통계 문장 자동 생성

---

###### [P1] 카페글 검색 API — FAQ 재료

**엔드포인트**: `https://openapi.naver.com/v1/search/cafearticle.json`
**파라미터**: `query="{업체명} 추천"` 또는 `query="천안 피부과"`, `display=20`, `sort=sim`

- 맘카페·지역 커뮤니티 실제 Q&A 수집
- Haiku 전처리: 스팸·광고 필터링 + Q&A 패턴 추출
- Sonnet이 FAQ 생성 시 컨텍스트로 활용 → **"실제로 묻는 질문"** 반영
- **주의**: 블로그보다 스팸 비율 높음 → Haiku 필터링 로직 필수 (광고성 "상담문의 kakao: xxx" 류 제거)

---

###### [P2] 지역 검색 API — 주소 정규화 + 업체 발견

**엔드포인트**: `https://openapi.naver.com/v1/search/local.json`
**파라미터**: `query="{업체명} {주소}"`, `display=5`

- `roadAddress`(도로명) + `address`(지번) 둘 다 제공 → #8 주소 정규화 레퍼런스
- Google Places 주소와 크로스체크하여 정확도 향상
- `sort=comment` + `query="천안 피부과"` → 리뷰 많은 미등록 업체 영업 리드 발견
- **제한**: display 최대 5건, start 최대 1 → 대량 수집 불가

---

###### [P3] 이미지 검색 API — 간접 활용만

**엔드포인트**: `https://openapi.naver.com/v1/search/image.json`

- ⚠️ **블로그 이미지는 저작권** → 직접 다운로드·사용 불가
- 활용 가능한 경우:
  - 생성 AI로 업체 대표 이미지 만들 때 "이런 분위기" 스타일 레퍼런스
  - 블로그 글 구도·소재 리서치
- 우선순위 최하. 사장님 셀프 업로드(#33)가 정공법

---

###### 업체 등록 플로우 통합 (Step 3.5 신설)

현재 [register-place.ts](src/lib/actions/register-place.ts) 의 3단계 플로우:
```
Step 1: searchPlace       → Google Places 검색
Step 2: enrichPlace       → Google + Kakao 자동 보강
Step 3: generatePlaceContent + generateRecommendation → LLM 생성
```

개선 후:
```
Step 1: searchPlace       → Google Places 검색
Step 2: enrichPlace       → Google + Kakao 자동 보강
Step 3: [신규] fetchNaverReferences
        → 블로그 30개 + 카페글 20개 병렬 수집
        → Haiku 전처리 (원문 → 정제 컨텍스트 2,000자)
Step 4: generatePlaceContent + generateRecommendation
        → Sonnet: Google + Kakao + 네이버 정제 컨텍스트 통합 입력
```

**핵심 이점**
- Sonnet에 **실제 한국어 레퍼런스** 투입 → 일반론 회피
- Haiku가 **정당한 분업 역할** 수행 (토큰 절감 + 품질 향상 동시)
- Google 단일 소스 의존 탈피

##### B-2. 데이터랩 — 검색어 트렌드 (🔥 키워드 전략 핵심)

현재 미활용. **SEO·GEO 의사결정 자동화의 열쇠** (키워드 트렌드 → 신규 콘텐츠 생성 트리거).

- 카테고리/도시별 검색어 트렌드 조회
  - `"천안 피부과"` vs `"천안 피부과 추천"` vs `"천안 여드름"` 상대 검색량
  - 계절성 (봄 피부관리, 여름 다이어트)
  - **키워드 랜딩 페이지(`/k/[keyword]`) 우선순위 자동 결정**
- 활용 시나리오:
  - [ ] 키워드 랜딩 생성 후보 풀 자동 산출 (검색량 상위)
  - [ ] 신규 콘텐츠 작성 전 트렌드 체크
  - [ ] 월간 트렌드 리포트 → description 갱신 트리거 (#45 F 갱신 파이프라인)
  - [ ] 계절 키워드 자동 반영 (봄: "모공 축소", 여름: "썬케어")

##### B-3. 데이터랩 — 쇼핑인사이트 (⚠️ 제한적 활용)

주로 e커머스 상품 트렌드용. 우리는 로컬 비즈니스 디렉토리라 직접 적용 범위 좁음. 다만:

- **뷰티 카테고리** (피부과·미용실)에서 연관 시술 트렌드 파악
  - "스킨부스터" 시술 관련 쇼핑 검색량 → 시술 인기 추이
- 음식점 카테고리는 해당 없음
- **우선순위 낮음** — B-1, B-2 먼저 도입 후 여유 시 검토

##### 요청 한도 (참고)
- 검색 API: **무료 25,000 req/day** (일 호출당 1건 = 업체당 4종 검색 → 일 6,250 업체 등록 여유)
- 데이터랩: **무료 1,000 req/day** (트렌드는 일별·주별 배치라 충분)

---

※ **네이버 지역검색 API 언급 제거**: 본 프로젝트에서는 사용하지 않음. 검색 API · 데이터랩(트렌드·쇼핑) 3종만 활용.

#### C. 네이버 플레이스 페이지 직접 스크랩 (조건부)
- **공식 API 없음**. 웹 스크래핑은 법적 회색지대
- 적용 가능 조건: **어드민 수동 수집 + 소량 + 서버사이드 캐시**
- 어드민이 네이버 플레이스 URL 입력 → 서버사이드 fetch + LLM 파싱
  - 메뉴/시술·가격 추출
  - 리뷰 테마 추출 (별점 분포·긍부정 키워드)
- 이미 [`Place.naverPlaceUrl`](src/lib/types.ts#L109) 필드 존재 → URL을 sameAs 용도 외로 확장 활용
- **면밀한 법률 검토 후 결정** (⚠)

#### D. 업종별 도메인 데이터 인젝션
- 정적 데이터를 카테고리별로 시드:
  - 피부과: 건강보험 적용 시술 코드 + 평균 가격대 (심평원 공개 데이터)
  - 음식: 식약처 위생등급
  - 자동차정비: 평균 정비비 표준단가
- LLM 프롬프트에 "이 카테고리 일반 가격대: X~Y원" 컨텍스트 주입 → 수치 정확도↑

#### E. Exa/Perplexity API 외부 검색 (🥉 보조)
- 업체명 + "리뷰/후기/평판" 검색 → 블로그·커뮤니티·뉴스 전반
- **영문 정보가 있는 업체(프리미엄·체인)에 특히 효과**
- 카테고리별 인용 시 신뢰도 검증 단계 필수

#### F. 자동 갱신 파이프라인 (P2)
- 6개월마다 Google + 네이버 재호출
- 평점·리뷰수 변동 감지 → description 업데이트 제안 자동 생성
- 사장님 알림 → 승인 워크플로

**작업 분해**
- [ ] A. 사장님 포털 구조화 폼 설계 (→ #41 P1 승격)
- [ ] B-1. 네이버 검색 API 통합 (블로그·뉴스·카페·지식iN) — `src/lib/naver-search.ts` 신규
  - 업체 등록 플로우에 "네이버 데이터 수집" Step 추가 (Google 보강 직후)
  - LLM 2-pass에서 해당 데이터를 컨텍스트로 주입
- [ ] B-2. 네이버 데이터랩 트렌드 통합 — `src/lib/naver-datalab.ts` 신규
  - 키워드 후보 자동 산출 배치 (주 1회 cron)
  - 어드민 UI에 "트렌드 키워드" 섹션
- [ ] B-3. 데이터랩 쇼핑인사이트는 뷰티 카테고리 PoC 후 판단
- [ ] C. 네이버 플레이스 스크래핑 법률 검토 → 결정 후 구현
- [ ] D. `src/lib/domain-data/` 카테고리별 정적 데이터 시드
- [ ] E. 기존 exa MCP (ECC) 활용하여 외부 신호 수집
- [ ] F. Cron 기반 갱신 큐 (Supabase Edge Functions)

---

**배경**: 향후 대량 업체 등록 예정. 현재 수동 등록 1건당 5~10분 소요. LLM 생성 품질은 **GEO 핵심 자산** (LLM 인용의 원천 콘텐츠).

### 현재 Admin Workflow 상태 (2026-04-17 검증)

| 영역 | 현재 상태 | 한계 |
|---|---|---|
| 대시보드 | 2개 카드 (목록/등록) | 통계·최근활동·KPI 전무 |
| 업체 목록 ([admin/places/page.tsx](src/app/admin/places/page.tsx)) | 시간순 단순 리스트 | 검색·필터·정렬·일괄작업 전무 |
| 업체 등록 ([admin/register/page.tsx](src/app/admin/register/page.tsx)) — 445 lines | Google Places 검색 → 자동보강 → AI 생성 → 수동 보정 | 1건씩만, 미리보기 없음, AI 품질 가변 |
| AI 콘텐츠 생성 ([register-place.ts](src/lib/actions/register-place.ts) `generatePlaceContent`) | claude-haiku-4-5 사용, 단일 호출 | 모델 약함, 재시도 없음, 품질 검증 없음 |
| AI 추천 생성 (`generateRecommendation`) | claude-haiku-4-5, zod 검증만 | placeType 7가지 고정, 카테고리 무관 |
| 업체 수정 ([admin/places/[id]/page.tsx](src/app/admin/places/%5Bid%5D/page.tsx)) | 풀 폼 재편집 | 인라인 편집 없음 |
| 상태 관리 | active/pending/rejected 3단계 | 워크플로 자동화 없음, 알림 없음 |
| 이미지 | `imageUrl` 필드만 존재 | **업로드 UI 없음** |
| 일괄 작업 | 없음 | 100건 등록 시 100번 클릭 |
| 사장님 포털 | 없음 | 모든 등록 = 어드민 작업 |
| 콘텐츠 버전 | 없음 | 수정 시 원본 손실 |

---

### Group A: 일일 Admin UX (P1, 이번 주)

#### [🔴 미해결] #29. 업체 목록 검색·필터·정렬·페이지네이션

**현재**: [admin/places/page.tsx](src/app/admin/places/page.tsx) L10-13 — `created_at desc` 단순 조회. 100건 넘으면 스크롤 지옥.

**작업**
- [ ] URL 쿼리 기반 필터: `?status=pending&city=cheonan&category=dermatology&q=검색어`
- [ ] 정렬: 평점·리뷰수·등록일·수정일·뷰카운트
- [ ] 페이지네이션 또는 무한 스크롤 (Supabase `range()`)
- [ ] 상태별 카운트 배지: `대기 12 · 활성 87 · 거절 3`
- [ ] 통합 검색: 업체명 + 주소 + 슬러그

#### [🔴 미해결] #30. 일괄 작업 (Bulk Actions)

**현재**: 한 번에 1건씩만 status 변경. 100건이면 100번 클릭.

**작업**
- [ ] 체크박스 다중 선택 → 일괄 승인/거절/삭제
- [ ] 일괄 카테고리 변경 (분류 재조정 시)
- [ ] 일괄 revalidatePath 큐 처리 (현재 sequential — 100건이면 페이지 갱신 폭주)
- [ ] 작업 결과 토스트: `87건 승인 / 2건 실패 (사유: ...)`

#### [🔴 미해결] #31. 등록 폼 실시간 검증 + 미리보기

**현재**: 검증이 [register-place.ts](src/lib/actions/register-place.ts) L273-295 submit 시점에만 발동. 수정·재제출 반복 발생.

**작업**
- [ ] `description` 글자수 실시간 카운터 (40~60자, **현재 N자** 시각화)
- [ ] FAQ 질문 끝 `?` 누락 즉시 경고
- [ ] 슬러그 중복 체크 typing 중 debounced API 호출
- [ ] **"미리보기" 버튼**: 임시 렌더로 공개 페이지 모습 확인 후 submit
- [ ] 카테고리 → schema 타입 매핑 미리 표시 ("이 업체는 `MedicalClinic` 으로 등록됩니다")

#### [🔴 미해결] #32. 인라인 편집 (목록에서 즉시 수정)

**현재**: 모든 수정이 상세 페이지 이동 → 풀 폼 재편집.

**작업**
- [ ] 목록에서 status·featured·tags 인라인 토글
- [ ] 상세에서 섹션별 부분 저장 (전체 폼 송신 X)
- [ ] 옵티미스틱 UI 업데이트 (Server Action + `useTransition`)

#### [🔴 미해결] #33. 이미지 업로드 (Supabase Storage)

**현재**: `Place.imageUrl` 필드만 있고, 업로드 UI/Storage 연동 없음. 모든 페이지가 placeholder SVG 노출.

**작업**
- [ ] Supabase Storage 버킷 `places-images` 생성 + RLS 정책
- [ ] 등록/수정 폼에 드래그앤드롭 업로드 + 자동 리사이즈 (next/image 호환)
- [ ] 업체당 다중 이미지 (`Place.images: PlaceImage[]` 이미 타입 존재 — types.ts L137-141)
- [ ] alt 텍스트 입력 강제 (접근성, SEO)
- [ ] 이미지 타입 분류 (`exterior | interior | treatment | staff | equipment` 이미 타입에 있음)

---

### Group B: LLM 품질 (P0 — GEO 핵심 자산)

> AI 인용이 사이트의 모든 가치. 생성 콘텐츠 품질 = 사이트 품질.
> 현재 `claude-haiku-4-5` 단일 호출 + 정규식 JSON 파싱 = **품질 가변·실패 빈발**.

#### [🔴 미해결] #34. LLM 모델 업그레이드 (Sonnet 주력 + Haiku 전처리)

**현재**: [register-place.ts](src/lib/actions/register-place.ts) L135 — `claude-haiku-4-5-20251001` 단독. 단일 호출로 description + services + faqs + tags 전부 생성. Haiku는 단순 작업엔 OK지만 한국어 마케팅 카피 품질은 약함.

**작업**
- [ ] **메인 모델 교체**: `generatePlaceContent` / `generateRecommendation` 모두 `claude-haiku-4-5-20251001` → **`claude-sonnet-4-6`**
  - 한 번의 호출로 description + services + faqs + tags + recommendation 전체 생성
  - Opus Critique 도입 안 함 (과잉 설계 방지)
- [ ] **Haiku는 전처리 한정**: 네이버 블로그 API(#45 B-1) 연동 시 블로그 원문 요약에만
  - 20~30개 블로그 본문 (3만자) → Haiku 요약 → 정제 컨텍스트 2,000자 → Sonnet 입력
  - 일반 단독 호출에는 Haiku 사용 안 함
- [ ] 순수 로직 작업은 AI 대신 TS:
  - 슬러그 생성 → regex + timestamp fallback (이미 구현됨)
  - 태그 정제(trim, dedupe, split) → Array 메소드 (AI 불필요)
- [ ] (선택) **Self-Critique** — 품질 문제가 실제로 측정될 때만:
  - Sonnet 재호출: "이 초안의 약점 3가지 + 개선판" → 품질 향상 효과 A/B 측정 후 도입
- [ ] 생성 시간 + 토큰 사용량 로깅 → 어드민 통계 (측정 기반 의사결정)

#### [🔴 미해결] #35. Few-Shot 예시 + Exemplar 라이브러리

**현재**: 시스템 프롬프트가 `"You are a JSON generator"` 한 줄. 예시 0개. Haiku는 예시 없으면 일반화된 콘텐츠 양산.

**작업**
- [ ] `src/lib/ai/exemplars.ts` 신규 — 우수 등록 업체 2~3개를 few-shot 예시로 보존
  - 닥터에버스 (의료) / 디두 (전문서비스) / 단비 (음식) 등
  - 각 업체의 description / services / faqs / tags + recommendation 데이터를 표본으로
- [ ] 카테고리별 exemplar 자동 매칭 (피부과 등록 시 닥터에버스 예시 주입)
- [ ] 프롬프트 구조화: `<exemplars>...</exemplars><target>이 업체...</target>`
- [ ] 시스템 프롬프트 강화: **Princeton GEO 7 levers** (Statistics Addition, Cite Sources, Quotation, Authoritative, Keyword Simple, Unique Words, Fluency) + **AEO Direct Answer Block** 40-60자 패턴 + E-E-A-T 명시

#### [🔴 미해결] #36. 구조화 출력 (Tool Use / JSON Mode)

**현재**: [register-place.ts](src/lib/actions/register-place.ts) L156-170 — 정규식 JSON 추출 + trailing comma + control char 제거. **취약**. `recommendationNote` 만 zod 검증 (L252-260), `generatePlaceContent`는 검증 없음.

**작업**
- [ ] Anthropic SDK **Tool Use** 로 구조화 출력 강제
  ```ts
  tools: [{
    name: 'register_business',
    input_schema: zodToJsonSchema(BusinessContentSchema)
  }],
  tool_choice: { type: 'tool', name: 'register_business' }
  ```
- [ ] 모든 LLM 출력에 zod 검증 (현재 `generatePlaceContent` 무검증 → 잘못된 구조 통과 가능)
- [ ] 실패 시 자동 재시도 (max 3회, 에러 메시지 피드백 루프)

#### [🔴 미해결] #37. 다중 후보 + 사람 선택

**현재**: 단일 후보 자동 채택. 어드민이 마음에 안 들면 manual 재작성.

**작업**
- [ ] description 후보 3개 생성 → 어드민이 카드로 선택
- [ ] FAQ 5개 풀에서 사용자가 3~5개 큐레이션
- [ ] 서비스 후보 7개 → 카테고리별 적합도 순 정렬
- [ ] "Regenerate" 버튼 + 피드백 입력 ("좀 더 친근하게", "전문 용어 줄여서")

#### [🔴 미해결] #38. 리뷰 데이터 활용 강화

**현재**: [register-place.ts](src/lib/actions/register-place.ts) L95 — Google 리뷰 5개만 사용. 짧은 리뷰는 낭비, 긴 리뷰는 잘림.

**작업**
- [ ] 리뷰 15~20개 가져오기 (Google Places API `maxReviewCount`)
- [ ] 1차 LLM 호출: 리뷰 → 핵심 테마 5개 추출 (긍정/부정/이슈)
- [ ] 2차 LLM 호출: 추출된 테마 + 카테고리 → description/services/faqs 생성
- [ ] `Place.reviewSummaries` 필드(types.ts L128-134 이미 정의)에 저장
- [ ] **재방문 시 갱신**: 6개월마다 리뷰 재수집 → description 자동 업데이트 제안

#### [🔴 미해결] #39. 품질 스코어링 + 게이트

**현재**: 생성 즉시 저장. 저질 콘텐츠가 활성화될 위험.

**작업**
- [ ] 자동 품질 점수 (0~100):
  - description 글자수 적정성 (10점)
  - 지역/업종 키워드 포함 (20점)
  - 구체적 수치/팩트 포함 (20점) — "5종 레이저", "주차 가능" 등
  - FAQ 질문 다양성 (15점) — 비용/예약/위치/시술 균형
  - 일반론 회피 (15점) — "친절합니다" 등 빈약 표현 감점
  - 카테고리 적합도 (20점) — 의료에 음식 용어 등
- [ ] 점수 < 70 자동 재생성 (max 2회)
- [ ] 어드민 목록에서 quality_score 컬럼 + 필터 ("저질 콘텐츠 보기")
- [ ] [Place](src/lib/types.ts) 또는 [DbPlace](src/lib/supabase-types.ts) 에 `quality_score INTEGER` 컬럼 추가

---

### Group C: 확장성·자동화 (P2, 다음 달)

#### [🔴 미해결] #40. CSV/엑셀 일괄 등록

**현재**: 1건씩만 등록. 100건 = 8~16시간.

**작업**
- [ ] CSV 템플릿: `name,city,category,address,phone,googlePlaceId(선택),naverPlaceUrl,kakaoMapUrl`
- [ ] 업로드 → 미리보기 → 검증 결과 (행별 OK/에러)
- [ ] 행별 Google Places 자동 검색 + AI 생성 큐 처리
- [ ] 진행률 UI: `47/100 처리 중...`
- [ ] 실패 행만 CSV 재다운로드

#### [🔴 미해결] #41. 사장님 셀프 서비스 포털

**현재**: 모든 등록·수정 = 어드민 작업. 확장 한계.

**작업**
- [ ] 공개 등록 페이지 `/register` (어드민 분리)
- [ ] 이메일 인증 → 본인 업체 클레임
- [ ] 사장님 대시보드 `/owner`: 본인 업체 정보 수정·이미지 업로드·운영시간 변경
- [ ] 어드민 승인 워크플로 (`status: pending → active`)
- [ ] 변경 알림 (어드민 + 사장님 양방향 이메일/카톡)

#### [🔴 미해결] #42. 콘텐츠 버전 관리·감사 로그

**현재**: 수정 시 원본 덮어쓰기. 누가/언제/무엇을 수정했는지 흔적 없음.

**작업**
- [ ] `places_history` 테이블: place_id, changed_by, changed_at, before_json, after_json
- [ ] 트리거 또는 Server Action에서 자동 기록
- [ ] 어드민 상세 페이지에 "변경 이력" 탭
- [ ] AI 생성 vs 사람 편집 구분 (`source: 'ai' | 'human' | 'mixed'`)
- [ ] 롤백 기능 (이전 버전 복원)

#### [🔴 미해결] #43. AI 인용 추적 대시보드 (admin 통합)

**현재**: [scripts/baseline-test.ts](scripts/baseline-test.ts) 가 인용 측정하지만 어드민에서 안 보임. 의사결정 분리.

**작업**
- [ ] `/admin/citations` 페이지: 업체별 ChatGPT/Claude/Gemini 인용 빈도
- [ ] 시간추이 그래프 (콘텐츠 변경 후 인용률 변화)
- [ ] 저인용 업체 자동 표시 → AI 콘텐츠 재생성 트리거
- [ ] CitationResult 데이터(types.ts L246-256 이미 정의) 시각화

#### [🔴 미해결] #44. 알림 시스템 (Webhook + 이메일)

**현재**: 상태 변경 = 사일런트.

**작업**
- [ ] 사장님 이메일: 등록 승인/거절/리뷰 알림
- [ ] 어드민 슬랙 웹훅: 신규 등록 / pending 누적 알림
- [ ] (옵션) 카카오 알림톡 연동

---

#### [🔴 미해결 P0] #46. 단일 입력 업체 검색 (Unified Search + 주소 기반 Dedup)

**배경**: 현재 [register/page.tsx](src/app/admin/register/page.tsx) 는 "도시 선택 + 대분류 + 소분류 검색 + 업체명" 4단계. Google Places Text Search 단독 의존 → 한국 소상공인 커버리지 부족 + 동명 업체 혼동.

**목표**: 한국 사용자가 네이버/카카오에 검색하듯 `"천안 차앤박피부과"` 단일 입력으로 정확한 업체 확정.

**설계: 3-Source 병렬 + 주소 기반 Dedup + Fallback**

```
Step 1: 어드민 입력 "천안 차앤박피부과"
       ↓
Step 2: 3-Source 병렬 검색
       ├─ Kakao Local Search  (한국 주력, 무료)
       ├─ Google Places Text Search (리뷰 데이터 보강)
       └─ Naver 지역 검색      (보완, 5건 제한)
       ↓
Step 3: 주소 기반 Dedup & Merge
       같은 업체의 3개 결과를 1개로 병합
       sameAs URL 3개 모두 보존 (GEO 핵심 신호)
       ↓
Step 4: 병합된 후보 목록 표시
       예: "차앤박피부과 천안불당점 [Kakao·Google·Naver 모두 등록]"
       ↓
Step 5: 어드민 클릭 → 업체 확정
       자동 추출: city (주소 파싱) + category (category_name + types)
                 + sector + schemaType + 좌표
       ↓
Step 6: 네이버 블로그·카페 수집 → Haiku 요약 (#45 연계)
       ↓
Step 7: Sonnet 메인 생성
       ↓
Step 8: 어드민 검토·저장

Fallback (검색 0건): 수동 입력 + Kakao 우편번호(daum.postcode) 주소 확정
```

**중복 제거 알고리즘 (주소 기반)**

```ts
function isSameBusiness(a: Candidate, b: Candidate): boolean {
  // 1순위: 정규화된 도로명주소 완전 일치
  if (normalizeAddress(a.roadAddress) === normalizeAddress(b.roadAddress)) return true

  // 2순위: 좌표 50m 이내 + 이름 유사도 > 0.8
  if (distance(a.location, b.location) < 50 &&
      stringSimilarity(a.name, b.name) > 0.8) return true

  // 3순위: 전화번호 일치
  if (normalizePhone(a.phone) === normalizePhone(b.phone)) return true

  return false
}

function normalizeAddress(addr: string): string {
  return addr
    .replace(/^충청남도/, '충남')
    .replace(/^충청북도/, '충북')
    .replace(/\s+/g, ' ')
    .replace(/번지|호|층/g, '')
    .trim()
}
```

**병합 정책** (소스별 강점 활용)

| 필드 | 우선순위 | 이유 |
|---|---|---|
| `name` | Kakao → Naver → Google | 한국어 표기 정확 |
| `roadAddress` | Kakao → Naver → Google | 한국 도로명 표준 |
| `jibunAddress` | Kakao → Naver | Google은 지번 미흡 |
| `location` | Kakao (WGS84) → Google | 좌표 정확도 |
| `rating`, `reviewCount`, `reviews` | **Google 전용** | Kakao·Naver 리뷰 API 없음 |
| `rawCategory` | Kakao → Naver | 한국어 카테고리 문자열 |
| sameAs 3개 (`kakaoMapUrl`, `googleBusinessUrl`, `naverPlaceUrl`) | **모두 보존** | GEO 핵심 |

**UI 표시**

```
┌──────────────────────────────────────────┐
│ 차앤박피부과 천안불당점                   │
│ 📍 충남 천안시 서북구 불당21로 67-18      │
│ ⭐ 4.6 · 리뷰 203건 (Google)             │
│ 🏷 Kakao · Google · Naver (3곳 등록)     │  ← 배지
└──────────────────────────────────────────┘
```

**자동 추출 규칙**

- `city`: `roadAddress` → `sigunguCode` → 매핑 테이블 (`SIGUNGU_TO_CITY`)
- `category` (Tier 1-2-3):
  - T1: Kakao `category_name` (`"의료,건강>피부과"`) → 규칙 매핑 → `dermatology`
  - T2: Google `primaryType` → 보조 매핑
  - T3: Haiku 폴백 (T1·T2 실패 시)
- `sector`: `category` → `getSectorForCategory()`
- `schemaType`: `sector.schemaType`

**Fallback: 검색 0건 시 수동 입력**

- Kakao 우편번호 위젯(`daum.postcode`) 로 주소 확정
- 업체명·전화·카테고리 수동 입력
- validation: `kakaoPlaceId` OR `googlePlaceId` OR `naverPlaceId` OR `manual=true`

**현재 코드 한계**

- [register-place.ts](src/lib/actions/register-place.ts) L287-289: `googlePlaceId` 필수 → 완화 필요
- `searchPlace()` 가 Google Places Text Search만 호출 → 3-Source 병렬화 필요
- 주소 파싱·정규화 유틸 부재

**이점**
- 어드민 입력 5단계 → 1단계
- 한국 업체 커버리지 ~99% (Kakao 주력 + Google·Naver 보완 + 수동 Fallback)
- 동명 업체 완전 구분 (주소 기반)
- sameAs 3개 자동 확보 → GEO 강력
- city·category·schemaType·좌표 자동 확정
- 주소 정규화(#8) 병합 이점 자동 획득

---

#### [🔴 미해결 P0] #47. 블로그 시스템 구축 + 콘텐츠 통합 마이그레이션

**배경**: 현재 키워드 랜딩·비교·가이드가 3종 별개 라우트(`/k/`, `/compare/`, `/guide/`)로 분산. 일관성 없고, 업체 페이지와 정보성 콘텐츠의 경계가 모호. **전부 블로그 시스템으로 통합**하여 구조 단순화 + SEO/GEO 이점 극대화.

**연계**: 이전 CEO 플랜 ([~/.gstack/projects/ai-place/ceo-plans/2026-04-16-blog-system.md](~/.gstack/projects/ai-place/ceo-plans/2026-04-16-blog-system.md)) 의 블로그 시스템과 완전 통합. 승인된 범위: `view_count`, `place↔blog 양방향 링크`, `/blog SEO 랜딩페이지`, `quality_score`.

**새 URL 구조**
```
/blog                                # 블로그 홈 (SEO 랜딩, CollectionPage JSON-LD)
/blog/[city]                         # 도시별 (선택)
/blog/[city]/[sector]                # 대분류별 (선택)
/blog/[city]/[sector]/[slug]         # 블로그 글 상세
```

**Breadcrumb** (5단계, #12 참조):
```
홈 › 블로그 › 천안 › 의료 › 천안 피부과 여드름 치료 비교
```

**DB 스키마** (Supabase `blog_posts` 테이블)
```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  sector TEXT NOT NULL,            -- medical, auto, food, ...
  category TEXT,                   -- dermatology, dental, ... (선택)
  title TEXT NOT NULL,
  summary TEXT NOT NULL,           -- Direct Answer Block (40-60자)
  content_md TEXT NOT NULL,        -- 본문 마크다운
  post_type TEXT NOT NULL,         -- 'keyword' | 'compare' | 'guide' | 'general'
  related_place_slugs TEXT[],      -- place↔blog 양방향 링크
  target_query TEXT,               -- 키워드 랜딩용
  faqs JSONB,
  statistics JSONB,
  sources JSONB,
  view_count INTEGER DEFAULT 0,
  quality_score INTEGER,
  published_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'draft'      -- draft | active | archived
);
CREATE INDEX ON blog_posts(city, sector);
CREATE INDEX ON blog_posts USING GIN(related_place_slugs);
```

**마이그레이션 대상 (12개 페이지)**

| 현재 경로 | 타입 | 새 경로 |
|---|---|---|
| `/cheonan/dermatology/k/acne` | keyword | `/blog/cheonan/medical/cheonan-dermatology-acne` |
| `/cheonan/dermatology/k/botox` | keyword | `/blog/cheonan/medical/cheonan-dermatology-botox` |
| `/cheonan/dermatology/k/lifting` | keyword | `/blog/cheonan/medical/cheonan-dermatology-lifting` |
| `/cheonan/dermatology/k/blemish` | keyword | `/blog/cheonan/medical/...` |
| `/cheonan/dermatology/k/night-clinic` | keyword | 동 |
| `/cheonan/dermatology/k/recommend` | keyword | 동 (카니발라이제이션 동시 해소 — #2) |
| `/cheonan/dermatology/k/hair-loss` | keyword | 동 |
| `/cheonan/dermatology/k/scar` | keyword | 동 |
| `/compare/cheonan/dermatology/acne-treatment` | compare | 동 |
| `/compare/cheonan/dermatology/laser` | compare | 동 |
| `/compare/cheonan/dermatology/anti-aging` | compare | 동 |
| `/guide/cheonan/dermatology` | guide | `/blog/cheonan/medical/cheonan-dermatology-guide` |

**작업 분해**

###### A. 블로그 인프라
- [ ] Supabase `blog_posts` 테이블 migration
- [ ] `src/lib/blog/types.ts` — BlogPost 타입
- [ ] `src/lib/blog/data.supabase.ts` — CRUD 쿼리 함수
- [ ] `src/app/blog/page.tsx` — 블로그 홈 (CollectionPage JSON-LD)
- [ ] `src/app/blog/[city]/[sector]/[slug]/page.tsx` — 상세
- [ ] `src/app/blog/[city]/page.tsx` — 도시별 (선택)
- [ ] `src/app/blog/[city]/[sector]/page.tsx` — 대분류별 (선택)
- [ ] `src/app/blog/opengraph-image.tsx` — OG 이미지

###### B. 마이그레이션 스크립트
- [ ] `scripts/migrate-to-blog.ts` — 기존 12개 페이지 → blog_posts 레코드 변환
  - KeywordPage → `post_type: 'keyword'`
  - ComparisonPage → `post_type: 'compare'`
  - GuidePage → `post_type: 'guide'`
  - `target_query`, `related_place_slugs` 매핑
  - slug 규칙: `{city}-{category}-{topic}` (예: `cheonan-dermatology-acne`)

###### C. 301 Redirect
- [ ] `next.config.mjs` `redirects()` 함수에 12개 매핑 추가
  ```ts
  async redirects() {
    return [
      {
        source: '/cheonan/dermatology/k/:keyword',
        destination: '/blog/cheonan/medical/cheonan-dermatology-:keyword',
        permanent: true,
      },
      {
        source: '/compare/:city/:category/:topic',
        destination: '/blog/:city/medical/:city-:category-:topic',
        permanent: true,
      },
      {
        source: '/guide/:city/:category',
        destination: '/blog/:city/medical/:city-:category-guide',
        permanent: true,
      },
    ]
  }
  ```

###### D. 기존 라우트 제거
- [ ] `src/app/[city]/[category]/k/` 디렉토리 삭제
- [ ] `src/app/compare/` 삭제
- [ ] `src/app/guide/` 삭제
- [ ] `getKeywordPage`, `getComparisonPage`, `getGuidePage` → blog 쿼리로 래핑 (backward compat 일정 기간)

###### E. 인덱스 신호
- [ ] `sitemap.ts` 재구성: 12개 제거 → blog URL 추가
- [ ] 301 redirect 후 Google Search Console "URL 변경" 요청
- [ ] IndexNow API 호출 (기존 `scripts/indexnow.ts` 활용)
- [ ] `llms.txt` 업데이트

###### F. Breadcrumb (#12 연계)
- [ ] 블로그 페이지 5단계 breadcrumb: `홈 › 블로그 › [도시] › [대분류] › [글]`
- [ ] 업체 페이지 4단계 breadcrumb: `홈 › [도시] › [업종] › [업체]`

###### G. place ↔ blog 양방향 링크
- [ ] 업체 상세 페이지에 "관련 블로그 글" 섹션 (related_place_slugs 역방향 조회)
- [ ] 블로그 글 본문에 언급된 업체로 앵커 링크

###### H. 블로그 홈 SEO 랜딩 (/blog)
- [ ] 카테고리별 섹션 (도시 × 대분류 매트릭스)
- [ ] 인기글 TOP 5 (view_count 기준)
- [ ] 최근 작성 10개
- [ ] CollectionPage JSON-LD

###### I. 어드민 블로그 CRUD
- [ ] `/admin/blog` 목록 (검색·필터·정렬)
- [ ] `/admin/blog/new` AI 콘텐츠 생성 (Sonnet + 네이버 블로그 API 참조, #34·#45 연계)
- [ ] `/admin/blog/[id]` 편집

**이점**
- URL 구조 일관 (유지보수 ↑)
- `/blog` 자체가 SEO 자산 (CollectionPage, 카테고리 허브)
- place↔blog 양방향 링크 → 내부링크 밀도 ↑ (SEO·GEO)
- `view_count` 로 인기 콘텐츠 측정 → 재생성 의사결정 기반
- `quality_score` 로 게이트 (저질 콘텐츠 자동 숨김)
- 네이버 블로그 참조(#45 B-1) 직접 활용 → 콘텐츠 품질 상승

**예상 공수**: 4-6일 (마이그레이션 포함)

---

| Group | 항목 수 | 예상 공수 |
|---|---|---|
| A: 일일 Admin UX | 5 (#29~#33) | 2~3일 |
| B: LLM 품질 | 6 (#34~#39) | 2~3일 |
| C: 확장성 | 5 (#40~#44) | 1~2주 |

**합계 16개 항목 추가** → 전체 WO **44개 항목**.

---

## 작업 순서 권장 (통합)

```
P0 #1 (수피부과 제거) + #2 (blog 이전으로 자동 해소 — #47 일환)
  ↓
P0 #3 #4 #5                                    ← 데이터/컴포넌트 수정 (반나절)
  ↓
P0 #47                                          ← 블로그 시스템 + 12개 마이그레이션 (#2 #12 #28 동시 해소)
  ↓
P0 #46                                          ← 단일 입력 검색 (Admin 대량 등록 전 필수)
  ↓
P0 #45                                          ← 데이터 소스 다양화 (LLM 개선의 선행조건)
  ↓
P0 #34 #35 #36 #39                             ← LLM 품질 (GEO 직접 영향, #45 #47 인풋 활용)
  ↓
P1 #6 #7                                       ← thin content + H1 포맷 (반나절)
  ↓
P1 #8 #9 #10 #11                               ← format 유틸 4개 한 번에
  ↓
P1 #12 #13 #14                                 ← 템플릿/태그 통일
  ↓
P1 #29 #30 #31 #32                             ← Admin 일일 UX (대량 등록 전 필수)
  ↓
P1 #37 #38                                     ← LLM 다중 후보·리뷰 활용
  ↓
P2 #15 #16 #17 #33                             ← 보안/SEO+GEO/이미지 업로드
  ↓
P2 #18 #19 #20 #21 #22                         ← 인프라 정리
  ↓
P2 #40 #41 #42                                 ← 일괄·셀프서비스·버전관리
  ↓
P3 #23~#28 #43 #44                             ← 퍼포먼스/접근성/알림
```

## 작업 순서 권장 (축별 분해)

> 특정 축의 지표(예: LLM 인용률, CWV, 답변박스 노출)를 단기 집중으로 높이고 싶을 때 참고.

### 🔍 SEO 트랙 (전통 검색엔진 랭킹)
```
P0:  #47 블로그 시스템 (#2 #28 동시 해소) → #3 숫자 일관성 → #5 Footer 동적화
P1:  #6 thin 처리 (옵션 B 가이드 본문) → #12 breadcrumb (2종 분리) → #13 템플릿
     → #14 태그 → #16 Yeti/Daum/Bing → #18 슬러그 → #20 OG/Twitter → #21 메타 중앙화
P2:  #15 admin 차단 → #23 Pretendard → #24 이미지 sizes → #25 CWV
     → #26 접근성 → #27 보안헤더
```
**측정 지표**: GSC (Google Search Console) 노출·클릭, NSC (Naver Search Central), Core Web Vitals, 키워드 순위

### 💬 AEO 트랙 (답변 엔진 / Featured Snippet / Voice)
```
P0:  #4 업종별 면책 분기 (답변 정확도)
P1:  #9 영업시간 포맷 → #10 가격 포맷 → #11 Review 스키마 + AggregateRating 버그
     → #19 compare ItemList
P2:  How-to schema 신규 추가 (가이드 페이지)
P3:  Speakable schema 추가 (음성 검색)
```
**측정 지표**: Google Rich Results Test, Featured Snippet 노출 빈도, Position Zero 점유

### 🤖 GEO 트랙 (LLM 인용 / ChatGPT · Claude · Perplexity · Gemini)
```
P0:  #1 숫자·사실 일관성 → #46 단일 입력 검색 → #45 Multi-Source Enrichment
     → #34 LLM 2-Tier → #35 Few-Shot Exemplar → #36 Tool Use → #39 품질 스코어
P1:  #7 H1 entity 식별 → #8 주소 정규화 → #17 sameAs 데이터 입력
     → #22 날짜 자동화 → #37 다중 후보 → #38 리뷰 활용 강화
     → #41 사장님 포털 (고유 데이터 소스)
P2:  #33 이미지 업로드 (image context for vision LLMs)
P3:  #43 AI 인용 추적 대시보드
```
**측정 지표**: [scripts/baseline-test.ts](scripts/baseline-test.ts) 기반 AI 인용률 (ChatGPT/Claude/Gemini), 업체명 언급 빈도, aiplace.kr 출처 인용 횟수, Princeton 7 levers 점수

### 🛠️ Admin/Scale 트랙 (대량 등록 대비)
```
P0:  #46 단일 입력 업체 검색 (등록 UX 혁신)
P1:  #29 목록 UX → #30 일괄 작업 → #31 실시간 검증 → #32 인라인 편집
P2:  #40 CSV 일괄 → #42 버전 관리
P3:  #44 알림 시스템
```
**측정 지표**: 업체 1건 등록 평균 시간, 일괄 처리 성공률

### 시나리오별 시작 순서 권장

| 이번 달 목표 | 권장 순서 |
|---|---|
| **GEO 인용률 최우선** (LLM 응답에 자주 등장) | `#1 → #45 → #34 → #35 → #36 → #39 → #17 → #22` |
| **검색엔진 랭킹 먼저** (Google/Naver 순위) | `#2 → #3 → #5 → #6 → #23~#25 (CWV)` |
| **답변박스 노출** (Google 피쳐드 스니펫) | `#4 → #9 → #10 → #11 → #19` |
| **대량 등록 인프라** (운영 효율) | `#46 → #29 → #30 → #31 → #32 → #33 → #40` |

---

## 완료 정의 (Definition of Done)

- [ ] 모든 체크박스 체크 (`[SKIP]` 포함)
- [ ] `npm run build` 경고 없이 성공
- [ ] `view-source` 로 JSON-LD schema 샘플 3개 페이지 검증 (피부과 1 / 웹에이전시 1 / 자동차정비 1)
- [ ] 유령 업체("수피부과" 등) 코드베이스 grep 결과 0건
- [ ] Google Rich Results Test 통과 (최소 피부과 상세 1개)
- [ ] 카니발라이제이션 0건 확인 (`/cheonan/dermatology` vs `/k/recommend`)
- [ ] 모든 페이지의 업체 수치가 단일 소스에서 일치
- [ ] `.claude/checkpoints.log` 에 완료 기록
- [ ] 지수님 육안 검증 후 배포

---

## GEO(Generative Engine Optimization) 핵심 원칙

사이트의 선언적 목표(LLM 인용)와 직결. LLM은 다음을 선호:

1. **같은 사실이 여러 출처에 일치** → 숫자 불일치(#1) 치명적
2. **업체명·주소·전화·시간의 정확한 한 줄 요약** → 현재 메타 디스크립션에 잘 녹아있음, 유지
3. **외부 권위 인용** → `sameAs`(#17) 로 네이버 플레이스 / 카카오맵 / 인스타 URL 연결 시 즉시 강화 (Princeton lever: Cite Sources)
4. **최근 업데이트** → 날짜 자동화(#22) 필요 (Freshness 신호)
5. **통계·수치 밀도** → Princeton lever: Statistics Addition (+32% 인용률)
6. **권위 표현·고유 용어** → Princeton levers: Authoritative + Unique Words

**Naver Yeti + 카카오맵/네이버 플레이스 연결이 국내 GEO(특히 Naver Clova / Perplexity 한국어 / ChatGPT 한국어 응답) 에서 결정적.**

---

## 변경 이력

- 2026-04-17 초안 작성 (WORK_ORDER_aiplace_review.md)
- 2026-04-17 닥터에버스 평점 불일치 항목 제거 (캐시된 구버전 관찰)
- 2026-04-17 SEO/기술 리뷰(revew-2.md) 통합 — 통합본으로 단일화
  - 추가: 카니발라이제이션(#2), thin content(#6), H1 포맷(#7), Review 스키마(#11), Yeti 명시(#16), sameAs(#17), 슬러그 통일(#18), compare 스키마(#19), OG/Twitter 보강(#20), 메타데이터 중앙화(#21), 날짜 자동화(#22), Pretendard self-host(#23), 이미지 최적화(#24), CWV(#25), 접근성(#26), 보안 헤더(#27), 라우트 컨벤션(#28)
- 2026-04-17 실제 코드 검증 반영 (1차)
  - "🗺️ 실제 경로 매핑" 섹션 추가 — 리뷰 문서의 `content/*`, `components/layout/*`, `lib/format/*`, `app/[city]/[industry]/*` 경로가 실제와 다름을 명시
  - 데이터 레이어 이중 구조(data.ts seed + Supabase) 및 `/k/recommend` 가 별도 라우트 아님 설명 추가
  - `[부분완료]` 마킹: #3, #6, #12
- 2026-04-17 실제 코드 검증 반영 (2차 — 전수 검증)
  - "📊 현재 코드 상태 요약" 표 추가 — 28개 항목 전수 상태 + 핵심 근거 + 예상 공수
  - 모든 항목 제목에 상태 마커 부착: 🔴 미해결 / 🟡 부분완료 / 🟢 해결됨 / ⚪ 재검증 / ❓ 정책결정
  - 각 항목에 "📌 코드 검증" 블록 추가 — 실제 파일/라인 근거
  - **신규 발견 사항**:
    - #11: [slug]/page.tsx L394-402 `AggregateRating` 단독 `@type` 출력은 비표준 + LocalBusiness 내부 출력과 중복 → 버그
    - #15: middleware.ts 가 이미 /admin 보호 중. 헤더는 InquiryButton 모달 사용 → 해결됨
    - #17: sameAs 인프라(types + jsonld) 완비, 데이터만 비어있음
    - #20: og:locale, og:siteName 이미 설정됨. Twitter Card만 누락
    - #16: sitemap은 이미 `activeCategoryKeys` 필터로 빈 카테고리 제외됨
    - #14: place-card 태그 렌더 정상. 리뷰의 "리프팅보톡스필러..." 는 DB의 `tags` 필드가 단일 문자열일 가능성
- 2026-04-17 Admin/LLM 개선 16개 항목 신규 추가 (3차)
  - 사용자 요청: 대량 업체 등록 대비 admin workflow 개선 + LLM 입력 콘텐츠 품질 개선
  - 현재 admin workflow 검증 후 한계 표 작성
  - 3개 그룹으로 분류: A) 일일 Admin UX (#29~33), B) LLM 품질 (#34~39 — GEO 직접 영향), C) 확장성 (#40~44)
  - **P0 승격 항목**: #34 (모델+2-Pass), #35 (Few-Shot Exemplar), #36 (Tool Use), #39 (품질 스코어) — LLM 콘텐츠가 사이트 핵심 자산이므로
  - 작업 순서 권장에 신규 항목 통합
- 2026-04-17 LLM 전략 & 데이터 소스 다양화 (4차)
  - 사용자 질문: LLM 선택 + 데이터 소스 한계
  - "💎 LLM 전략 & 데이터 소스" 섹션 신규 추가
  - **LLM 3-Tier 라우팅**: Sonnet 4.6 초안 + Opus 4.7 critique + Haiku 4.5 유틸
  - **#45 Multi-Source Data Enrichment** P0 신규: 사장님 포털 + 네이버 API + (조건부) 플레이스 스크랩 + 도메인 데이터 + Exa
  - 작업 순서에 #45를 LLM 개선(#34~) 앞에 배치 — "빈약한 인풋으론 좋은 아웃풋 불가"
- 2026-04-17 **SEO/AEO/GEO 3축 재구조화** (5차)
  - 사용자 지적: "AEO는 답변 기반, GEO가 LLM 기반" — 그동안 AEO/GEO 혼용 → 정정
  - "🎯 SEO / AEO / GEO 3축 전략" 섹션 신규 (최상단) — 3축 정의·전술·45개 항목 × 3축 매핑 표
  - Princeton GEO 7 levers (Statistics·Cite Sources·Quotation·Authoritative·Keyword Simple·Unique Words·Fluency) 명시
  - "작업 순서 권장 (축별 분해)" 섹션 신규 — SEO/AEO/GEO/Admin 4트랙 독립 순서
  - 시나리오별 시작 순서 표 (GEO 최우선 / SEO 먼저 / 답변박스 / 대량 등록)
  - 잘못된 "AEO" 표기를 문맥별로 정정:
    - LLM 인용 관련 → GEO (L771, 1041, 1054, 1092, 1174, 1250, 1413, 1459, 1487)
    - Direct Answer Block 언급은 AEO 유지
    - robots.txt AI 크롤러 관련 → GEO로 재분류
  - "🎖️ GEO 핵심 원칙" 섹션 (기존 "AEO 핵심 원칙" 개명·보강)
- 2026-04-17 **의사결정 5개 확정 + #47 블로그 시스템 추가** (8차)
  - 사용자 결정: D-1 제거 / D-2 blog 이전으로 자동 해소 / D-3 옵션B 가이드본문 / D-4 2종 분리(업체 4단계 + 블로그 5단계) / D-5 `/blog/` 통합
  - **구조 변경**: 키워드·비교·가이드 3종 라우트 → **블로그 시스템 통합**
  - **#47 블로그 시스템** P0 신규 추가 — CEO 플랜(2026-04-16) 과 완전 연계, 12개 페이지(키워드 8 + 비교 3 + 가이드 1) 마이그레이션
  - **새 URL 구조**: `/[city]/[category]/[slug]` (업체 유지) + `/blog/[city]/[sector]/[slug]` (블로그 신규)
  - WO #2 #6 #12 #28 항목 결정 반영 (#2 #28 은 #47 일환으로 해소, #6 옵션B 확정, #12 타입별 분리)
  - 작업 순서에 #47을 Phase 1.5 로 배치 (#2 #12 #28 동시 해소 효과)
- 2026-04-17 **#46 단일 입력 업체 검색 추가** (7차)
  - 사용자 지적: 한국 소상공인 Google 커버리지 부족 + "천안 차앤박피부과" 식 단일 입력이 자연스러움 + 3-Source 병렬은 중복 제거로 해결
  - **#46 단일 입력 업체 검색 (Unified Search + 주소 기반 Dedup + Fallback)** P0 신규 추가
  - 핵심: Kakao + Google + Naver 3-Source 병렬 → 주소 기반 dedup → 단일 후보로 병합 → sameAs 3개 자동 확보
  - Fallback: 검색 0건 시 Kakao 우편번호(daum.postcode)로 수동 입력
  - 자동 추출: city(주소 sigunguCode) + category(Kakao category_name + Google types + Haiku 폴백) + sector + schemaType + 좌표
  - 기존 `googlePlaceId` 필수 → `kakaoPlaceId` / `googlePlaceId` / `naverPlaceId` / `manual=true` 중 하나로 완화
  - 작업 순서에 #46을 #45 앞에 배치 (등록 UX 혁신이 대량 등록의 선행조건)
- 2026-04-17 LLM 단순화 + 네이버 API 구체화 (6차)
  - 사용자 피드백: "단순 정보 채우기 작업이라 파이프라인 분리 필요성 재검토 요청"
  - **LLM 3-Tier → 2-Tier 단순화**: Opus Critique 제거, Sonnet 메인 + Haiku 블로그 전처리만 유지
    - Haiku의 **정당한 분업 사례**: 네이버 블로그 20-30개 원문(3만자) → 정제 컨텍스트(2,000자) → Sonnet 토큰 85% 절감 + 품질 향상
    - Self-Critique는 선택적 (Sonnet 재호출)
    - 슬러그·태그 정제는 AI 대신 TypeScript 로직
  - **비용 & 규모별 가이드 표 신규**: 일 1-10건 / 10-100건 / 100-1,000건 / 1,000건+ 전략 분리
  - **파이프라인 분리의 숨은 비용** 섹션 추가 — 정당한 경우 vs 과잉 안티패턴
  - **#34 항목 단순화**: haiku → sonnet-4-6 교체, Opus 도입 제거, Self-Critique 선택화
  - **#45 B-1 검색 API 4개 엔드포인트 우선순위화**:
    - P0 블로그 / P1 카페글 / P2 지역 / P3 이미지
    - 각 엔드포인트별 파라미터·활용 파이프라인 명시
    - 업체 등록 Step 3.5 `fetchNaverReferences` 신설 설계 포함
  - [docs/네이버 검색 api/](docs/네이버%20검색%20api/) 4개 API 문서(blog/cafe/image/location) 검증 완료
- 2026-04-17 네이버 API 정정 (4.5차)
  - 사용자 피드백: 프로젝트에 연결된 네이버 API는 **검색 / 데이터랩 검색어트렌드 / 데이터랩 쇼핑인사이트 3종**. 지역검색 API는 없음
  - #45 B 섹션 재구성:
    - B-1. 검색 API 세부화 — 블로그·뉴스·카페·지식iN 엔드포인트별 활용 시나리오 명시
    - B-2. 데이터랩 검색어 트렌드 추가 — **키워드 랜딩 우선순위 자동화·계절성 콘텐츠**에 강력
    - B-3. 데이터랩 쇼핑인사이트 — 뷰티 카테고리 제한적 활용, 우선순위 낮음
  - "지역검색 API" 언급 전체 삭제
  - 작업 분해 항목도 B-1/B-2/B-3 세분화

---

## 참고

- 리뷰 원본: 2026-04-17 Claude 크롤링 리뷰 세션 + SEO/기술 리뷰
- 관련 파일 추정:
  - `content/businesses/*.ts` (업체 데이터)
  - `content/guides/*.ts` (가이드)
  - `components/layout/Footer.tsx`
  - `components/layout/Breadcrumb.tsx`
  - `components/business/Disclaimer.tsx` (신규)
  - `lib/format/{address,hours,price,rating}.ts` (신규 4개)
  - `lib/seo/{page-meta,schema/business}.ts` (중앙화)
  - `lib/site-stats.ts` (숫자 단일 소스)
  - `lib/constants/disclaimers.ts` (신규)
  - `app/[city]/[industry]/[slug]/page.tsx`
  - `app/sitemap.ts`
  - `public/robots.txt`, `public/llms.txt`
