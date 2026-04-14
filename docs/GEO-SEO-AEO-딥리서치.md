# GEO · SEO · AEO 딥 리서치 리포트

> **작성일:** 2026-04-14
> **작성자:** 이지수 + Claude (Cowork)
> **목적:** AI플레이스 프로젝트의 AI 검색 최적화 전략 수립
> **구성:** 1부 범용 리서치 / 2부 AI플레이스 프로젝트 적용
> **분량:** 본문 약 20p + 부록

---

## TL;DR

1. **SEO는 여전히 필요조건이다.** 2025년 SeoClarity 연구에 따르면 Google AI Overviews 인용 소스의 **99.5%가 구글 상위 10위 이내 페이지**에서 나온다. GEO는 SEO를 대체하지 않고 위에 얹는 레이어다.
2. **AI 플랫폼별 인용 메커니즘이 다르다.** ChatGPT는 Bing 인덱스의 87%와 매칭되고, Perplexity는 Reddit(46.7%)과 신선도(Freshness)를 압도적으로 선호하며, Google AI Overviews는 FastSearch + query fan-out을 쓴다. 하나의 최적화 전략으로 셋을 동시에 만족시키기 어렵다.
3. **Princeton KDD 2024 논문의 검증된 레버 3가지:** ① 출처 인용(Cite Sources) ② 관련 인용구(Quotations) ③ 통계 수치(Statistics) 추가. 세 기법이 **GEO visibility를 최대 40% 향상**시킨다.
4. **FAQ Schema는 GEO의 가성비 최강 레버다.** 여러 독립 연구에서 FAQPage schema 적용 페이지가 미적용 대비 **2.7~3.2배 높은 인용률**을 보였다.
5. **llms.txt는 "표준 아닌 제안"이다.** Anthropic·Cloudflare·Vercel이 배포 중이지만, Claude가 실제로 이를 참조하는지는 공개적으로 확인되지 않았다. 현 단계에서는 **robots.txt 허용 + SSG HTML + Schema.org**가 본진이고, llms.txt는 저비용 보너스.
6. **한국 특수성:** 네이버가 네이버블로그·카페·지식인의 AI 크롤러 접근을 제한해온 탓에 한국 로컬 데이터 공백이 존재한다. 이 공백을 메우는 것이 AI플레이스의 핵심 가치 제안이며, 동시에 **Bing Places + Google Business Profile 세팅이 한국 로컬의 가장 저평가된 레버**다.

---

# 1부 · GEO · SEO · AEO 범용 가이드

## 1. 세 가지 최적화의 정의와 차이

| 구분 | 타깃 | 최적화 단위 | 성공 지표 | 대표 플랫폼 |
|---|---|---|---|---|
| **SEO** (Search Engine Optimization) | 전통 검색 결과 페이지 랭킹 | 문서 단위 (page-level) — 백링크·도메인 권위·키워드·CWV | 상위 10위 랭킹, CTR, 세션 | Google, Bing, Naver |
| **AEO** (Answer Engine Optimization) | Featured Snippet, Voice, People Also Ask | 문장·단락 단위 (sentence-level) — answer density, NLP clarity | 스니펫 점유, 음성 답변 선택 | Google, Siri, Alexa |
| **GEO** (Generative Engine Optimization) | LLM 생성형 답변 내 인용 | 인용 가능성 (citation-ready) — 통계·인용구·권위 시그널 | 답변 내 인용 횟수/포지션 | ChatGPT, Perplexity, Claude, Gemini |

### 1.1 왜 세 가지를 분리해야 하는가

세 최적화는 목적 함수가 다르다. SEO는 "클릭을 받기 위한 랭킹"을 목표로 하고, AEO는 "클릭 없이도 답이 되기 위한 구조"를 지향하며, GEO는 "LLM이 답을 합성할 때 근거로 삼을 만한 신뢰도"를 추구한다. 그러나 **실무에서는 동심원**이다. GEO의 전제조건은 AEO이고, AEO의 전제조건은 SEO다. 이 순서를 거꾸로 가면 비용 대비 효과가 급락한다.

- 2025년 SeoClarity 연구: Google AI Overviews 인용 소스의 **99.5%가 구글 상위 10위 이내**[^1]
- SearchGPT(ChatGPT Search) 인용의 **87%가 Bing 상위 결과와 매칭**, 대부분 상위 10위 이내[^2]
- Perplexity만 예외적으로 구글 상위와 상관관계가 약하며, 대신 **자체 retrieval + 신선도 가중치**를 강하게 쓴다[^3]

### 1.2 통합 프레임워크 — "3-Layer Funnel"

```
Layer 1 (기초): SEO
  ├─ robots.txt, sitemap.xml
  ├─ SSR/SSG (JS 미실행 봇 대비)
  ├─ 도메인 권위 (백링크, 브랜드 멘션)
  └─ CWV (LCP, INP, CLS)

Layer 2 (구조): AEO
  ├─ Schema.org JSON-LD (LocalBusiness, FAQ, Review…)
  ├─ Direct Answer Blocks (H2/H3 직하 40~60자)
  ├─ FAQ — 실제 검색어 형태의 Q&A
  └─ H1/H2/H3 의미 구조

Layer 3 (인용): GEO
  ├─ 통계·수치·출처 인용 (Princeton 논문 검증 레버)
  ├─ E-E-A-T — 저자 바이라인, 자격, 실명
  ├─ Freshness — 최근 90일 갱신 (Perplexity 특히)
  ├─ Multi-platform 존재감 (Reddit, LinkedIn, YouTube)
  └─ llms.txt (저비용 보너스)
```

---

## 2. 학술 근거 — Princeton GEO 논문 (KDD 2024)

### 2.1 연구 개요

2024년 8월 바르셀로나 KDD 2024에서 발표된 *"GEO: Generative Engine Optimization"* (Aggarwal et al., Princeton·Georgia Tech·Allen AI·IIT Delhi)[^4]는 GEO 분야의 가장 권위 있는 peer-reviewed 연구다. 이 논문은:

- **GEO-bench** — 9개 데이터셋에서 추출한 10,000개의 다양한 유저 쿼리 벤치마크를 공개
- **9가지 최적화 기법**을 LLM 응답에서의 visibility(Position-Adjusted Word Count)·주관적 인상(Subjective Impression) 기준으로 정량 평가
- **상위 3개 기법이 relative 40% 수준의 visibility 개선**을 재현 가능한 방법으로 달성

### 2.2 검증된 상위 3개 레버

논문에서 통계적으로 유의미한 효과가 확인된 기법:

1. **Cite Sources** (출처 인용 추가): 권위 있는 외부 링크·참고문헌을 본문에 삽입
2. **Quotation Addition** (인용구 추가): 업계 전문가·연구 기관의 직접 인용문 삽입
3. **Statistics Addition** (통계 수치 추가): 구체적 수치·퍼센트·조사 결과 삽입

