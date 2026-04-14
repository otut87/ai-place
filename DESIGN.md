# AI Place Design System

Airbnb 디자인 시스템 기반. 따뜻한 화이트 캔버스 + 단일 브랜드 액센트 + 사진 중심 카드.

**UI 라이브러리 전략**: 퍼블릭 페이지는 순수 Tailwind + 커스텀 컴포넌트. shadcn은 Admin 페이지(등록폼, 대시보드)에서만 사용.

## 1. Atmosphere

깨끗한 화이트 캔버스에 Place Green(`#00a67c`)이 유일한 색상. 나머지는 전부 `#222222`(텍스트)와 화이트/그레이뿐. Airbnb가 Rausch Red 하나로 전체 사이트를 통일하듯, AI Place는 초록 하나로 통일한다.

느낌: 네이버 플레이스 + Airbnb. 장소 안내 서비스의 신뢰감 + 마켓플레이스의 따뜻한 브라우징.

## 2. Colors

**브랜드 — CTA와 활성 상태에만 사용**
| Token | Value | Role |
|-------|-------|------|
| `--color-brand` | `#00a67c` | CTA 버튼, 활성 링크, 선택된 필터 |
| `--color-brand-dark` | `#008f6b` | 호버/프레스 |

**텍스트 — near-black, 절대 순수 검정 금지**
| Token | Value | Role |
|-------|-------|------|
| `--color-text` | `#222222` | 모든 제목, 본문 |
| `--color-text-secondary` | `#6a6a6a` | 부가 설명, 주소, 메타 |
| `--color-text-disabled` | `#c1c1c1` | 비활성 |

**서피스**
| Token | Value | Role |
|-------|-------|------|
| `--color-bg` | `#ffffff` | 페이지 배경, 카드 |
| `--color-bg-secondary` | `#f2f2f2` | 원형 버튼, 서브 서피스 |
| `--color-border` | `#c1c1c1` | 카드/디바이더 테두리 |

**별점**
| Token | Value |
|-------|-------|
| `--color-star` | `#222222` | (Airbnb처럼 검정 별 + 숫자) |

이게 전부. 다른 색상은 사용하지 않는다.

## 3. Typography

### Font Stack
```
"Pretendard Variable", -apple-system, system-ui, sans-serif
```
Airbnb Cereal 대신 Pretendard Variable. 한국어+라틴 모두 커버. Weight 500–700만 사용.

### Hierarchy

| Role | Size | Weight | Line Height | Letter Spacing |
|------|------|--------|-------------|----------------|
| Section Heading | 28px | 700 | 1.43 | normal |
| Card Heading | 22px | 600 | 1.18 | -0.44px |
| Sub-heading | 20px | 600 | 1.20 | -0.18px |
| UI / Nav | 16px | 500 | 1.25 | normal |
| Button | 16px | 500 | 1.25 | normal |
| Body | 14px | 400 | 1.43 | normal |
| Body Medium | 14px | 500 | 1.29 | normal |
| Small | 13px | 400 | 1.23 | normal |
| Tag | 12px | 400–700 | 1.33 | normal |

### Rules
- **Heading은 항상 weight 500 이상.** 400으로 제목 쓰지 않음
- **제목에 음수 letter-spacing** (-0.18px ~ -0.44px) → 따뜻하고 응집력 있는 느낌
- **Line-height는 큰 글씨일수록 타이트** (28px→1.43, 22px→1.18)
- **한국어 본문(14–16px)은 line-height 1.43 이상**

## 4. Components

### Buttons

**Primary (Brand Green)**
- Background: `#00a67c` → hover `#008f6b`
- Text: `#ffffff`, 16px weight 500
- Padding: 0 24px, height 48px
- Radius: 8px

**Dark (Near-black)**
- Background: `#222222`
- Text: `#ffffff`, 16px weight 500
- Padding: 0 24px, height 48px
- Radius: 8px

