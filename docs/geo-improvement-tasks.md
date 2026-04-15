# GEO 개선 태스크 문서

> 출처: GPT 리뷰 (docs/gpt리뷰.md) + Claude 리뷰 (docs/클로드리뷰.md)
> 작성일: 2026-04-15
> 브랜치: master

---

## Phase 1: 버그 수정 (즉시)

클로드 리뷰에서 발견된 실제 버그 + 빠른 개선 3건.
추천 로직보다 먼저 수정해야 GEO 손상 방지.
(llms.txt, robots.txt AI 봇 허용은 이미 구현 완료)

### 1-1. 메타 디스크립션 템플릿 오류 (10분)

**문제:** 모든 카테고리 리스팅 페이지에 의료업종 전용 문구 "진료 과목" 하드코딩.
웹에이전시/인테리어/미용실/자동차정비 페이지에서 의미 불일치.

**발생 위치:**
- `src/app/[city]/[category]/page.tsx:37` — meta description
- `src/app/[city]/[category]/page.tsx:114` — 본문 요약
- `src/app/page.tsx:48` — 홈페이지 FAQ (부분적)

**수정 방향:**
- 카테고리별 분기 처리 (의료: "진료 과목", 비의료: "서비스 분야")
- 또는 공통 표현으로 통일: "전문 분야, 위치, 리뷰 기반 정리"

**테스트:** 빌드 후 각 카테고리 페이지의 meta description 확인

---

### 1-2. 홈페이지 피부과 하드코딩 (30분)

**문제:** 홈페이지에서 피부과만 하드코딩으로 표시.
5개 카테고리 중 1개만 대표하는 구조. ItemList 스키마도 "천안 피부과 추천 업체"로 고정.
(참고: 카테고리 리스팅 페이지 간 교차 오염은 없음 — `getPlaces(city, category)` 필터링 정상)

**발생 위치:**
- `src/app/page.tsx:24` — `getPlaces("cheonan", "dermatology")` 하드코딩
- `src/app/page.tsx:65` — `generateItemList(recentPlaces, '천안 피부과 추천 업체')`

**수정 방향:**
- 홈페이지: `getAllPlaces()`로 전체 업체 표시하거나, 카테고리별 섹션 분리
- ItemList 스키마: 전체 업체 대상으로 변경

**테스트:** 홈페이지 HTML 소스에서 JSON-LD가 전체 업체를 포함하는지 확인

---

### 1-3. `<time>` 시맨틱 태그 적용 (10분)

**문제:** "최종 업데이트: 2026-04-16" 텍스트가 일반 `<p>` 태그.
AI 크롤러는 `<time datetime="">` 속성으로 콘텐츠 최신성을 기계적으로 판단.

**발생 위치:**
- `src/app/[city]/[category]/page.tsx:116` — 리스팅 페이지
- `src/app/[city]/[category]/[slug]/page.tsx:163` — 업체 상세 페이지
- `src/app/guide/[city]/[category]/page.tsx:97` — 가이드 페이지

**수정 방향:**
```tsx
<time dateTime="2026-04-16">최종 업데이트: 2026-04-16</time>
```

**테스트:** HTML 소스에서 `<time>` 태그 존재 확인

---

## Phase 2: 추천 로직 구현 (GPT 리뷰 핵심)

GPT 리뷰의 핵심 지적: "AI는 정보를 가져가지 않고 추천 가능한 구조를 가져간다."
현재 페이지는 정보 나열형 → AI 추천 플랫폼으로 전환.

### 2-1. Place 타입 + DB 마이그레이션 (기반) — 15분

**변경 파일:**
- `src/lib/types.ts` — Place 인터페이스 확장
- `src/lib/supabase-types.ts` — DB 타입 매핑 확장
- `supabase/migrations/007_recommendation_fields.sql` — 신규
- `src/lib/data.ts` — 시드 데이터 보강

**추가 필드:**
```typescript
interface Place {
  // ... 기존 필드
  recommendedFor?: string[]      // ["여드름 치료 필요한 환자", "건강보험 적용 원하는 분"]
  strengths?: string[]           // ["피부질환 중심 진료", "건강보험 적용 가능"]
  placeType?: string             // "질환치료형" | "미용시술형" | "프리미엄"
  recommendationNote?: string    // 40-60자 추천형 Direct Answer Block
}
```

**DB 마이그레이션:**
```sql
ALTER TABLE places
  ADD COLUMN recommended_for jsonb DEFAULT '[]',
  ADD COLUMN strengths jsonb DEFAULT '[]',
  ADD COLUMN place_type text,
  ADD COLUMN recommendation_note text;
```