세 기법 모두 **Position-Adjusted Word Count 기준 30~40%, Subjective Impression 기준 15~30%의 relative 개선**을 보였다.

### 2.3 효과가 미미하거나 역효과인 기법

- **키워드 스터핑** — 효과 거의 없음
- **유창성 개선(Fluency Optimization)** — 일부 카테고리에서 오히려 역효과
- **과도한 authoritative tone** — 특정 쿼리 유형에서만 효과

### 2.4 해석 시 주의

- 논문은 **단일 응답 내 visibility**를 측정한 것이지, "동일 쿼리에서 인용되는 빈도"나 "여러 세션에 걸친 반복 인용"을 측정한 게 아니다.
- LLM 업데이트에 따라 결과가 변동할 수 있다 — 2024년 결과가 2026년에도 동일하다는 보장은 없다.
- 그럼에도 **"통계·인용·출처 3종 세트"는 현재까지 학술적으로 검증된 유일한 GEO 레버**다.

---

## 3. AI 플랫폼별 인용 메커니즘

### 3.1 ChatGPT (SearchGPT / ChatGPT Search)

**인덱스 소스:** Bing API 직접 호출. 별도의 크롤러 인덱스를 구축하지 않고 OpenAI는 OAI-SearchBot으로 보조 크롤링을 수행한다.

**메커니즘:**
- 쿼리를 Bing에 전송 → 상위 20~30개 결과 회수 → 자체 랭킹 로직으로 3~6개 인용 선정[^2]
- Seer Interactive 분석: **SearchGPT 인용의 87%가 Bing 상위 결과와 매칭**[^2]
- 가중치 대략: **Domain Authority 40% · Content Quality 35% · Platform Trust 25%**[^5]

**선호 소스:**
- Wikipedia가 가장 강한 preference
- Reddit은 변동성이 큼 (2025년 8월 60% → 9월 10%로 급락한 사례)[^6]
- News 사이트, G2/Trustpilot/Yelp 등 리뷰 플랫폼 강세

**신선도:** 최근 **90일 내 갱신된 페이지가 그보다 오래된 페이지 대비 2.3배 많은 인용**을 받음[^2]

**한국 로컬 특이점:** ChatGPT의 로컬 검색은 **Bing Places + Google Business Profile**을 기반으로 한다. Bing Places에 등록되지 않은 한국 로컬 사업체는 사실상 ChatGPT에서 불가시 상태.[^7]

### 3.2 Perplexity

**인덱스 소스:** 자체 retrieval 시스템 + 실시간 웹 검색. PerplexityBot이 on-demand로 페이지를 fetch하는 구조라 반영 속도가 빠르다.

**메커니즘:**
- 쿼리 수신 → 실시간 검색 → 관련 문서 스코어링 → 3~10개 출처 인용 (답변과 함께 번호로 표시)
- **신선도가 Domain Authority를 이기는 유일한 엔진** — 1주 전 포스트가 2년 전 DA 90 포스트를 이긴다[^8]
- Reddit 의존도가 압도적: **탑 10 인용의 46.7%가 Reddit**[^9]

**선호 콘텐츠 유형:**
- 원본 데이터(primary research), 자체 조사, 벤치마크 리포트 — 첫 두 단락에 인용되는 경향
- LinkedIn 포스트 (CEO/창업자 글) — 다른 엔진과 차별적
- 비교 가이드(comparison articles), 전문가 의견 (자격 명시 시)

**약점:** 동일 쿼리 10회 실행 시 인용 소스가 매번 달라질 수 있을 정도로 비결정적. A/B 테스트 시 최소 n=5~10회 반복 호출 후 집계 필요.

### 3.3 Google AI Overviews (이전 SGE)

**인덱스 소스:** Google 자체 인덱스 + 최신 쿼리는 **FastSearch + Query Fan-out** (하나의 유저 질문을 여러 서브쿼리로 분해해 병렬 검색)[^10]

**메커니즘:**
- 상위 10개 유기적 결과가 거의 전부 인용 풀 — **99.5%가 top 10 organic에서 추출**[^1]
- Wikipedia + YouTube 가장 많이 인용
- 40~61%의 AI Overview가 **리스트 형식(bullet/ol)** 콘텐츠를 재구성[^11]

**강한 신호:**
- Semantic completeness (correlation r=0.87)
- Multi-modal content (이미지+텍스트+동영상) → **+156% selection rate**
- Structured data markup → **+73% selection rate**[^11]
- Schema의 `SameAs`와 `MainEntityOfPage`로 Google Knowledge Graph의 엔티티와 연결

**CTR 영향:** AI Overviews 등장 이후 **유기적 클릭률이 61% 감소**한 사례가 보고됨 (zero-click search 시대)[^11]

### 3.4 Claude (Anthropic)

**3개의 분리된 크롤러 (2026년 2월 문서 업데이트):**[^12][^13]

| 봇 | 용도 | 차단 시 영향 |
|---|---|---|
| `ClaudeBot` | 모델 학습용 웹 콘텐츠 수집 | 향후 Claude 모델 학습에서 제외 |
| `Claude-User` | 유저가 쿼리할 때 on-demand fetch | 유저가 "이 사이트 요약해줘"해도 접근 불가 |
| `Claude-SearchBot` | Claude 내장 검색 품질 개선 | 검색 답변 인용에서 제외 |

**선호 콘텐츠:**
- FAQ 구조와 Q&A 형식 특히 선호
- 권위 있는 도메인 우선 (Wikipedia, 정부·교육기관)
- 코드·기술 문서에서 Anthropic 공식 docs.anthropic.com 자기인용 빈도 높음

**주의:** `User-agent: *`로 차단하거나 레거시 설정에 Claude-User/Claude-SearchBot을 Disallow하면 **사용자 쿼리 답변에서 완전히 배제된다**. "학습은 거부, 검색 응답은 허용" 같은 granular 설정이 2026년부터 공식 지원.

### 3.5 플랫폼 비교 요약표

| 차원 | ChatGPT | Perplexity | Google AIO | Claude |
|---|---|---|---|---|
| **인덱스 기반** | Bing | 자체+실시간 | Google 자체 | 자체 크롤링 |
| **반영 속도** | 즉시~수일 | 즉시 | 2~4주 | 2~4주 |
| **신선도 가중치** | 중 (90일 기준) | 매우 높음 | 중 | 중 |
| **Reddit 선호** | 변동 큼 | 매우 높음 (46.7%) | 높음 (21%) | 낮음 |
| **Wikipedia 선호** | 높음 | 중 | 매우 높음 | 매우 높음 |
| **구조화 데이터** | 간접 | 간접 | 직접 (+73%) | 간접 |
| **FAQ 스키마 효과** | 중 | 중 | 높음 | 매우 높음 |
| **로컬 비즈니스** | Bing Places 필수 | 상대적으로 약함 | GBP 필수 | 약함 |

