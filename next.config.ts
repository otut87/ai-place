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
const nextConfig: NextConfig = {
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