**테스트:** supabase-schema.test.ts 확장

---

### 2-2. GuideSection 타입 확장 — 5분

**변경 파일:**
- `src/lib/types.ts` — GuideSection 인터페이스 확장

**추가 필드:**
```typescript
interface GuideSection {
  // ... 기존 필드 (heading, content, items)
  recommendedPlaces?: Array<{
    slug: string        // "soo-derm"
    name: string        // "수피부과의원"
    reason: string      // "피부질환 중심 진료, 건강보험 적용 가능"
  }>
}
```

---

### 2-3. Claude API 추천 데이터 생성 함수 — 20분

**변경 파일:**
- `src/lib/actions/register-place.ts` — `generateRecommendation()` 신규 함수

**설계:** 기존 `generatePlaceContent()`와 별도 함수로 분리 (eng review 결정).
동일한 Haiku 모델, 동일한 패턴.

**입력:** 업체명, 카테고리, 서비스 목록, Google 리뷰 요약
**출력:**
```json
{
  "recommendedFor": ["여드름/피부질환 치료 필요한 환자", "건강보험 적용 원하는 분"],
  "strengths": ["피부질환 중심 진료", "전문의 3명 상주", "건강보험 적용 가능"],
  "placeType": "질환치료형",
  "recommendationNote": "천안에서 여드름·피부질환 치료 전문 피부과를 찾는다면 추천되는 병원. 건강보험 적용 가능하고 기본 치료 비용이 합리적입니다."
}
```

**테스트:** recommendation.test.ts 신규 — Claude API 모킹 + 성공/실패/불완전 JSON 케이스

---

### 2-4. 기존 업체 데이터 일괄 보강 — 10분

**방법:** 일회성 스크립트 또는 시드 데이터 직접 수정
- 시드 데이터(data.ts)의 기존 업체에 추천 필드 추가
- Supabase에 이미 등록된 업체: Admin에서 재생성 버튼 또는 일괄 스크립트

---

### 2-5. 업체 상세 페이지 수정 — 30분

**변경 파일:**
- `src/app/[city]/[category]/[slug]/page.tsx`
- `src/lib/jsonld.ts` — `generateLocalBusiness()` 확장

**UI 추가 섹션:**
1. **추천 대상** — `place.recommendedFor` 렌더링 (리스트)
2. **핵심 강점** — `place.strengths` 렌더링 (리스트)
3. **업체 유형** — `place.placeType` 배지 표시
4. **Direct Answer Block** — `place.recommendationNote`로 교체 (H1 아래)

**JSON-LD 확장:**
```typescript
// generateLocalBusiness() 에 추가
if (place.strengths?.length) {
  jsonld.knowsAbout = place.strengths
}
if (place.recommendedFor?.length) {
  jsonld.additionalProperty = place.recommendedFor.map(r => ({
    '@type': 'PropertyValue',
    name: '추천 대상',
    value: r,
  }))
}
```

**테스트:** jsonld.test.ts 확장 — 추천 필드 포함/미포함 케이스

---

### 2-6. 가이드 페이지 추천 로직 추가 — 20분

**변경 파일:**
- `src/app/guide/[city]/[category]/page.tsx`
- `src/components/guide-section.tsx`
- `src/lib/data.ts` — 가이드 시드 데이터 수정

**수정 내용:**
- 가이드 섹션에 업체 딥링크 + 추천 이유 표시
- "한눈에 추천" 요약 블록 하단 추가
- 가이드 데이터의 sections에 `recommendedPlaces` 필드 채우기

**예시:**
```
### 여드름 / 피부질환
→ 수피부과의원
- 피부질환 중심 진료
- 건강보험 적용 가능
- 기본 치료 비용 합리적
[상세 보기 →](/cheonan/dermatology/soo-derm)
```

---

### 2-7. 업체 ↔ 콘텐츠 자동 양방향 링크 — 20분

**변경 파일:**
- `src/lib/data.supabase.ts` — `getGuidesForPlace()`, `getComparisonsForPlace()` 신규
- `src/app/[city]/[category]/[slug]/page.tsx` — 하단 "관련 콘텐츠" 섹션

**설계:** 빌드 시점에 역방향 조회. 수동 입력 없음.
```typescript
// data.supabase.ts
async function getGuidesForPlace(placeSlug: string): Promise<GuidePage[]> {
  // 가이드 데이터에서 이 업체를 참조하는 가이드 필터링
}
```