---

## 4. 공통 인용 성공 요인

### 4.1 E-E-A-T — 권위와 신뢰

Google이 2022년 도입한 E-E-A-T(Experience, Expertise, Authoritativeness, Trustworthiness)는 **2026년 현재 AI 엔진 공통의 인용 품질 필터**로 확장되었다.[^14]

실무적 구현:
- **저자 바이라인 필수** — 본문 상단 또는 하단에 실명·직책·이력 명시
- **Author schema** — `Person` 타입으로 별도 페이지 운영, `sameAs`로 LinkedIn·공식 프로필 연결
- **"Proof of Work"** — 수상·인증·소속 학회 명시, AI 생성 페르소나와 구별 가능하게
- **외부 언급(mentions)** — 본인 사이트 밖에서의 브랜드·이름 언급이 강한 신호

BrightEdge 연구에 따르면 **E-E-A-T 시그널이 강한 콘텐츠는 AI 검색 인용률이 평균 40% 이상 높다**.[^14]

### 4.2 Freshness — 신선도

- ChatGPT: 최근 90일 내 갱신 페이지가 **2.3배 많은 인용**[^2]
- Perplexity: 신선도가 Domain Authority를 override하는 유일한 엔진[^8]
- Google AI Overviews: "Last Updated" 타임스탬프를 페이지에 명시하면 인용 확률 상승
- 실무 패턴: **분기별 사업체 정보·FAQ 답변·통계 수치 갱신** 루틴화

### 4.3 구조화 데이터 (Schema.org)

여러 2025년 연구의 일관된 결론:

| 지표 | 수치 | 출처 |
|---|---|---|
| FAQ Schema → Google AI Overviews 인용 | **3.2배 증가** | WPRiders[^15] |
| FAQ Schema 미적용 vs 적용 | 15% → 41% (2.7배) | Relixir 50-site study[^16] |
| FAQ Schema → 평균 인용 리프트 | +28% | 스키마 유형 비교 연구[^16] |
| 구조화 데이터 전반 → AI 인용 | +44% | BrightEdge[^17] |
| Schema markup → AI Overview selection | +73% | SeoClarity[^11] |

**효과가 큰 schema 유형:**
1. `FAQPage` — 모든 엔진에서 효과
2. `LocalBusiness` 하위 타입 (`Dentist`, `Restaurant` 등) — 로컬 검색 필수
3. `Review` + `AggregateRating` — ChatGPT의 리뷰 플랫폼 인용 보완
4. `Article` + `Person`(author) — E-E-A-T 시그널
5. `BreadcrumbList` — 페이지 계층 명확화

### 4.4 Direct Answer Blocks (AEO의 핵심)

**정의:** H2/H3 직하 **40~60자 길이의 자기완결 단락**. 주변 문맥을 읽지 않아도 질문에 답이 되는 형태.

```
❌ BAD:
## 진료 안내
안녕하세요, 스마일치과입니다. 저희는 2010년에 개원하여 지금까지...

✅ GOOD:
## 천안에서 임플란트 비용은 얼마인가요?
천안 지역 치과의 임플란트 비용은 1개 기준 80만원~150만원이며,
뼈이식 여부와 재료(지르코니아/메탈)에 따라 달라집니다.
```

AEO 연구에 따르면 Direct Answer Block 삽입은 **단일 레버로는 인용률 상승에 가장 큰 기여**를 한다.[^18]

### 4.5 Multi-Platform 존재감

2026년 Otterly 연구(100만+ 데이터 포인트):[^19]
- **4개 이상 플랫폼에 존재하는 브랜드**가 ChatGPT 인용될 확률이 **2.8배**
- 핵심 플랫폼: Reddit, LinkedIn, YouTube, Wikipedia, Medium, GitHub
- **"같은 브랜드명/슬러그로 일관되게 등장"**하는 것이 핵심 (entity consistency)

### 4.6 Conversion 관점

블로그/플랫폼 트래픽을 고려할 때 주목할 만한 데이터:
- **AI-referred 트래픽의 전환율이 유기 검색 대비 4.4배**[^20]
- AI-referred 세션 **2025년 1~5월 사이 527% 증가**[^17]
- 즉 "인용은 양은 적지만 질이 월등히 높다" — Intent가 더 구체적인 유저

---

## 5. 기술 표준과 구현

### 5.1 robots.txt — AI 크롤러 허용 전략

2026년 기준 공식 문서화된 주요 AI 크롤러 User-agent:

```txt
# 학습용 크롤러 (선택적)
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: CCBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Applebot-Extended
Allow: /

# 검색·답변용 크롤러 (필수 허용 권장)
User-agent: OAI-SearchBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

Sitemap: https://example.com/sitemap.xml
```

**전략 권고:**
- "학습은 허용, 검색은 허용"이 기본
- 민감한 콘텐츠 또는 유료 콘텐츠만 선택적으로 학습 봇 차단 (GPTBot, ClaudeBot, Google-Extended)
- **검색·답변 봇(OAI-SearchBot, PerplexityBot, Claude-User, Claude-SearchBot)을 차단하면 인용 풀에서 완전 제외**되므로 주의[^12]
- **레거시 `User-agent: *` 광범위 차단이 의도치 않게 AI 봇을 배제**하는 케이스가 많음 — 반드시 audit

### 5.2 llms.txt — 표준 아닌 제안

**정체:** Jeremy Howard(Answer.AI)가 2024년 제안한 비공식 사양. `/llms.txt` 경로에 사이트의 핵심 페이지를 Markdown 형식으로 curation.[^21]

**채택 현황 (2026년 4월):**
- Anthropic, Cloudflare, Stripe, Vercel, Mintlify 등 공식 배포
- Anthropic은 `llms.txt`(8,364 토큰)와 `llms-full.txt`(481,349 토큰) 두 버전 제공
- **Anthropic 조차도 Claude가 실제 llms.txt를 참조하는지 공식 확인하지 않음**[^22]

**결론:**
- 저비용 고가시성(커뮤니티에서 "표준 지지자"로 보일 수 있음) = 상대적 ROI
- 기술 문서·API 레퍼런스가 있는 사이트에만 명확한 효용
- 로컬 비즈니스 디렉터리에서는 **LocalBusiness schema가 더 강한 실효성**

### 5.3 Schema.org JSON-LD 구현 원칙

Google 공식 가이드라인:[^23]

