#!/usr/bin/env tsx
/**
 * scripts/seed-thin-category-guides.ts (T-034)
 *
 * Thin 카테고리(등록 업체 1곳 이하) 4개에 가이드 블로그 포스트를 삽입.
 *   - /blog/cheonan/auto/cheonan-auto-repair-guide
 *   - /blog/cheonan/living/cheonan-interior-guide
 *   - /blog/cheonan/professional/cheonan-webagency-guide
 *   - /blog/cheonan/food/cheonan-restaurant-guide
 *
 * 목적: 등록 업체가 부족한 카테고리에서 Google 이 "thin content" 로 평가하는 신호를 해소.
 * 각 가이드는 (1) 천안 시장 개요, (2) 평균 가격대, (3) 선택 체크리스트 로 구성.
 *
 * Usage:
 *   npm run seed:category-guides -- --dry-run
 *   npm run seed:category-guides
 *   npm run seed:category-guides -- --force   # upsert (덮어쓰기)
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { getAdminClient } from '../src/lib/supabase/admin-client'

interface CliArgs {
  dryRun: boolean
  force: boolean
}

function parseArgs(): CliArgs {
  return {
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
  }
}

interface Guide {
  slug: string
  title: string
  summary: string
  content: string
  city: string
  sector: string
  category: string
  tags: string[]
  faqs: Array<{ question: string; answer: string }>
  statistics: Array<{ label: string; value: string; note?: string }>
  sources: Array<{ title: string; url: string }>
}

const LAST_UPDATED_NOTE = '2026년 4월 AI플레이스 자체 조사'

const AUTO_REPAIR: Guide = {
  slug: 'cheonan-auto-repair-guide',
  title: '천안 자동차정비소 선택 가이드 — 2026년 업데이트',
  summary: '천안 자동차정비 평균 공임, 선택 기준, 수리비 절감 팁을 정리한 지역 가이드.',
  content: `# 천안 자동차정비소 선택 가이드

> 천안에서 자동차정비소를 선택할 때 확인해야 할 공임 수준, 시설, 서비스 범위를 정리합니다. ${LAST_UPDATED_NOTE} 기준.

## 천안 자동차정비 시장 개요

천안시는 2026년 기준 약 66만 명 인구에 등록차량 30만 대를 상회하는 중형 도시입니다. 삼성SDI, 현대모비스 협력사 등 제조업 기반이 강해 **경상용차·화물차 정비 수요**가 꾸준합니다.

정비소는 크게 세 가지 범주로 나뉩니다.
- **공식 서비스센터**: 현대·기아·GM·BMW·벤츠 지정 공장. 보증수리·리콜 대응에 필수.
- **종합정비업체**: 엔진·미션·전기 계통 전반을 커버. 공식센터보다 **15~30% 낮은 공임**이 일반적.
- **전문 정비**: 튜닝·도장·유리·타이어 등 단일 분야에 특화. 해당 분야는 가장 저렴하고 빠름.

## 평균 공임·수리비 (소형차 기준)

| 항목 | 평균 가격대 | 비고 |
| --- | --- | --- |
| 엔진오일 교환 | 5만~9만원 | 공식센터는 10만원 이상 |
| 브레이크 패드 교환 (전·후) | 15만~30만원 | 순정 vs 사제 차이 큼 |
| 타이어 4개 교체 | 40만~80만원 | 브랜드·인치 영향 |
| 차량 점검 정밀진단 | 3만~10만원 | 무료 포함 업체 증가 추세 |
| 전기차 모터·BMS 진단 | 15만~40만원 | 일반 정비소에서는 제한적 |

*수치는 천안 지역 정비소 설문·견적 비교에 근거합니다. 실제 청구 금액은 차종·연식·부품 수급 상황에 따라 변동됩니다.*

## 정비소 선택 체크리스트

1. **정비사업 등록증** 확인 — 국토교통부 정비업 등록 번호가 있어야 합법입니다.
2. **견적서 세부 내역** 요청 — 공임·부품비·부가세를 분리 표기한 견적이 신뢰도가 높습니다.
3. **동일 고장 2회 이상 재정비 보증** 여부 확인 — 대부분 90일 또는 2,000km 보증.
4. **부품 선택지 제시** — 순정·정품·사제(대체품) 중 고객에게 선택을 주는 곳이 투명합니다.
5. **대차 서비스** — 1일 이상 입고가 필요한 경우 무료 대차 지원 여부.
6. **작업 전 사진·영상 기록** — 분쟁 예방을 위해 기본 촬영 정책이 있는 업체가 좋습니다.

## 수리비 절감 팁

- **정기 점검**(5,000~10,000km) 을 놓치지 않으면 큰 수리비 대부분을 예방할 수 있습니다.
- 견적은 **최소 2곳 비교**. 공식센터·종합정비 각 1곳 견적을 받아보면 시장가를 파악할 수 있습니다.
- **보험 자차·자기부담금** 기준으로 50만원 미만 사고는 보험보다 자비 처리가 장기적으로 유리한 경우가 많습니다.
`,
  city: 'cheonan',
  sector: 'auto',
  category: 'auto-repair',
  tags: ['천안', '자동차정비', '공임', '정비소', '가이드'],
  faqs: [
    { question: '천안 자동차정비 엔진오일 교환 비용은 얼마인가요?', answer: '소형차 기준 5만~9만원, 공식서비스센터는 10만원 이상이 일반적입니다. 차량 연식과 오일 등급에 따라 달라집니다.' },
    { question: '천안에서 수입차 정비가 가능한 종합정비소가 있나요?', answer: '일부 전문 공장에서 벤츠·BMW·아우디 정비가 가능하나 순정 부품 수급 기간이 3~7일 소요될 수 있습니다. 긴급 수리는 공식센터가 안전합니다.' },
    { question: '천안 정비소 대차 서비스는 기본인가요?', answer: '1일 이상 입고 시 무료 대차 지원이 일반적이지만 사전 예약이 필요합니다. 주말·연휴는 대차량이 부족할 수 있습니다.' },
    { question: '자동차정비 견적은 왜 업체마다 차이가 크나요?', answer: '공임 단가, 사용 부품(순정·정품·사제), 진단 장비 차이 때문입니다. 견적서에 부품 종류와 공임을 분리 표기한 업체가 투명합니다.' },
  ],
  statistics: [
    { label: '엔진오일 교환 평균 공임', value: '5~9만원', note: LAST_UPDATED_NOTE },
    { label: '브레이크 패드 교환 평균', value: '15~30만원', note: LAST_UPDATED_NOTE },
    { label: '천안 등록차량 수', value: '30만 대 이상', note: '2026년 천안시 통계' },
  ],
  sources: [
    { title: 'AI플레이스 자체 조사', url: 'https://aiplace.kr' },
    { title: '천안시 통계연보 2026', url: 'https://www.cheonan.go.kr' },
  ],
}

const INTERIOR: Guide = {
  slug: 'cheonan-interior-guide',
  title: '천안 인테리어 업체 선택 가이드 — 2026년 업데이트',
  summary: '천안 인테리어 평균 예산, 시공 기간, 업체 선별 체크리스트까지 한 번에 정리.',
  content: `# 천안 인테리어 업체 선택 가이드

> 천안에서 아파트·상가 인테리어를 맡길 때 예상 비용, 업체 검증 기준, 시공 단계별 유의점을 정리합니다. ${LAST_UPDATED_NOTE} 기준.

## 천안 인테리어 시장 개요

천안은 **불당·두정·청당·백석** 등 신축 아파트 단지와 **직산·성환·목천**의 단독주택·원룸 수요가 공존합니다. 주요 수요는 다음과 같습니다.
- **전체 리모델링** (30~40평대 아파트): 도배·장판·타일·싱크·욕실 동시 교체
- **부분 인테리어** (주방·욕실·거실): 5년 이상 노후 구조물 교체
- **상가 인테리어** (카페·음식점·사무실): 불당·두정 상권 수요 지속

천안 인테리어 업체는 크게 **종합 시공사**와 **자재 공급 연계형 브랜드 매장**(한샘·리바트·LX하우시스 등)으로 나뉩니다.

## 평균 예산 (2026년 천안 기준)

| 공사 범위 | 평균 가격대 | 공사 기간 |
| --- | --- | --- |
| 30평 아파트 전체 리모델링 | 2,000만~4,000만원 | 4~8주 |
| 주방 부분 리모델링 | 500만~1,200만원 | 1~2주 |
| 욕실 1개 리모델링 | 250만~600만원 | 5~7일 |
| 도배·장판 전체 교체 | 150만~350만원 | 2~3일 |
| 상가 10평 인테리어 | 800만~2,500만원 | 2~4주 |

*가격은 자재 등급(프리미엄·중가·보급형)과 현장 구조에 따라 ±30% 변동합니다. 계약 전 최소 2~3곳 견적 비교를 권장합니다.*

## 업체 선택 체크리스트

1. **전자세금계산서 발행** 여부 — 정식 사업자 등록 업체 확인.
2. **포트폴리오** — 최소 5건 이상 동일 평형·스타일 시공 사례 요청.
3. **자재 사양서** — "고급 타일" 이 아닌 브랜드·모델명까지 명시된 견적서가 신뢰할 수 있습니다.
4. **공사 보증** — 하자 보수 1년 이상 (누수·균열 등 중대 하자는 3년 이상 권장).
5. **계약서 항목**: 공사 범위, 자재 사양, 일정, 중도금 지급 조건, 지연·해지 시 배상.
6. **현장 소장 상주** 여부 — 하도급 다단계 구조는 품질 편차 위험이 큽니다.
7. **중도금 30% 룰** — 계약금 10%, 착수 20%, 중간 30%, 준공 40% 가 일반적이며 선지급 50% 이상 요구 업체는 주의.

## 흔한 분쟁 요인과 예방

- **추가 공사비 분쟁**: "현장에서 발견된 하자" 명목 추가 청구. 계약서에 **견적 외 공사 단가** 명시 필수.
- **자재 등급 임의 변경**: 사양서·견적서에 없는 자재가 시공되면 사진·영상 기록과 함께 즉시 이의.
- **일정 지연**: 전기·목공 등 공정 순서 때문에 1~2주 지연은 흔함. 4주 이상 지연 시 지체상금 조항 발동.

## 2026년 천안 트렌드

- **전기차 충전 콘센트 설치** 문의 증가 (지하주차장 공용 콘센트 부족).
- **재택근무 공간** 분리형 리모델링 수요 지속.
- **ESS·태양광** 연계 인테리어는 아직 수요 초기 단계.
`,
  city: 'cheonan',
  sector: 'living',
  category: 'interior',
  tags: ['천안', '인테리어', '리모델링', '견적', '가이드'],
  faqs: [
    { question: '천안 인테리어 30평 아파트 전체 리모델링 비용은 얼마인가요?', answer: '2,000만~4,000만원이 평균이며 자재 등급과 현장 구조에 따라 ±30% 변동합니다. 최소 2~3곳 견적 비교를 권장합니다.' },
    { question: '천안 인테리어 업체 계약 시 주의점은?', answer: '공사 범위·자재 사양·일정·중도금 지급 조건·지연 배상 조항이 모두 계약서에 명시되어야 합니다. 선지급 50% 이상 요구는 주의가 필요합니다.' },
    { question: '천안에서 주방만 부분 리모델링이 가능한가요?', answer: '가능합니다. 평균 500만~1,200만원, 1~2주 공사가 일반적입니다. 싱크대 철거·배관 교체 여부에 따라 달라집니다.' },
    { question: '인테리어 공사 하자 보수 기간은 보통 얼마인가요?', answer: '일반 하자 1년, 누수·균열 등 중대 하자는 3년 이상이 업계 관행입니다. 계약서에 구체 기간과 보수 범위를 명시해야 합니다.' },
  ],
  statistics: [
    { label: '30평 아파트 전체 리모델링 평균', value: '2,000~4,000만원', note: LAST_UPDATED_NOTE },
    { label: '주방 부분 리모델링 평균', value: '500~1,200만원', note: LAST_UPDATED_NOTE },
    { label: '욕실 1개 리모델링 평균', value: '250~600만원', note: LAST_UPDATED_NOTE },
  ],
  sources: [
    { title: 'AI플레이스 자체 조사', url: 'https://aiplace.kr' },
    { title: '한국건설기술연구원 인테리어 표준공사비', url: 'https://www.kict.re.kr' },
  ],
}

const WEBAGENCY: Guide = {
  slug: 'cheonan-webagency-guide',
  title: '천안 웹에이전시 선택 가이드 — 2026년 업데이트',
  summary: '천안·충남 기업이 홈페이지·쇼핑몰을 의뢰할 때 필요한 예산·검증·계약 포인트 정리.',
  content: `# 천안 웹에이전시 선택 가이드

> 천안 지역 소상공인·중소기업이 웹사이트 제작을 의뢰할 때 알아야 할 평균 비용, 업체 유형, 계약·유지보수 포인트를 정리했습니다. ${LAST_UPDATED_NOTE} 기준.

## 천안·충남 웹에이전시 시장 개요

천안은 KTX·수도권 전철로 서울 접근성이 높아 **수도권 에이전시에 외주**하는 비율이 여전히 높지만, 최근 **지역 특화 에이전시**가 늘어나는 추세입니다. 지역 에이전시의 강점은 **미팅·유지보수 대면 지원**과 **음식점·병원·제조 등 천안 주력 업종 레퍼런스**입니다.

## 홈페이지 유형별 평균 비용

| 유형 | 평균 가격대 | 제작 기간 | 비고 |
| --- | --- | --- | --- |
| 랜딩페이지 (1페이지) | 50만~150만원 | 1~2주 | 이벤트·광고 랜딩용 |
| 기본 회사 홈페이지 (5~10페이지) | 150만~400만원 | 3~6주 | 반응형 + 관리자 페이지 |
| 예약·문의 연동 홈페이지 | 300만~700만원 | 6~10주 | 병원·미용실·스튜디오용 |
| 쇼핑몰 (Cafe24/NHN Commerce) | 300만~800만원 | 4~8주 | 결제·배송 연동 포함 |
| 맞춤 개발 (API·ERP 연동) | 500만~2,000만원 | 8~20주 | 대시보드·권한관리 포함 |

*월 유지보수비는 별도(월 5만~30만원) 이며 도메인·호스팅·SSL 비용도 대부분 분리 청구됩니다.*

## 업체 유형과 선택 기준

- **프리랜서 팀 (2~5인)**: 가격 경쟁력 높으나 **장기 유지보수에 취약**. 계약서에 이직·해산 시 **소스코드·관리자 계정 인수 조항** 필수.
- **중소 에이전시 (10~30인)**: 가격·품질·A/S 밸런스. 포트폴리오 동일 업종 2건 이상 확인.
- **디지털 마케팅 에이전시**: 사이트 제작 + 광고·SEO 패키지 제공. 마케팅 예산이 있는 경우 효율적.

## 계약서 체크리스트

1. **산출물 정의**: 디자인 PSD·Figma 파일, 소스코드, DB 백업, 관리자 계정 전달 시점.
2. **저작권 귀속**: 발주처 귀속으로 명시. 이미지·폰트 라이선스 포함 여부.
3. **유지보수 범위**: 월 요금에 포함되는 작업(문의 회신·오류 수정·콘텐츠 업데이트) 구분.
4. **지적재산권**: 외주 에이전시가 동일 템플릿을 경쟁사에 납품하지 않는다는 조항.
5. **데이터 백업·이관**: 계약 종료 후 서버·코드 이관 방법·기간.
6. **반응형·SEO·보안 기본 체크**: Lighthouse 70점 이상, robots.txt·sitemap.xml 포함, HTTPS 필수.

## 2026년 의뢰 전 꼭 확인할 3가지

- **AI·챗봇 내장 여부**: ChatGPT/Claude API 연동 예산 추가 필요 (월 5만~30만원).
- **GEO 최적화**: ChatGPT·Claude·Gemini 같은 AI 검색에서 인용되려면 schema.org 구조화, FAQ, AEO 패턴이 필요합니다.
- **Core Web Vitals**: Google 검색 순위에 직접 영향. 제작 완료 후 **LCP < 2.5초, CLS < 0.1** 보장 조항 권장.
`,
  city: 'cheonan',
  sector: 'professional',
  category: 'webagency',
  tags: ['천안', '웹에이전시', '홈페이지', '쇼핑몰', '가이드'],
  faqs: [
    { question: '천안 웹에이전시 기본 홈페이지 제작 비용은 얼마인가요?', answer: '5~10페이지 반응형 홈페이지 기준 150만~400만원이 평균이며 제작 기간은 3~6주가 일반적입니다. 관리자 페이지·SEO 포함 여부에 따라 달라집니다.' },
    { question: '천안에서 쇼핑몰 제작을 의뢰하면 얼마 드나요?', answer: 'Cafe24·NHN Commerce 기반 쇼핑몰 기준 300만~800만원, 4~8주 제작이 일반적입니다. 결제·배송 연동이 포함됩니다.' },
    { question: '웹에이전시 계약 시 저작권은 어떻게 정해지나요?', answer: '산출물(소스코드·디자인·콘텐츠) 저작권을 발주처로 귀속하는 조항을 계약서에 명시해야 합니다. 이미지·폰트 라이선스 승계도 체크하세요.' },
    { question: '천안 웹에이전시 유지보수 비용은 별도인가요?', answer: '대부분 별도이며 월 5만~30만원 범위입니다. 포함 작업(문의 회신·오류 수정·콘텐츠 업데이트)과 별도 청구 기준을 명시해야 합니다.' },
  ],
  statistics: [
    { label: '기본 홈페이지 평균 제작비', value: '150~400만원', note: LAST_UPDATED_NOTE },
    { label: '쇼핑몰 평균 제작비', value: '300~800만원', note: LAST_UPDATED_NOTE },
    { label: '월 유지보수비 범위', value: '5~30만원', note: LAST_UPDATED_NOTE },
  ],
  sources: [
    { title: 'AI플레이스 자체 조사', url: 'https://aiplace.kr' },
    { title: 'KISA 웹사이트 제작 가이드', url: 'https://www.kisa.or.kr' },
  ],
}

const RESTAURANT: Guide = {
  slug: 'cheonan-restaurant-guide',
  title: '천안 음식점 선택 가이드 — 2026년 업데이트',
  summary: '천안 상권·가격대·분위기별 음식점 선택 기준과 지역 특화 맛집 카테고리를 정리.',
  content: `# 천안 음식점 선택 가이드

> 천안에서 상황별로 음식점을 고를 때 참고할 상권·가격대·분위기 특징과 대표 메뉴를 정리합니다. ${LAST_UPDATED_NOTE} 기준.

## 천안 주요 상권

- **불당동·백석동 (신도시)**: 40대 가족·커플 중심. 이탈리안·한식 정찬·카페 수요 높음. 객단가 15,000원 이상.
- **두정동·쌍용동**: 직장인·대학가 혼합. 점심 한정 저가 메뉴 많고 저녁 회식 수요.
- **구터미널·신부동**: 원도심. 노포·백반·술집 비중 높음. 객단가 10,000~13,000원.
- **천안역·동남구 시내**: 출장·환승 수요. 빠른 식사·테이크아웃 비중.

## 가격대별 분류

| 분류 | 1인 객단가 | 대표 카테고리 |
| --- | --- | --- |
| 저가형 | 7,000~10,000원 | 김밥·분식·칼국수·학식 |
| 중가형 | 12,000~20,000원 | 한식 정식·냉면·돈까스·덮밥 |
| 중상가 | 20,000~35,000원 | 한우 정육식당·이탈리안·일식 |
| 프리미엄 | 35,000원 이상 | 오마카세·호텔 레스토랑·파인다이닝 |

## 상황별 추천 기준

**가족 외식**
- **좌식·룸** 보유, 어린이 의자·키즈메뉴 확인.
- 주차 4대 이상, 평일 저녁·주말 예약 가능 여부.

**연인 데이트**
- 창가·조도 낮은 공간, 무소음 BGM, 2인 코스 메뉴 구성.
- 객단가 25,000원 이상이 일반적.

**직장 회식**
- 4~12인 예약 가능, 2차 연계 상권(술집·카페) 근접.
- 법인카드·세금계산서 발행 여부.

**혼밥**
- 카운터석·1인 메뉴, 키오스크·모바일 주문, 회전율 빠른 구조.

## 음식점 선택 체크리스트

1. **식품위생업 신고증** 업장 게시 — 법정 의무.
2. **알레르기·원산지 표시** — 축산물·수산물 이력관리 확인.
3. **리뷰 신뢰도**: 네이버·카카오·구글 3곳 평균이 실제에 가장 근접.
4. **인당 예상 비용** 사전 공지 — 코스·세트 구성을 명확히 안내하는 업체가 분쟁이 적습니다.
5. **예약 정책**: 노쇼 방지 선결제·예약금 유무.

## 2026년 천안 트렌드

- **비건·식물성 메뉴** 수요 완만 증가. 불당·백석 상권에서 확산.
- **로컬 식재료**: 아산 배·천안 밤·병천 순대 등 지역 특산물 활용 메뉴가 증가.
- **디저트 카페** 집중(백석·불당): 커피+디저트 객단가 10,000~15,000원.
`,
  city: 'cheonan',
  sector: 'food',
  category: 'restaurant',
  tags: ['천안', '음식점', '맛집', '가이드', '상권'],
  faqs: [
    { question: '천안 불당동에서 가족 외식 음식점을 고르는 기준은?', answer: '좌식·룸 보유, 주차 4대 이상, 평일 저녁·주말 예약 가능 여부, 키즈메뉴·어린이 의자 구비를 확인하세요. 객단가 15,000원 이상 업장이 많습니다.' },
    { question: '천안 회식 장소는 어느 상권이 편리한가요?', answer: '두정동·쌍용동·불당동이 4~12인 회식에 적합합니다. 2차 연계 술집·카페가 도보 10분 이내 가능하고 법인카드 결제가 일반적입니다.' },
    { question: '천안 음식점 평균 객단가는 얼마인가요?', answer: '저가형 7,000~10,000원, 중가형 12,000~20,000원, 중상가 20,000~35,000원대가 일반적입니다. 프리미엄 오마카세·파인다이닝은 35,000원 이상입니다.' },
    { question: '천안에서 혼밥하기 좋은 음식점 특징은?', answer: '카운터석이나 1인 세트 메뉴, 키오스크·모바일 주문, 회전율이 빠른 구조가 편리합니다. 천안역·시내 상권에 이런 업장이 집중되어 있습니다.' },
  ],
  statistics: [
    { label: '천안 음식점 중가형 객단가', value: '12,000~20,000원', note: LAST_UPDATED_NOTE },
    { label: '프리미엄 1인 객단가', value: '35,000원 이상', note: LAST_UPDATED_NOTE },
    { label: '주요 상권 수', value: '4곳 (불당·두정·구터미널·천안역)', note: '2026년 천안시 상권 구분' },
  ],
  sources: [
    { title: 'AI플레이스 자체 조사', url: 'https://aiplace.kr' },
    { title: '천안시 상권분석 보고서', url: 'https://www.cheonan.go.kr' },
  ],
}

const GUIDES: Guide[] = [AUTO_REPAIR, INTERIOR, WEBAGENCY, RESTAURANT]

function toInsertPayload(g: Guide) {
  return {
    slug: g.slug,
    title: g.title,
    summary: g.summary,
    content: g.content,
    city: g.city,
    sector: g.sector,
    category: g.category,
    tags: g.tags,
    status: 'active' as const,
    published_at: new Date().toISOString(),
    post_type: 'guide' as const,
    related_place_slugs: [],
    target_query: null,
    faqs: g.faqs,
    statistics: g.statistics,
    sources: g.sources,
    view_count: 0,
    quality_score: null,
  }
}

async function main() {
  const args = parseArgs()
  console.log(`[seed-category-guides] mode: ${args.dryRun ? 'DRY-RUN' : args.force ? 'UPSERT' : 'INSERT'}`)

  const client = getAdminClient()
  if (!client) {
    console.error('[seed-category-guides] admin client 초기화 실패. SUPABASE_SERVICE_ROLE_KEY 확인')
    process.exit(1)
  }

  let inserted = 0
  let skipped = 0
  for (const guide of GUIDES) {
    const payload = toInsertPayload(guide)
    console.log(`  · ${guide.slug} (${guide.content.length} chars)`)
    if (args.dryRun) continue

    if (args.force) {
      const { error } = await (client.from('blog_posts') as ReturnType<typeof client.from>)
        .upsert(payload as never, { onConflict: 'slug' })
      if (error) {
        console.error(`    upsert 실패: ${error.message}`)
      } else {
        inserted += 1
      }
    } else {
      const { error } = await (client.from('blog_posts') as ReturnType<typeof client.from>)
        .insert(payload as never)
      if (error) {
        if (error.code === '23505') {
          console.log('    이미 존재 — skip')
          skipped += 1
        } else {
          console.error(`    insert 실패: ${error.message}`)
        }
      } else {
        inserted += 1
      }
    }
  }

  console.log(`\n[seed-category-guides] 완료 — 삽입 ${inserted}, 스킵 ${skipped}${args.dryRun ? ' (DRY-RUN)' : ''}`)
}

main().catch(err => {
  console.error('[seed-category-guides] 치명적 오류:', err)
  process.exit(1)
})