**렌더링:**
```
## 관련 콘텐츠
- 피부과 선택 가이드 (/guide/cheonan/dermatology)
- 여드름 치료 비교 (/compare/cheonan/dermatology/acne)
```

**테스트:** data-supabase.test.ts 확장

---

### 2-8. E-E-A-T 저자 프로필 시각화 — 15분

**출처:** Gemini 리뷰 — "스키마에 저자 정보는 있지만 실제 페이지에 보이지 않음"

**문제:** JSON-LD에 `author: { name: '이지수', jobTitle: 'AI Place 큐레이터' }`가
있지만, 페이지 HTML에는 저자가 전혀 표시되지 않음.
AI 크롤러는 JSON-LD + 본문 양쪽에 저자가 있을 때 E-E-A-T 신뢰도를 더 높게 평가.

**발생 위치:**
- `src/app/guide/[city]/[category]/page.tsx` — 가이드 페이지 (Article 스키마)
- `src/app/[city]/[category]/[slug]/page.tsx` — 업체 상세 페이지 (WebPage 스키마)
- `src/app/compare/[city]/[category]/[topic]/page.tsx` — 비교 페이지

**구현 방식:** 바이라인 + 저자 카드
- 글 상단(H1 아래 날짜 옆)에 바이라인: `작성자: 이지수 · AI Place 큐레이터`
- 글 하단에 저자 카드 컴포넌트 (이름, 직함, 한 줄 소개, /about 링크)
- `/about` 페이지에 Person 스키마 독립 페이지 생성
- JSON-LD author URL을 `/about` 페이지로 연결 → 엔티티 강화

**변경 파일:**
- `src/components/author-card.tsx` — 신규 컴포넌트
- `src/app/guide/[city]/[category]/page.tsx` — 바이라인 + 카드 추가
- `src/app/[city]/[category]/[slug]/page.tsx` — 바이라인 추가
- `src/app/compare/[city]/[category]/[topic]/page.tsx` — 바이라인 추가
- `src/app/about/page.tsx` — 신규 (저자 프로필 + Person 스키마)
- `src/lib/jsonld.ts` — author URL을 `/about`으로 변경

**테스트:** 빌드 후 HTML에 저자 텍스트 + /about 페이지 Person 스키마 확인

---

## Phase 3: 추가 개선 (후순위)

### ~~3-1. AI Place 서비스 FAQ 분리~~ — 불필요

~~홈페이지 FAQ와 카테고리 FAQ 혼재 문제~~
→ 코드 확인 결과, `getCategoryFaqs()`가 카테고리별로 정확히 분리됨.
  서비스 FAQ(홈페이지)와 카테고리 FAQ(리스팅 페이지)는 이미 별도 관리. **수정 불필요.**

### 3-2. og:image 자동 생성 (2시간)

카테고리별 OG 이미지 자동 생성. `@vercel/og` 또는 사전 생성.
SNS 공유 클릭률 향상.

---

## 참조: 리뷰 매핑

| 태스크 | 출처 | GPT | Claude | Gemini |
|--------|------|-----|--------|--------|
| 1-1 메타 디스크립션 | Claude #1 | — | 즉시 수정 | — |
| 1-2 크로스 카테고리 | Claude #2 | — | 구조적 문제 | — |
| 1-3 time 태그 | Claude #4 | — | 10분 | — |
| ~~1-4 llms.txt~~ | — | — | — | 이미 존재 |
| 2-1 타입+마이그레이션 | GPT+Claude | 필수 | — | — |
| 2-2 GuideSection | eng review | — | — | — |
| 2-3 AI 생성 함수 | GPT | 필수 | — | — |
| 2-4 데이터 보강 | GPT | 필수 | — | — |
| 2-5 상세 페이지 | GPT+Claude | 추천 대상/강점/비교 | DAB 강화 | 키워드 심화 |
| 2-6 가이드 페이지 | GPT | 추천 이유 추가 | — | — |
| 2-7 양방향 링크 | eng review | — | — | — |
| 2-8 저자 프로필 | Gemini | — | — | E-E-A-T 시각화 |
| ~~3-1 FAQ 분리~~ | — | — | — | 이미 분리됨 |
| 3-2 og:image | Claude #6 | — | 2시간 | — |

---

## 예상 소요 시간

| Phase | 항목 수 | CC 예상 | 비고 |
|-------|--------|---------|------|
| Phase 1 | 3건 | ~20분 | 버그 수정 + 빠른 개선 |
| Phase 2 | 8건 | ~2.5시간 | 추천 로직 + E-E-A-T 강화 |
| Phase 3 | 1건 | ~2시간 | 후순위, 별도 세션 |