1. **JSON-LD 형식 권장** — Microdata나 RDFa보다 Google 선호
2. **`<script type="application/ld+json">`** 태그로 `<head>` 또는 `<body>` 삽입
3. **시각적 콘텐츠와 일치 필수** — JSON-LD에 있지만 페이지에 없는 정보는 위반
4. **가장 구체적인 subtype 사용** — `LocalBusiness`보다 `Dentist`, `Restaurant`
5. **실시간 동기화** — 가격·영업시간 변경 시 즉시 반영
6. **Google Rich Results Test**로 검증 필수

**2026년 최신 — Schema 3.0 / Entity Linking:**
- `sameAs` 속성으로 Wikipedia, Wikidata, LinkedIn 등 외부 엔티티와 연결
- `mainEntityOfPage`로 페이지의 주 엔티티 명시
- Google Knowledge Graph의 엔티티와 매칭되는 것이 **AI 엔진 인용의 전제조건으로 작동**[^11]

### 5.4 IndexNow — Bing/Yandex/Naver 실시간 인덱싱

**원리:** 콘텐츠 추가/수정/삭제 시 검색엔진에 POST 요청으로 즉시 알림. 크롤러가 페이지를 "발견"할 때까지 기다릴 필요 없음.[^24]

**2026년 지원 엔진:**
- ✅ Microsoft Bing, Yandex, **Naver**, Seznam, Yep
- ❌ **Google은 2021년부터 테스트만 하고 미채택**

**구현:**
1. 32자 alphanumeric API 키 생성
2. `/{key}.txt` 경로에 키 파일 호스팅
3. 페이지 변경 시 `POST https://api.indexnow.org/IndexNow`에 JSON으로 URL 리스트 전송
4. 일일 5B+ URL 전송 수준의 성숙한 프로토콜 (2026년 기준)

**ChatGPT Search가 Bing 인덱스 기반이므로 IndexNow는 GEO의 핵심 인프라**다. Google의 경우 Google Search Console의 URL Inspection tool로 대체.

### 5.5 SSR/SSG 필수성

AI 크롤러의 JavaScript 실행 여부:

| 크롤러 | JS 실행 | SPA 콘텐츠 인덱싱 |
|---|---|---|
| GPTBot | ❌ | 불가 |
| PerplexityBot | ❌ | 불가 |
| ClaudeBot | ❌ | 불가 |
| Google-Extended | ⚠️ 부분 | 제한적 |
| OAI-SearchBot | ⚠️ 부분 | 제한적 |
| NaverBot | ❌ | 불가 |

결론: **SSG(Static Site Generation) 또는 SSR(Server-Side Rendering)이 필수.** Client-Side Rendering만으로는 AI 인용 풀에 진입 자체가 불가능하다. Next.js App Router, Astro, Remix 등이 적합하고, React SPA·Vue SPA는 부적합.

---

## 6. 한국 시장 특수성

### 6.1 검색 엔진 시장 점유율 (2026)

| 엔진 | 점유율 | 비고 |
|---|---|---|
| Naver | ~46.5% | 로컬 검색(네이버 플레이스) 압도적 |
| Google | ~46.0% | 글로벌 유저·젊은 세대 강세 |
| Daum(Kakao) | ~3% | 감소 추세 |
| Bing | ~1% | 절대 규모 작지만 **ChatGPT의 배후라 중요성 급부상** |

Naver와 Google이 거의 동률을 이룬 구간이 2025년 이후 지속되고 있다.[^25]

### 6.2 네이버의 AI 크롤러 차단 이슈

- 네이버 블로그·카페·지식인은 **대부분의 AI 크롤러를 robots.txt로 차단**한 이력이 있음
- 그 결과 **한국어 로컬 정보의 최대 저장소가 AI 검색에서 누락**되는 현상 발생
- 이것이 AI플레이스 프로젝트의 존재 근거이자 기회

반면 **네이버 자체는 IndexNow를 지원**하므로, 한국 사이트 운영자 입장에서는:
- 네이버에서도 인덱싱되고
- Bing/ChatGPT Search에서도 인덱싱되는
- **이중 최적화 구조를 IndexNow 하나로 해결 가능**

### 6.3 한국 사업자의 AI 검색 현황

- **대부분의 한국 사업자가 Bing Places에 미등록** — ChatGPT에서 "천안 치과 추천" 쿼리 시 한국 업체가 거의 나오지 않는 주요 원인
- Google Business Profile 등록률은 높아지고 있으나 영문 정보 부재로 글로벌 LLM 학습 데이터 빈약
- Schema.org 마크업 보급률 극히 낮음 — 네이버 SEO는 schema보다 키워드·블로그 최적화 위주
- **결과:** 구조화된 한국 로컬 데이터를 영문+한글 이중으로 제공하는 사이트가 거의 없음 → 선점 기회

### 6.4 한국 로컬 이중 최적화 원칙

"네이버 SEO"와 "AI 검색 GEO"는 부분적으로 충돌한다. 충돌 지점과 해결:

| 영역 | 네이버 최적화 | AI 검색 최적화 | 해결책 |
|---|---|---|---|
| 언어 | 한국어 필수 (hreflang 미지원) | 영문 혼용 가능 | **한국어 본문 + 영문 schema 속성** |
| URL 슬러그 | 한글 슬러그 선호 | 영문도 무관 | **한글 URL 권장** (AI도 UTF-8 OK) |
| 콘텐츠 | 키워드 밀도, 블로그 스타일 | 구조화·답변형 | 둘 다 만족하는 Direct Answer + Keyword |
| 속도 | 영향 낮음 | 영향 높음 (CWV) | CWV 기준으로 통일 |
| 링크 | 네이버 내부 링크 중요 | 외부 백링크 중요 | 둘 다 구축 |

---

# 2부 · AI플레이스 프로젝트 적용 가이드

## 7. 프로젝트 컨텍스트 정리

**AI플레이스 핵심 가설:**
> 한국 로컬 사업체 정보를 AI 크롤러가 읽을 수 있는 구조화된 형태로 제공하면, AI 검색 결과에서 해당 사업체가 인용·추천된다.

**MVP 범위 (스펙 문서 기준):**
- 지역: 천안 (1차)
- 업종: 치과 10곳 → 병원 전체 → 전 업종
- 기술 스택: Next.js 15 App Router + Tailwind + shadcn/ui + Supabase + Prisma + Vercel + 카카오맵
- 검증 대상: dedo.kr 선행 실험 (2026-04-14 시작, 4월 21일·28일·5월 12일 3차 측정)

이 프로젝트의 각 레이어에 1부 리서치 결과를 매핑해서 실행 가이드를 정리한다.

---

## 8. 우선순위 로드맵

### 8.1 P0 — 기술 기초 (Week 1, 즉시 실행)

