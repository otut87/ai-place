// T-144 — 각 진단 체크 실패에 대한 복붙 가능한 수정 코드 스니펫 제공.
// 프리미엄 컨설팅 리포트의 "이 코드를 <head>에 붙여넣으세요" 수준의 구체성.

import type { CheckId, CheckResult } from './scan-site'

export interface FixSnippet {
  lang: 'html' | 'json' | 'text' | 'typescript'
  code: string
  placement: string           // 어디에 붙여야 하는가 (예: "<head> 내")
  note?: string               // 추가 설명
}

export function generateFixSnippet(check: CheckResult): FixSnippet | null {
  if (check.status === 'pass') return null
  return FIX_MAP[check.id]?.(check) ?? null
}

type Generator = (check: CheckResult) => FixSnippet

const FIX_MAP: Partial<Record<CheckId, Generator>> = {
  jsonld_localbusiness: () => ({
    lang: 'html',
    placement: '페이지 <head> 내',
    note: '업체 정보를 실제 값으로 치환. @type 은 업종별 구체 타입 사용 (Dentist/MedicalClinic/Restaurant 등).',
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  "name": "업체명",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "도로명 주소",
    "addressLocality": "시",
    "addressRegion": "도",
    "postalCode": "우편번호",
    "addressCountry": "KR"
  },
  "telephone": "+82-41-000-0000",
  "url": "https://example.com",
  "openingHoursSpecification": [
    { "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday"], "opens": "09:00", "closes": "18:00" }
  ],
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.7",
    "reviewCount": "124"
  },
  "sameAs": [
    "https://place.map.naver.com/업체ID",
    "https://place.map.kakao.com/업체ID",
    "https://maps.google.com/?cid=업체ID"
  ]
}
</script>`,
  }),

  faq_schema: () => ({
    lang: 'html',
    placement: 'FAQ 페이지 또는 상세 페이지 <head>',
    note: '실제 고객이 자주 묻는 질문 5개 이상. 질문은 검색어 형태로 작성 (§4.3).',
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    { "@type": "Question", "name": "영업 시간은 어떻게 되나요?", "acceptedAnswer": { "@type": "Answer", "text": "평일 09:00~18:00, 토요일 09:00~13:00 운영합니다." } },
    { "@type": "Question", "name": "주차장이 있나요?", "acceptedAnswer": { "@type": "Answer", "text": "건물 지하 주차장 10대 무료 제공됩니다." } },
    { "@type": "Question", "name": "예약이 필요한가요?", "acceptedAnswer": { "@type": "Answer", "text": "전화 또는 홈페이지 예약 권장드립니다." } },
    { "@type": "Question", "name": "가격은 얼마인가요?", "acceptedAnswer": { "@type": "Answer", "text": "메뉴·시술별로 상이하며 상세는 서비스 페이지를 참고해 주세요." } },
    { "@type": "Question", "name": "카드 결제 가능한가요?", "acceptedAnswer": { "@type": "Answer", "text": "신용/체크카드 모두 가능합니다." } }
  ]
}
</script>`,
  }),

  review_schema: () => ({
    lang: 'html',
    placement: 'LocalBusiness JSON-LD 안에 aggregateRating 필드 추가',
    note: '평점과 리뷰 수 수치만 필요. 개별 리뷰 텍스트 복제는 저작권 이슈로 권장하지 않음 (§13.2).',
    code: `"aggregateRating": {
  "@type": "AggregateRating",
  "ratingValue": "4.7",
  "reviewCount": "124",
  "bestRating": "5"
}`,
  }),

  sameas_entity_linking: () => ({
    lang: 'html',
    placement: 'LocalBusiness JSON-LD 안에 sameAs 배열 추가',
    note: 'Knowledge Graph 엔티티 연결용 (§5.3). 네이버 + 카카오 + 구글 3종 모두 권장.',
    code: `"sameAs": [
  "https://place.map.naver.com/업체ID",
  "https://place.map.kakao.com/업체ID",
  "https://maps.google.com/?cid=업체ID"
]`,
  }),

  direct_answer_block: () => ({
    lang: 'html',
    placement: '각 H2 바로 다음 단락',
    note: 'H2 질문 형태로 시작 → 40~60자 자기완결 답변. AEO 단일 최대 기여 레버 (§4.4).',
    code: `<h2>천안에서 여드름 치료 비용은 얼마인가요?</h2>
<p>천안 지역 여드름 치료 비용은 1회 8만원~15만원이며, 레이저 유형과 병변 상태에 따라 달라집니다.</p>

<h2>진료 시간은 언제인가요?</h2>
<p>평일 오전 9시부터 오후 6시, 토요일은 오전 9시부터 오후 1시까지 진료합니다.</p>`,
  }),

  last_updated: () => ({
    lang: 'html',
    placement: 'LocalBusiness JSON-LD에 dateModified 필드 + 본문에 표시',
    note: 'ChatGPT 90일 이내 갱신 페이지 2.3배 가중 (§4.2). 분기별 재발행 권장.',
    code: `<!-- JSON-LD 안에 -->
"dateModified": "2026-04-19"

<!-- 본문 하단에 -->
<p><time datetime="2026-04-19">최종 업데이트: 2026년 4월 19일</time></p>`,
  }),

  robots_ai_allow: () => ({
    lang: 'text',
    placement: '/robots.txt 파일',
    note: 'AI 크롤러 검색·답변 봇 허용. 차단 시 ChatGPT/Claude/Perplexity 인용 풀에서 제외.',
    code: `User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: Claude-SearchBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: *
Allow: /

Sitemap: https://example.com/sitemap.xml`,
  }),

  sitemap: () => ({
    lang: 'text',
    placement: '/sitemap.xml 파일 (루트에 배치)',
    note: 'AI 크롤러가 상세 페이지를 발견하려면 필수. Next.js 는 app/sitemap.ts 로 자동 생성 가능.',
    code: `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-04-19</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2026-04-19</lastmod>
    <priority>0.8</priority>
  </url>
  <!-- 모든 public URL 포함 -->
</urlset>`,
  }),

  llms_txt: () => ({
    lang: 'text',
    placement: '/llms.txt 파일 (루트)',
    note: '저비용 보너스 (§5.2). AI에게 사이트 핵심 페이지를 큐레이션해서 알려줌.',
    code: `# 업체명

> 짧은 한 줄 소개 (업종·지역·핵심 가치)

## 핵심 페이지

- [홈](https://example.com/): 업체 개요
- [서비스 안내](https://example.com/services): 제공 서비스 목록
- [FAQ](https://example.com/faq): 자주 묻는 질문
- [오시는 길](https://example.com/contact): 주소·전화·지도

## 소개

업체 상세 설명 (3~5 문단, AI가 답변 생성 시 참고).`,
  }),

  title: () => ({
    lang: 'html',
    placement: '<head> 내 <title> 태그',
    note: '표시폭 30~70 권장 (한글=2, 영문=1). Google 검색결과 픽셀 잘림 방지.',
    code: `<title>업체명 - 지역 업종 | 핵심 키워드</title>`,
  }),

  meta_description: () => ({
    lang: 'html',
    placement: '<head> 내',
    note: '표시폭 80~180 권장. 검색어 + 업체 특징 + 핵심 서비스 포함.',
    code: `<meta name="description" content="지역 업종 전문 업체명. 핵심 서비스 3종 소개와 영업시간·주소·연락처 안내. 2026년 업데이트.">`,
  }),

  https: () => ({
    lang: 'text',
    placement: '호스팅·CDN 설정',
    note: 'Let\'s Encrypt 무료 인증서 또는 Cloudflare 자동 SSL 사용. HTTP → HTTPS 301 리다이렉트 설정.',
    code: `# 호스팅 설정 예시 (Nginx)
server {
  listen 80;
  server_name example.com;
  return 301 https://$host$request_uri;
}`,
  }),

  viewport: () => ({
    lang: 'html',
    placement: '<head> 내',
    note: '모바일 반응형 필수.',
    code: `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  }),

  breadcrumb_schema: () => ({
    lang: 'html',
    placement: '각 페이지 <head> — 자기 위치 반영',
    note: 'Google Rich Results + AI 경로 파악 (§5.3). 각 페이지에 자기 경로 반영.',
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "홈", "item": "https://example.com/" },
    { "@type": "ListItem", "position": 2, "name": "카테고리", "item": "https://example.com/category" },
    { "@type": "ListItem", "position": 3, "name": "현재 페이지", "item": "https://example.com/category/page" }
  ]
}
</script>`,
  }),

  time_markup: () => ({
    lang: 'html',
    placement: '본문 업데이트 날짜 표시 부분',
    note: 'Freshness 구조적 시그널 (§4.2). JSON-LD dateModified 와 함께 사용 권장.',
    code: `<p>최종 업데이트: <time datetime="2026-04-19">2026년 4월 19일</time></p>`,
  }),

  author_person_schema: () => ({
    lang: 'html',
    placement: '저자 정보가 있는 페이지 <head>',
    note: 'E-E-A-T 신호 — AI 인용률 +40% (§4.1). jobTitle/url/description 중 하나 필수.',
    code: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "홍길동",
  "jobTitle": "피부과 전문의",
  "url": "https://example.com/about",
  "description": "20년 경력의 피부과 전문의",
  "worksFor": {
    "@type": "Organization",
    "name": "업체명",
    "url": "https://example.com"
  },
  "sameAs": [
    "https://linkedin.com/in/..."
  ]
}
</script>`,
  }),
}

/** 체크 결과 배열 → 모든 수정 스니펫 맵 */
export function buildFixSnippetMap(checks: CheckResult[]): Map<CheckId, FixSnippet> {
  const out = new Map<CheckId, FixSnippet>()
  for (const c of checks) {
    const snip = generateFixSnippet(c)
    if (snip) out.set(c.id, snip)
  }
  return out
}
