import type { NextConfig } from 'next'

/**
 * T-010f / T-259 R4 — 기존 keyword/compare/guide 라우트를 /blog 로 301 redirect.
 *
 * Phase 6 마이그레이션 후 src/app/ 에서 compare·guide·keyword 라우트는 모두 제거됐고,
 * 콘텐츠는 blog_posts 테이블 + /blog/[city]/[sector]/[slug] 로 통합. 이 redirects()
 * 만이 legacy URL 지원의 유일 채널이다.
 *
 * 다음 도시·카테고리 추가 절차:
 *   1) Supabase places 테이블에 새 city×category 업체 등록
 *      (자동: sitemap·홈·도시 hub·블로그 enqueue 모두 places 기반)
 *   2) 아래 매핑 규칙 3 줄을 (city, category, sector) 조합으로 추가
 *      (선택 — legacy URL 백링크가 있을 때만 필요. 신규 도시면 보통 생략 가능)
 *
 * 매핑 규칙:
 *   /{city}/{category}/k/{keyword}      → /blog/{city}/{sector}/{city}-{category}-{keyword}
 *   /compare/{city}/{category}/{topic}   → /blog/{city}/{sector}/{city}-{category}-{topic}
 *   /guide/{city}/{category}             → /blog/{city}/{sector}/{city}-{category}-guide
 *
 * 자동화 미루는 이유:
 *   - cities × categories 전체 조합은 10×83=830 룰 — 빌드 산출물 부담
 *   - 활성 city×category 만 추리려면 빌드 시 DB 접근 필요 — env 의존성·실패 모드 ↑
 *   - 현 단계(천안 1도시) 에선 수동 3 줄 추가가 가장 단순·안전
 */
// T-040: 보안 헤더 (HSTS / Frame / Referrer / Permissions).
// CSP 는 Next 의 inline script (/ reaction) 와 Vercel Analytics 로 인해
// 경로별 nonce 설정이 필요하므로 별도 TASK 로 분리.
const SECURITY_HEADERS = [
  // HSTS: 2년 + 서브도메인 + preload (aiplace.kr 은 HTTPS only)
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Clickjacking 방어
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // MIME sniff 방지
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Referrer 정책 — 크로스 오리진 시 origin 만 전송
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // 권한 최소화
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  // XSS 방어 구식 브라우저 힌트
  { key: 'X-XSS-Protection', value: '0' },
]

const nextConfig: NextConfig = {
  // T-259 R6 follow-up — /api/places/photo proxy 가 ref 쿼리 (Google Places photo reference) 를
  //   사용하므로 next.js 16 의 images.localPatterns 에 명시 등록 필요.
  //   미등록 시 prerender 단계에서 "Image is using a query string which is not configured" 오류로 빌드 실패.
  //   ref 값은 Google Places API 가 발급하는 불투명 토큰이라 정확 매치 불가 → search 미지정 (모든 쿼리 허용).
  //   /api/places/photo route 자체가 ref 검증·캐싱·rate-limit 책임.
  images: {
    localPatterns: [
      { pathname: '/api/places/photo' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
  async redirects() {
    return [
      // 1) keyword 페이지 8개 (천안/피부과)
      {
        source: '/cheonan/dermatology/k/:keyword',
        destination: '/blog/cheonan/medical/cheonan-dermatology-:keyword',
        statusCode: 301,
      },
      // 2) compare 페이지 3개 (천안/피부과)
      {
        source: '/compare/cheonan/dermatology/:topic',
        destination: '/blog/cheonan/medical/cheonan-dermatology-:topic',
        statusCode: 301,
      },
      // 3) guide 페이지 1개 (천안/피부과)
      {
        source: '/guide/cheonan/dermatology',
        destination: '/blog/cheonan/medical/cheonan-dermatology-guide',
        statusCode: 301,
      },
    ]
  },
}

export default nextConfig