| 항목 | 세부 | 근거 |
|---|---|---|
| robots.txt | GPTBot·ClaudeBot·PerplexityBot·OAI-SearchBot·Claude-User·Claude-SearchBot·Google-Extended 전부 Allow | §5.1, [^12] |
| SSG 기본 | `generateStaticParams` + ISR, CSR 컴포넌트 최소화 | §5.5 |
| sitemap.xml | `app/sitemap.ts` 자동 생성, `changeFrequency: weekly`, `priority: 0.9`(카테고리) · `0.8`(상세) | §5.4 |
| robots.ts | `app/robots.ts`로 동적 생성, 환경별 차등 (staging Disallow) | §5.1 |
| IndexNow | 사업체 등록/수정 시 자동 호출, Vercel Edge Function | §5.4 |
| GSC + Bing Webmaster | 등록 + 사이트맵 제출 + URL Inspection 사용법 학습 | §5.4 |
| Naver Search Advisor | 사이트맵 제출 (한국 사업자 노출 부스트) | §6.4 |

### 8.2 P1 — 콘텐츠 구조 (Week 1~2)

| 항목 | 세부 | 근거 |
|---|---|---|
| LocalBusiness schema | 구체적 subtype(`Dentist`, `Restaurant`…) 사용, `sameAs`로 네이버 플레이스·카카오맵 URL 연결 | §5.3, §4.3 |
| FAQPage schema | 사업체당 최소 5개 FAQ, 실제 검색어 형태 | §4.3, §4.4 |
| BreadcrumbList schema | 모든 상세·카테고리 페이지 | §5.3 |
| Review + AggregateRating | 리뷰 수집 파이프라인 구축 후 schema 연결 | §3.1 |
| Direct Answer Blocks | 모든 H2/H3 직하 40~60자 답변 단락 | §4.4 |
| 메타데이터 일관성 | Prisma에 JSON-LD 생성 헬퍼 단일화 | §5.3 |

### 8.3 P2 — 권위 빌딩 (Week 2~8, compounding)

| 항목 | 세부 | 근거 |
|---|---|---|
| 통계·인용·출처 3종 | 카테고리 페이지 상단 "천안 치과 임플란트 평균 비용 2026" 자체 조사 섹션 | §2.2 |
| 저자 바이라인 | Person schema로 이지수RC + 자격/소속 | §4.1 |
| 외부 백링크 최소 3개 | 충남관광, 구글 비즈니스 프로필, Product Hunt 런칭 | §4.5 |
| Reddit/LinkedIn presence | "AI 검색에서 한국 로컬이 안 보이는 이유" 연재 | §3.2, §4.5 |
| 분기별 갱신 루틴 | 사업체 정보·FAQ·통계 수치 re-timestamp | §4.2 |
| llms.txt 배포 | 저비용 보너스 | §5.2 |

### 8.4 P3 — 측정과 실험 (Week 2부터 지속)

| 항목 | 세부 |
|---|---|
| 베이스라인 기록 | 쿼리 10종 × 엔진 4종 × n=5회 반복 측정 (총 200 측정) |
| 주간 측정 | 동일 쿼리셋으로 매주 금요일 반복, 변화 추적 |
| GSC / Bing Webmaster Performance | 인덱싱·노출·클릭 주간 리뷰 |
| Bing AI Performance 탭 | 2026년 추가된 AI 답변 내 노출 지표 |
| 경쟁 사이트 비교 | 네이버 플레이스 1위 vs AI플레이스 페이지를 동일 쿼리로 비교 |

---

## 9. 페이지 타입별 최적화 패턴

### 9.1 사업체 상세 페이지 `/[city]/[category]/[slug]`

**필수 요소 체크리스트:**

```
□ <title> 형식: "{사업체명} - {도시} {카테고리} | AI 플레이스"
□ <meta description>: 150자 이내, 도시+카테고리+핵심서비스 키워드 맨 앞
□ H1: "{사업체명}" (1개만)
□ H2: 개요 / 진료안내(서비스) / 의료진(직원) / FAQ / 찾아오시는길 (이 순서)
□ H2 바로 아래 Direct Answer Block 40~60자 (AEO)
□ JSON-LD: LocalBusiness(구체 subtype) + FAQPage + BreadcrumbList + Review
□ sameAs: 네이버 플레이스, 카카오맵, 구글 비즈니스 프로필 URL
□ openingHoursSpecification 완전 기입
□ 전화번호·주소·영업시간이 본문 텍스트에도 동일하게 노출 (schema ≠ 페이지 불일치 금지)
□ "Last Updated: 2026-MM-DD" 표기
□ 저자 Person schema (큐레이터로 이지수RC 명시 시)
```

**본문 구성 (Princeton 논문 검증 레버 적용):**

```markdown
# 스마일치과의원
천안시 동남구 만남로 123 · 2010년 개원

## 천안 동남구 임플란트 전문 치과입니다
스마일치과의원은 천안시 동남구 만남로에 위치한 치과 전문 의원으로,
임플란트·치아교정·심미보철을 전문으로 합니다. 2010년 개원 이래 15년간
임플란트 시술 5,000건 이상, 평일 9~18시·토요일 9~13시 운영합니다.

## 진료 안내
- 임플란트 (1개 기준 80만원~150만원, 재료 및 뼈이식 유무에 따라 변동)
- 치아교정 (기본 상담 무료)
- 심미보철 (라미네이트·올세라믹)

## 의료진 소개
### 김철수 대표원장
서울대 치과대학 졸업, 구강악안면외과 전문의. 20년 경력.

## 자주 묻는 질문
### 천안에서 임플란트 비용은 얼마인가요?
천안 지역 평균 임플란트 비용은 1개당 80만원~150만원 범위입니다.
본원에서는 지르코니아 기준 120만원부터 제공하며, 뼈이식 필요 시 별도 견적을 안내합니다.
(구체 수치 ← 통계 레버)

### 치료 기간은 얼마나 걸리나요?
일반적 임플란트는 상담→식립→보철까지 3~6개월이 소요됩니다.
즉시 식립이 가능한 케이스는 약 3개월, 뼈이식 동반 시 6~9개월까지 연장됩니다.

## 찾아오시는 길
- 주소: 충남 천안시 동남구 만남로 123
- 지하철: 1호선 쌍용역 2번 출구 도보 5분
- 주차: 건물 지하 10대

*최종 업데이트: 2026-04-14*

출처:
- 건강보험심사평가원 2025년 치과 진료비 통계 [^내부각주]
- 대한치과협회 임플란트 가이드라인 2024
```

위 예시에서 적용된 레버:
- ✅ Statistics Addition (구체적 수치)
- ✅ Cite Sources (출처 명시)
- ✅ Direct Answer Blocks
- ✅ FAQ 실제 검색어 형태
- ✅ Last Updated 타임스탬프
- ✅ E-E-A-T 시그널 (학력, 경력, 연도)

### 9.2 카테고리 큐레이션 페이지 `/[city]/[category]`

