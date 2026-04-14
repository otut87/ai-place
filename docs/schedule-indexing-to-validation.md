# AI Place — 인덱싱 ~ 검증 스케줄

> 작성일: 2026-04-15
> 배포일: 2026-04-14
> 검증 완료 목표: 2026-05-12 (4주)

---

## 현재 상태 (2026-04-15 업데이트)

- aiplace.kr 라이브 (**25 SSG 페이지** — 키워드 8개 포함)
- 실존 업체 5곳 (AI 베이스라인 미노출 타겟)
- sameAs URL 전부 실제 검증 완료 (네이버/카카오맵)
- IndexNow 제출 완료 (20 URL, 200 OK)
- Google/Bing/Naver 등록 + sitemap 제출 + GSC 수동 색인 요청
- GA4 (G-N4BFWL3G7Z) + AI referrer 추적 + 전화 클릭 이벤트 활성화
- 베이스라인: ChatGPT 45건 + Claude 45건 = 90건 (AI Place 인용 0건)
- Gemini 베이스라인: 일일 한도(20회) 소진으로 **내일 재측정 필요**

### 오늘 (4/15) 완료한 것
- [x] Google Search Console에서 20개 URL 수동 색인 요청
- [x] sameAs URL 실제 검증 (5곳 전부 네이버/카카오 URL 교체)
- [x] Bing Webmaster에서 sitemap 재제출 확인
- [x] Gemini 모델 gemini-2.0-flash → gemini-2.5-flash 업데이트
- [x] Gemini rate limit 재시도 로직 추가 (15s 딜레이)
- [x] phone_click 이벤트에 referrer 추가 (B→C 전환 추적)
- [x] Footer 404 링크 수정 (/cheonan, /compare/.../acne)
- [x] manifest.webmanifest + icon.svg + apple-touch-icon 추가
- [x] P0: Article author Person schema (E-E-A-T)
- [x] P1: 키워드 랜딩 페이지 8개 배포 + IndexNow 재제출

---

## Week 1 (4/15 ~ 4/21) — 잔여 개발 작업

### 내일 (4/16)
- [ ] Gemini 베이스라인 측정 (`npx tsx scripts/baseline-test.ts --engine=gemini --repeat=1`)
- [ ] Google Places API 연동 시작
  - Google Cloud Console에서 Places API 활성화
  - `googlePlaceId` 필드 + `ReviewSummary` 타입 추가
  - Place Details API로 rating, reviews 가져오기
  - 프로필 페이지에 리뷰 섹션 + Review schema 추가
  - `PlaceImage` 타입 추가 (이미지 alt 구조화 준비)

### 4/17 ~ 4/18
- [ ] P3: Supabase 스키마 설계 (마이그레이션 SQL)
- [ ] P3: data.supabase.ts 초안 (data.ts와 동일 시그니처)
- [ ] P3: 시드 스크립트 (data.ts → Supabase 이관)

### 금요일 (4/18)
- [ ] Bing Webmaster에서 인덱싱 상태 확인
- [ ] Google Search Console에서 크롤링 상태 확인
- [ ] Perplexity에서 "천안 피부과 추천" 수동 검색 (현황 체크)

---

## Week 2 (4/22 ~ 4/28) — 1차 중간 측정

### 월요일 (4/22)
- [ ] 베이스라인 재측정 (1차)
  ```bash
  set -a && source .env.local && set +a
  npx tsx scripts/baseline-test.ts --engine=chatgpt --repeat=3
  npx tsx scripts/baseline-test.ts --engine=claude --repeat=3
  npx tsx scripts/baseline-test.ts --engine=gemini --repeat=1
  ```
- [ ] 결과 비교: Before (4/14) vs After (4/22)
- [ ] Bing Webmaster AI Performance 탭 확인
- [ ] GA4 AI referrer 트래픽 확인

### 판단 기준 (1차)
| 결과 | 의사결정 |
|------|----------|
| AI Place 1회+ 인용 | 긍정 신호 — 2차 측정까지 대기 |
| 인용 0건, 인덱싱 완료 | 콘텐츠 보강 검토 (업체 추가, 키워드 페이지 확장) |
| 인덱싱 미완료 | 1주 추가 대기 |

### 개발 작업 (조건부)
- [ ] 인덱싱 확인되면: 측정 프로토콜 문서화 + 자동화 개선
- [ ] 인용 0건이면: 콘텐츠 볼륨 확장 (업체 10-15곳 추가)

---

## Week 3 (4/29 ~ 5/5) — 2차 측정

### 월요일 (4/29)
- [ ] 베이스라인 재측정 (2차)
- [ ] GA4 AI referrer 트래픽 확인
- [ ] 전화 클릭 이벤트 확인

### 판단 기준 (2차)
| 결과 | 의사결정 |
|------|----------|
| AI Place 3회+ 인용 | GEO 검증 성공 — Phase 3 본격 진행 |
| AI Place 1-2회 인용 | 부분 성공 — 콘텐츠 강화 후 3차 측정 |
| 인용 0건 | 가설 수정 필요 — 콘텐츠 30곳 확장 + FAQ 품질 강화 |

---

## Week 4 (5/6 ~ 5/12) — 최종 판단