**Circular Nav**
- Background: `#f2f2f2` → hover shadow
- Text: `#222222`
- Radius: 50%
- Hover shadow: `rgba(0,0,0,0.08) 0 4px 12px`

### Cards

**Listing Card**
- Background: `#ffffff`
- Radius: 20px (큰 카드), 14px (중간 카드)
- Shadow: `rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px`
- Hover: 쉐도우 변화 없음. Airbnb처럼 카드 자체보다 이미지 캐러셀 인터랙션에 집중
- 구조: 사진(상단, 큰 비율) + 정보(하단)
- 사진 위 하트/찜 아이콘 오버레이 가능

### Carousel / Slider (Embla Carousel)

라이브러리: `embla-carousel-react`. Headless — 스타일은 전부 우리 디자인 시스템 적용.

**이미지 캐러셀 (카드 내 사진)**
- 카드 상단 사진 영역에 좌우 슬라이드
- 네비게이션: 원형(50%) 화살표 버튼, `#ffffff` bg, shadow-card
- 화살표는 hover 시에만 표시 (모바일은 스와이프)
- 인디케이터: 하단 중앙 도트, 활성 `#ffffff` / 비활성 `rgba(255,255,255,0.6)`
- 도트 크기: 6px, gap 6px
- 드래그/스와이프: 활성화
- Loop: 비활성 (마지막 사진에서 멈춤)

**카드 캐러셀 (주변 업체, 추천 업체)**
- 수평 카드 슬라이더, 카드 일부가 잘려 보여서 더 있음을 암시
- 네비게이션: 양쪽 끝 원형 화살표, `#f2f2f2` bg
- Snap: 카드 단위로 정렬 (align: 'start')
- 카드 gap: 24px
- Partial slide: 마지막 카드가 20% 정도 보임
- 모바일: 스와이프, 화살표 숨김

**카테고리 필 캐러셀**
- Category Pills를 Embla로 감싸서 overflow 시 화살표 표시
- 양쪽 끝 원형 화살표, `#f2f2f2` bg
- 화살표는 스크롤 가능한 방향에만 표시 (시작이면 ← 숨김)
- Snap: 필 단위

### Category Pills
- 수평 스크롤 바
- 각 필: 14px weight 600, `#222222` 텍스트
- 활성: 하단 border 2px `#222222`
- 좌우: 원형(50%) 네비게이션 화살표 (`#f2f2f2` bg)