**역할:** "천안 치과 추천" 같은 상위 쿼리에 대한 AI 인용 타깃. 개별 사업체 페이지보다 **AI 인용률이 더 높게 나올 것**으로 예상됨.

**구조:**

```markdown
# 천안 치과 추천 — AI가 찾아주는 천안 치과 10곳

천안시에는 2026년 4월 기준 치과 의원 312곳이 운영 중이며,
이 중 임플란트·교정·소아치과 전문성과 진료 시간대를 기준으로
10곳을 선별했습니다. (← Direct Answer Block)

## 천안 치과 평균 비용 (2026년 4월 조사)
| 시술 | 평균가 | 최저가 | 최고가 |
|---|---|---|---|
| 임플란트 (1개, 지르코니아) | 130만원 | 80만원 | 200만원 |
| 교정 (전체, 메탈) | 400만원 | 300만원 | 550만원 |
| 스케일링 | 4.5만원 | 3만원 | 8만원 |

*출처: AI플레이스 자체 조사, 천안시 치과 50곳 가격 정보 수집 (2026-04)*

## 천안 치과 TOP 10
1. **스마일치과의원** (동남구) — 임플란트 전문 · [상세](...)
2. ...

## 천안 치과 자주 묻는 질문
### 천안에서 주말 진료하는 치과는?
본 데이터베이스 기준 천안시에서 토요일 오후까지 진료하는 치과는 ...
```

핵심: **자체 조사·통계·비교표**가 이 페이지의 GEO 무기. Princeton 논문의 "Statistics Addition" 레버를 대규모로 적용한 형태.

### 9.3 진단 도구 페이지 `/check`

이 페이지는 **퍼널 입구**이면서도 **자체가 AI 인용 타깃**이 될 수 있다.

**추가 최적화:**
- 페이지 상단 Direct Answer: "AI 플레이스 진단은 ChatGPT·Perplexity·Claude 3개 엔진에 동일 쿼리를 전송하고 결과 내 브랜드 노출 여부를 분석합니다"
- "Tool" schema 적용 (`SoftwareApplication` 또는 `WebApplication`)
- 진단 예시 스크린샷 (이미지 alt 텍스트로 "천안 치과 진단 리포트 예시" 등)
- 진단 원리 FAQ 섹션 별도 운영

### 9.4 블로그 `/blog/[slug]`

이지수님 블로그(당신의 봄) 시즌3 후보로 거론된 "AI SEO 실전 케이스 스터디"가 여기에 자연스럽게 매핑된다.

**GEO 친화적 글 형식:**
- 제목: 실제 검색 쿼리 형태 ("ChatGPT에서 천안 치과 추천이 안 나오는 이유")
- 첫 단락: 40~60자 Direct Answer
- 중간: 통계·인용·출처 3종 세트
- 말미: FAQ 3~5개 + FAQPage schema
- 저자: Person schema (이지수)
- 내부링크: AI플레이스 카테고리·진단도구로 유도
- 외부링크: Princeton 논문, BrightEdge 연구 등 .edu/.org 권위 사이트

---

## 10. AI플레이스 Schema 확장안

현재 Prisma 스키마에서 **Review와 Rating이 누락**되어 있어 ChatGPT·Perplexity의 리뷰 플랫폼 선호 신호에 대응할 수 없다. 추가 권고:

```prisma
model Review {
  id         String   @id @default(cuid())
  rating     Float    // 1.0 ~ 5.0
  body       String?  @db.Text
  authorName String   // 리뷰 작성자(가명 허용)
  source     String   // "naver", "kakao", "google", "direct"
  reviewUrl  String?  // 원본 URL (저작권·출처 명시용)
  publishedAt DateTime
  businessId String
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  @@index([businessId])
  @@index([source])
}

model AggregateRating {
  id            String   @id @default(cuid())
  ratingValue   Float    // 평균 별점
  reviewCount   Int      // 총 리뷰 수
  bestRating    Float    @default(5.0)
  worstRating   Float    @default(1.0)
  businessId    String   @unique
  business      Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  updatedAt     DateTime @updatedAt
}
```

**LocalBusiness JSON-LD 확장:**
```typescript
{
  "@context": "https://schema.org",
  "@type": "Dentist",  // 구체 subtype
  "@id": "https://aiplace.kr/cheonan/dental/smile-dental",
  "name": "스마일치과의원",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": business.aggregateRating.ratingValue,
    "reviewCount": business.aggregateRating.reviewCount,
    "bestRating": 5,
    "worstRating": 1
  },
  "review": business.reviews.slice(0, 5).map(r => ({
    "@type": "Review",
    "author": { "@type": "Person", "name": r.authorName },
    "datePublished": r.publishedAt.toISOString(),
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": r.rating
    },
    "reviewBody": r.body
  })),
  "sameAs": [
    business.naverPlaceUrl,
    business.kakaoMapUrl,
    business.gmbUrl
  ].filter(Boolean)
}
```

**추가 schema 타입:**
- `Service` — 업종별 세부 서비스 (임플란트, 교정…) 별도 schema
- `MenuItem` — 음식점 확장 시
- `MedicalProcedure` — 의료기관용 (의료광고법 검토 필요)
- `PriceSpecification` — 가격 정보 (있을 때만)

---

## 11. dedo.kr 실험 설계 재정비 (A/B)

현재 스펙의 dedo.kr 단일 사이트 검증은 통제 변수가 없어 통계적 유의미성이 약하다. 개선안:

### 11.1 현재 설계의 문제

- dedo.kr에 robots·llms·schema·메타·본문 **5가지 변경을 동시 적용** → 무엇이 효과였는지 분리 불가
- 단일 사이트 n=1 → Perplexity의 비결정성 대응 불가
- "노출됨/안됨" 이진 판정 → 포지션·반복률 측정 부재

### 11.2 권장 재설계 — 2단계 실험

**실험 1 (이미 진행 중) — "종합 패키지 효과 있나?"**
- dedo.kr에 현재 5가지 변경 전부 적용 유지
- 4/14 Before, 4/21, 4/28, 5/12 후속 측정
- 쿼리 5개 × 엔진 4개 × n=5회 = 100 측정/시점
- 산출: "AI-SEO 풀 패키지를 적용하면 4주 내 최소 X% 확률로 노출된다"

**실험 2 (추가 권장) — "어떤 레버가 효과인가?"**
- 지인 사업체 2~3곳 섭외 (치과, 카페, 디자인 회사 등)
- 사이트 A: robots + sitemap만
- 사이트 B: A + Schema LocalBusiness
- 사이트 C: B + FAQPage + Direct Answer
- 사이트 D: C + 통계·인용·출처 3종
- 동일 4주 관찰, 동일 쿼리 프로토콜
- 산출: "어떤 레버가 marginal gain을 주는가" (Princeton 논문의 한국 로컬 재현)

