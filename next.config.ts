import type { NextConfig } from 'next'

/**
 * T-010f: 기존 keyword/compare/guide 라우트를 /blog 로 301 redirect.
 *
 * 현재 천안 피부과(dermatology → sector=medical)만 활성. 다른 도시/카테고리가
 * 추가되면 여기 규칙을 확장해야 함.
 *   → 향후 자동화: scripts/ 에서 (city, category, sector) 매핑을 읽어 빌드 시
 *     redirects 를 생성하는 방식으로 교체 고려.
 *
 * 매핑 규칙:
 *   /{city}/{category}/k/{keyword}      → /blog/{city}/{sector}/{city}-{category}-{keyword}
 *   /compare/{city}/{category}/{topic}   → /blog/{city}/{sector}/{city}-{category}-{topic}
 *   /guide/{city}/{category}             → /blog/{city}/{sector}/{city}-{category}-guide
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