### Tags
- Background: transparent
- Border: 1px solid `#c1c1c1`
- Text: `#222222`, 12px weight 500
- Radius: 14px
- Padding: 4px 10px
- 어떤 배경(white, #f2f2f2) 위에서든 동일하게 보여야 함

### Rating
- 형식: `★ 4.5 · 후기 23건`
- Star: `#222222` (Airbnb 스타일, 컬러 별이 아닌 검정 별)
- Text: 14px weight 500

### Navigation

**Header (Sticky)**
- Background: `#ffffff`
- Border-bottom: 1px solid `#c1c1c1` (필요 시)
- Height: 64px
- 좌: 로고 "AI Place" (weight 700)
- 중: 검색 또는 카테고리 링크
- 우: [업체 등록] CTA (Brand Green)

**Breadcrumb**
- 14px weight 400, `#6a6a6a`
- Separator: `›`
- Current: weight 500, `#222222`

**Footer**
- Background: `#f2f2f2`
- 4-column 링크 그리드
- 하단: copyright, 12px `#6a6a6a`

### FAQ
- 직접 페이지 내 섹션으로 표시 (아코디언)
- Question: 16px weight 500
- Answer: 14px weight 400, `#6a6a6a`
- 구분: 1px `#c1c1c1`

### Inputs
- Background: `#ffffff`
- Border: 1px solid `#c1c1c1`
- Radius: 8px (검색바는 pill형 가능)
- Padding: 12px 16px
- Focus: 2px ring `#222222`

## 5. Layout

### Spacing (8px base)

모든 여백은 이 스케일에서만 선택. 임의 값 사용 금지.

```
4px  — 태그 내부 vertical padding
8px  — 인라인 요소 간격 (태그 gap, 카드 내 줄간)
12px — 카드 내부 요소 간 (이름→주소, 평점→태그)
16px — 본문 문단 간격
20px — 카드 내부 padding, pill 간격
24px — 카드 그리드 gap, 페이지 좌우 padding
32px — 컴포넌트 그룹 간 (버튼 그룹 → 다음 컴포넌트)
40px — 섹션 제목+설명 → 콘텐츠 간격
48px — 푸터 내부 하단 padding
64px — 푸터 상단 margin
80px — 섹션 vertical padding (각 섹션 상하)
96px — 히어로 top padding
```

### Grid
- Max width: 1200px, centered
- Listing grid: 1col → 2col(640px) → 3col(1024px) → 4col(1280px)
- Card gap: 24px
- Page padding: 16px(mobile), 24px(desktop)

### Border Radius Scale
```
8px  — 버튼, 인풋, 태그
14px — 중간 카드, 뱃지
20px — 큰 카드
32px — 히어로 컨테이너
50%  — 원형 버튼, 아바타
```

## 6. Shadows

| Level | Shadow | 용도 |
|-------|--------|------|
| Card | `rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px` | 기본 카드 |

3단계: Layer 1(1px ring, 0.02) = 미세 테두리. Layer 2(2px 6px, 0.04) = 앰비언트. Layer 3(4px 8px, 0.1) = 메인 리프트.

카드 호버 시 쉐도우 변화 없음. Airbnb처럼 정적 카드 + 이미지 캐러셀 인터랙션으로 동적 느낌을 준다.

## 7. Responsive

| Breakpoint | Width | Columns |
|------------|-------|---------|
| Mobile | <640px | 1 |
| Tablet | 640–1024px | 2 |
| Desktop | 1024–1280px | 3 |
| Large | >1280px | 4 |

Tailwind: `sm:640`, `md:768`, `lg:1024`, `xl:1280`

## 8. Do's and Don'ts

### Do
- `#222222` near-black 텍스트 — 따뜻하고 자신감 있는 톤
- Place Green(`#00a67c`)은 CTA에만 — 유일한 색상 액센트
- Weight 500–700 — Airbnb처럼 항상 medium 이상
- 3단계 카드 쉐도우 — 자연광 느낌
- 사진 중심 카드 — 이미지가 히어로
- 20px 카드 radius — 넉넉한 라운딩

### Don't
- 순수 검정(`#000`) 금지 — 항상 `#222222`
- 추가 색상 도입 금지 — green + black + white + gray만
- 제목에 weight 400 금지 — 500 이상
- 단일 레이어 쉐도우 금지 — 항상 3단계
- 4px 미만 radius 금지 — 날카로운 모서리 없음
- 그라디언트 금지 — 플랫 단색만
- 태그에 `#f2f2f2` 배경 금지 — 서브서피스와 겹침. 테두리 기반 사용
- `#f2f2f2` 배경 위에 놓이는 카드/박스는 반드시 `#ffffff` 배경 — 회색 위 회색 금지
- 카드 호버에 쉐도우 강화 금지 — Airbnb처럼 정적 카드
- 퍼블릭 페이지에 shadcn 컴포넌트 금지 — Admin에서만 사용

## 9. Agent Quick Reference

```
Brand:         #00a67c (CTA only)
Brand Hover:   #008f6b
Text:          #222222
Text Secondary:#6a6a6a
Background:    #ffffff
Sub-surface:   #f2f2f2
Border:        #c1c1c1
Card Shadow:   rgba(0,0,0,0.02) 0 0 0 1px, rgba(0,0,0,0.04) 0 2px 6px, rgba(0,0,0,0.1) 0 4px 8px
Card Radius:   20px
Button Radius: 8px
Font:          Pretendard Variable, weight 500–700
```