### 11.3 측정 자동화

스크립트로 매주 금요일 자동 실행:

```python
# scripts/ai_visibility_check.py (의사코드)
queries = ["천안 홈페이지 제작", "천안 웹디자인 회사", ...]
engines = ["perplexity_sonar", "openai_search", "claude_web", "google_aio"]
N_REPEATS = 5

for q, e, i in product(queries, engines, range(N_REPEATS)):
    response, citations = call_engine(e, q)
    save_row({
      "date": today,
      "query": q,
      "engine": e,
      "iteration": i,
      "response": response,
      "citations": citations,
      "dedo_cited": any("dedo.kr" in c for c in citations),
      "dedo_position": first_index("dedo.kr", citations)
    })
```

결과는 DataFrame/CSV로 누적 → 시계열 그래프로 블로그 글·카드뉴스 소재로 활용.

---

## 12. 검증 지표와 성공 기준

### 12.1 OKR 형식 제안

**Objective (4주):** dedo.kr의 AI 검색 가시성을 실증한다.

**Key Results:**
- KR1: 5개 타깃 쿼리 × 4개 엔진 × 5회 반복 = 100 측정 중 **최소 10회 인용 (10% 인용률)**
- KR2: Perplexity 내 적어도 **3회 연속 측정에서 top 5 출처 진입**
- KR3: Bing Webmaster AI Performance 탭에서 **0 impression → 월 100 impression 이상**

### 12.2 스케일 업 판단 기준 (5월 12일)

| 조건 | 의사결정 |
|---|---|
| KR1, KR2, KR3 모두 달성 | Phase 2(천안 치과 10곳) 즉시 착수 |
| KR 중 2개 달성 | 1주 추가 관찰 후 재판단 |
| 1개 이하 달성 | 가설 수정 — 콘텐츠 30곳으로 범위 확장 + FAQ 품질 강화 |

### 12.3 장기 성공 정의 (6개월)

- Perplexity 기준 동일 쿼리 10회 반복 시 **최소 3회 인용** (30% 인용률)
- ChatGPT 기준 "천안 치과 추천" 쿼리에서 **AI 플레이스 도메인이 답변의 출처 링크로 등장**
- AI-referred 세션이 유기 검색 세션의 **10% 이상**까지 성장

---

## 13. 리스크와 한계 (솔직한 정리)

### 13.1 기술이 해결 못하는 것

- **LLM의 비결정성** — 동일 쿼리에도 결과가 매번 다름. "확률을 높일 수는 있으나 보장 불가"
- **AI 엔진의 블랙박스 업데이트** — 2026년 4월의 알고리즘이 7월에도 동일하다는 보장 없음
- **Perplexity/ChatGPT의 자동화 쿼리 rate limit** — 대규모 진단 시 차단 위험, 공식 API 써도 UI 결과와 100% 동일 보장 없음

### 13.2 법·윤리 리스크

- **초기 seed 데이터 수집** — 크롤링·스크래핑은 의료기관·개인정보 영역에서 분쟁 소지
- **의료광고법** — 과장·비교우위·유인광고 금지 조항. "천안 임플란트 최저가" 같은 표현 위법
- **리뷰 schema** — 타 플랫폼 리뷰를 직접 복제하면 저작권 이슈, `reviewUrl`로 원본 링크 유지 필수
- **사업자 동의** — Phase 후반 "사업체 직접 등록"으로 전환하기 전까지는 **명시적 동의 없이 상세 정보 게시 불가**

### 13.3 비즈니스 리스크 (기술 외)

- 한국 유저의 AI 로컬 검색 성숙도 낮음 (수요 타이밍 리스크)
- 사업자 유료 전환 퍼널 미검증
- 구글 비즈니스 프로필·Bing Places 강화가 대체재가 될 가능성

---

# 부록 A · 런칭 체크리스트 (복붙용)

```
[기술 기초]
□ app/robots.ts — GPTBot/ClaudeBot/PerplexityBot/OAI-SearchBot/Claude-User/Claude-SearchBot/Google-Extended Allow
□ app/sitemap.ts — cities × categories × businesses 전부 포함
□ app/[city]/[category]/[slug]/page.tsx — generateStaticParams 구현
□ Schema.org JSON-LD 헬퍼 lib/schema.ts 단일화
□ IndexNow API 키 /public/{key}.txt + lib/indexnow.ts
□ Google Search Console 등록 + 사이트맵 제출
□ Bing Webmaster Tools 등록 + 사이트맵 제출
□ Naver Search Advisor 등록 + 사이트맵 제출
□ GSC URL Inspection으로 주요 페이지 색인 요청

[페이지별]
□ generateMetadata (title, description, canonical, OG)
□ H1 1개, H2/H3 순서 준수
□ H2 직하 Direct Answer Block 40~60자
□ JSON-LD: LocalBusiness(subtype) + FAQPage + BreadcrumbList + Review(있을 때)
□ sameAs: 네이버플레이스·카카오맵·GBP
□ 이미지 alt 텍스트
□ "Last Updated: YYYY-MM-DD" 본문 표기
□ 저자 바이라인 Person schema

[콘텐츠]
□ 통계·수치·조사 결과 최소 3개 포함
□ 외부 권위 출처 인용 최소 2개
□ FAQ 최소 5개, 실제 검색어 형태
□ 의료기관이면 의료광고법 검토
□ 한국어 본문 + 한국어 URL 슬러그 (권고)

[측정]
□ Before 측정 완료 (쿼리 × 엔진 × n=5)
□ 주간 재측정 루틴 캘린더 등록
□ GSC, Bing Webmaster, Naver Search Advisor Performance 탭 주간 리뷰

[llms.txt]
□ /public/llms.txt 배포 (선택)
```

---

# 부록 B · 용어 사전

- **GEO (Generative Engine Optimization)** — ChatGPT·Perplexity 등 LLM 답변 내 인용 최적화
- **AEO (Answer Engine Optimization)** — Featured Snippet·음성 답변 최적화
- **SEO (Search Engine Optimization)** — 전통 검색 결과 랭킹 최적화
- **SGE (Search Generative Experience)** — Google의 생성형 검색, 2024년 AI Overviews로 정식 개명
- **SSG (Static Site Generation)** — 빌드 타임에 HTML 생성, Next.js의 `generateStaticParams`
- **SSR (Server-Side Rendering)** — 요청 시점 서버에서 HTML 생성
- **ISR (Incremental Static Regeneration)** — Next.js의 부분 재생성, 콘텐츠 변경 시 해당 페이지만 재빌드
- **CWV (Core Web Vitals)** — LCP, INP, CLS 등 구글의 페이지 경험 지표
- **Schema.org** — 구조화 데이터 표준 어휘 (JSON-LD가 권장 형식)
- **llms.txt** — LLM용 사이트 가이드 파일 (비공식 제안 단계)
- **IndexNow** — Bing·Yandex·Naver 실시간 인덱싱 프로토콜
- **E-E-A-T** — Experience / Expertise / Authoritativeness / Trustworthiness (Google 품질 평가)
- **FastSearch** — Google AI Overviews의 고속 retrieval 시스템
- **Query Fan-out** — 하나의 유저 질문을 여러 서브쿼리로 분해해 병렬 검색
- **Direct Answer Block** — 40~60자 자기완결 답변 단락, 주변 문맥 없이도 답이 됨
- **Entity Linking** — `sameAs`·`mainEntityOfPage`로 Knowledge Graph 엔티티 연결