### 월요일 (5/12)
- [ ] 베이스라인 재측정 (최종)
- [ ] 전체 결과 정리: Before (4/14) → 1차 (4/22) → 2차 (4/29) → 최종 (5/12)

### 최종 판단 기준
| 조건 | 의사결정 |
|------|----------|
| **KR1 달성**: 인용률 10%+ (90건 중 9건+) | Phase 3 즉시 착수 + 전국 확장 계획 |
| **KR2 달성**: 특정 쿼리에서 반복 인용 | Phase 3 + 해당 쿼리 중심 콘텐츠 강화 |
| **미달성**: 4주간 0건 | 가설 피봇 — 콘텐츠 양 30곳+, 2개 카테고리, 4주 추가 관찰 |

---

## 측정 프로토콜

### 쿼리 세트 (Supabase test_prompts 테이블에 저장됨)
- 천안 피부과 추천해줘
- 천안에서 여드름 치료 잘하는 피부과
- 천안 보톡스 잘하는 곳
- 천안 야간진료 피부과
- 천안 기미 치료 피부과 추천
- (등 15개 프롬프트)

### 엔진
- ChatGPT (gpt-4o-search-preview)
- Claude (claude-sonnet)
- Gemini (gemini-2.5-flash + google_search grounding) — 무료 20회/일

### 반복
- ChatGPT/Claude: 프롬프트당 3회
- Gemini: 프롬프트당 1회 (일일 한도 20회)

### 기록
- Supabase citation_results 테이블에 자동 저장
- response 전문, cited_sources (URL), cited_places (업체명), aiplace_cited (boolean)

### 실행 명령
```bash
cd c:/dev/ai-place
set -a && source .env.local && set +a
npx tsx scripts/baseline-test.ts --engine=chatgpt --repeat=3
npx tsx scripts/baseline-test.ts --engine=claude --repeat=3
npx tsx scripts/baseline-test.ts --engine=gemini --repeat=1
```

---

## Google Places API 연동 계획

### 목적
현재 수동 입력된 rating/reviewCount를 Google 공식 데이터로 보강.
리뷰 요약을 구조화하여 AI가 인용할 수 있는 형태로 제공.
사진 데이터로 프로필 페이지 이미지 확보.

### 구현 범위
1. Google Cloud Console에서 Places API (New) 활성화
2. `src/lib/google-places.ts` — Place Details API 호출
   - place_id로 rating, userRatingCount, reviews 가져오기
   - reviews에서 긍정/부정 테마 추출 (수동 or Claude API)
3. `ReviewSummary` 타입 추가 (types.ts)
   ```typescript
   export interface ReviewSummary {
     source: string            // "Google"
     positiveThemes: string[]  // ["친절한 상담", "대기시간 짧음"]
     negativeThemes: string[]  // ["주차 불편"]
     sampleQuote?: string      // 패러프레이즈 (저작권 주의)
     lastChecked: string
   }
   ```
4. `PlaceImage` 타입 추가 (types.ts)
   ```typescript
   export interface PlaceImage {
     url: string
     alt: string               // "천안 피부과 닥터에버스의원 진료실 내부"
     type: 'exterior' | 'interior' | 'treatment' | 'staff' | 'equipment'
   }
   ```
5. 프로필 페이지에 리뷰 요약 섹션 + Review JSON-LD schema
6. Place type에 `googlePlaceId?: string`, `images?: PlaceImage[]` 필드 추가

### 비용
- Places API (New): 월 $200 무료 크레딧
- Place Details (Basic): $0.017/요청
- Place Photos: $0.007/요청
- 5곳 × 월 4회 갱신 = 20요청/월 ≈ $0.34
- 5곳 × 5장 사진 = 25요청 ≈ $0.18

### 주의사항
- 리뷰 텍스트 직접 복사 금지 (Google ToS) → 패러프레이즈
- 한국 로컬 데이터가 부실할 수 있음 (네이버 대비)
- rate limit: 초당 10 QPS

---

## 전환 추적 (C 검증)

### GA4 이벤트
| 이벤트 | 트리거 | 파라미터 |
|--------|--------|----------|
| `ai_referral` | AI 사이트에서 유입 시 (자동) | ai_source, referrer_url, landing_page |
| `phone_click` | 전화하기 버튼 클릭 | business_name, page_path, referrer |

### AI referrer 감지 도메인
chatgpt.com, chat.openai.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com

### GA4 확인 방법
1. GA4 → 실시간 → 이벤트 확인
2. GA4 → 탐색 보고서 → 세션 소스/매체 필터: perplexity.ai, chatgpt.com

---

## 파일 참조

| 파일 | 용도 |
|------|------|
| `scripts/baseline-test.ts` | AI 베이스라인 측정 (ChatGPT/Claude/Gemini) |
| `scripts/indexnow.ts` | IndexNow URL 제출 (20개 URL) |
| `scripts/seed-places.ts` | Supabase 시드 데이터 |
| `docs/GEO-SEO-AEO-딥리서치.md` | GEO 전략 리서치 |
| `supabase/migrations/001_initial_schema.sql` | DB 스키마 |
| `src/components/analytics.tsx` | GA4 + AI referrer + phone_click |
| `src/components/phone-button.tsx` | 전화 클릭 추적 버튼 |
| `public/llms.txt` | LLM용 사이트 가이드 |