---

# 부록 C · 참고 문헌

[^1]: SeoClarity, "AI Overview Ranking Study" (2025) — Google AI Overviews 인용 소스 99.5%가 상위 10위 이내.
[^2]: Seer Interactive, ["87% of SearchGPT Citations Match Bing's Top Results"](https://www.seerinteractive.com/insights/87-percent-of-searchgpt-citations-match-bings-top-results).
[^3]: Profound Research, ["AI Platform Citation Patterns"](https://www.tryprofound.com/blog/ai-platform-citation-patterns).
[^4]: Aggarwal P., Murahari V., Rajpurohit T., Kalyan A., Narasimhan K., Deshpande A. ["GEO: Generative Engine Optimization"](https://arxiv.org/abs/2311.09735). KDD 2024, ACM. DOI: 10.1145/3637528.3671900.
[^5]: ZipTie, ["How Does ChatGPT Choose Its Sources?"](https://ziptie.dev/blog/how-does-chatgpt-choose-its-sources/).
[^6]: The Pepper Guild, ["The Rise of Reddit: How the Forum Giant is Surpassing Wikipedia in AI Model Citations"](https://thepepperguild.medium.com/the-rise-of-reddit-how-the-forum-giant-is-surpassing-wikipedia-in-ai-model-citations-3e7234cc9f8d) (2025).
[^7]: Search Engine Land, ["How does ChatGPT conduct local searches?"](https://searchengineland.com/how-does-chatgpt-conduct-local-searches-454894).
[^8]: Wellows, ["How to Rank in Perplexity AI (2026 Guide)"](https://wellows.com/blog/how-to-rank-in-perplexity/).
[^9]: SEMrush, ["The Most-Cited Domains in AI: A 3-Month Study"](https://www.semrush.com/blog/most-cited-domains-ai/).
[^10]: ALM Corp, ["Google AI Overviews Surge 58% Across 9 Industries"](https://almcorp.com/blog/google-ai-overviews-surge-9-industries/).
[^11]: Wellows, ["Google AI Overviews Ranking Factors: 2026 Guide"](https://wellows.com/blog/google-ai-overviews-ranking-factors/).
[^12]: ALM Corp, ["ClaudeBot, Claude-User & Claude-SearchBot: Anthropic's Three-Bot Framework"](https://almcorp.com/blog/anthropic-claude-bots-robots-txt-strategy/).
[^13]: Search Engine Journal, ["Anthropic's Claude Bots Make Robots.txt Decisions More Granular"](https://www.searchenginejournal.com/anthropics-claude-bots-make-robots-txt-decisions-more-granular/568253/).
[^14]: BrightEdge, ["E-E-A-T Implementation for AI Search"](https://www.brightedge.com/blog/e-e-a-t-implementation-ai-search).
[^15]: WPRiders, ["Schema Markup: 8 Tactics to Boost AI Citations"](https://wpriders.com/schema-markup-for-ai-search-types-that-get-you-cited/).
[^16]: Relixir, ["Does Updating Schema Markup Boost GEO Performance in 2025?"](https://relixir.ai/blog/schema-markup-boost-geo-performance-2025-data).
[^17]: Geneo, ["Schema Markup Best Practices for AI Citations (2025)"](https://geneo.app/blog/schema-markup-best-practices-ai-citations-2025/).
[^18]: GenOptima, ["Best Answer Engine Optimization Techniques for 2026"](https://www.gen-optima.com/geo/best-answer-engine-optimization-techniques-2026/).
[^19]: Otterly.AI, ["The AI Citation Economy: What 1+ Million Data Points Reveal About Visibility in 2026"](https://otterly.ai/blog/the-ai-citations-report-2026/).
[^20]: AICarma, ["The Complete Robots.txt Guide for AI Crawlers: 2026 Strategy"](https://aicarma.com/blog/robots-txt-for-ai/).
[^21]: Ahrefs, ["What Is llms.txt, and Should You Care About It?"](https://ahrefs.com/blog/what-is-llms-txt/).
[^22]: IdeaHills, ["What is llms.txt? An Honest Look at Hype vs. Reality"](https://ideahills.com/what-is-llms-txt-an-honest-look-at-hype-vs-reality-template/).
[^23]: Google Search Central, ["Local Business (LocalBusiness) Structured Data"](https://developers.google.com/search/docs/appearance/structured-data/local-business).
[^24]: Bing Webmaster Tools, ["Why IndexNow"](https://www.bing.com/indexnow).
[^25]: Link-Assistant, ["Google Vs. Naver in 2026 in Korea: Ultimate Guide to SEO"](https://www.link-assistant.com/news/naver-vs-google-in-korea.html).

### 추가 참고 자료 (본문 미인용이나 배경 리서치에 사용)

- Ahrefs, ["Generative Engine Optimization: Growth Strategies and Metrics"](https://ahrefs.com/blog/geo-generative-engine-optimization/)
- SEMrush, ["GEO vs. SEO: A Comparative Guide"](https://www.semrush.com/blog/geo-vs-seo/)
- Search Engine Land, ["Anthropic clarifies how Claude bots crawl sites"](https://searchengineland.com/anthropic-claude-bots-470171)
- The Egg, ["Pros and Cons of SEM in Korea in 2026"](https://www.theegg.com/sem/korea/pros-and-cons-of-sem-in-korea-google-ads-vs-naver-ads/)
- GitHub, ["seo-geo-claude-skills"](https://github.com/aaron-he-zhu/seo-geo-claude-skills) — Claude Code용 20개 SEO/GEO skills
- Wikipedia, ["Generative engine optimization"](https://en.wikipedia.org/wiki/Generative_engine_optimization)

---

*이 문서는 2026-04-14 기준 리서치이며, AI 엔진 알고리즘과 표준이 빠르게 변하는 분야이므로 분기별 갱신을 권장합니다. 특히 llms.txt 표준화 여부, Google의 IndexNow 채택 여부, Perplexity·ChatGPT의 retrieval 업데이트는 주기적 모니터링 대상입니다.*
