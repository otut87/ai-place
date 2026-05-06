import type { MetadataRoute } from 'next'

const BASE_URL = 'https://aiplace.kr'

// /blog 검색·필터 쿼리 조합은 canonical(/blog)와 같은 본문이므로 크롤 가치 0.
// 2026-05-06 실측: Meta-ExternalAgent 단일 봇이 30일간 1.18M 요청 중 99%가 /blog 무한 조합.
// 메인 /blog 와 /blog/[city]/[sector]/[slug] 본문 페이지는 그대로 허용.
const BLOG_QUERY_DISALLOW = ['/blog?*']

export default function robots(): MetadataRoute.Robots {
  const adminApi = ['/admin', '/api']
  const adminApiPlusBlogQuery = [...adminApi, ...BLOG_QUERY_DISALLOW]

  return {
    rules: [
      // AI 검색·답변 크롤러 (GEO 딥리서치 §5.1)
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: adminApi },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: adminApi },
      { userAgent: 'PerplexityBot', allow: '/', disallow: adminApi },
      { userAgent: 'Claude-User', allow: '/', disallow: adminApi },
      { userAgent: 'Claude-SearchBot', allow: '/', disallow: adminApi },
      { userAgent: 'Googlebot', allow: '/', disallow: adminApi },
      // 한국 검색엔진 (Naver/Daum) + MS Bing (T-032)
      { userAgent: 'Yeti', allow: '/', disallow: adminApi },
      { userAgent: 'Daumoa', allow: '/', disallow: adminApi },
      { userAgent: 'Bingbot', allow: '/', disallow: adminApi },
      // 학습용 크롤러 — /blog 무한 조합 차단 (canonical=/blog 본문은 허용)
      { userAgent: 'GPTBot', allow: '/', disallow: adminApiPlusBlogQuery },
      { userAgent: 'ClaudeBot', allow: '/', disallow: adminApiPlusBlogQuery },
      { userAgent: 'Google-Extended', allow: '/', disallow: adminApiPlusBlogQuery },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: adminApiPlusBlogQuery },
      { userAgent: 'CCBot', allow: '/', disallow: adminApiPlusBlogQuery },
      { userAgent: 'Meta-ExternalAgent', allow: '/', disallow: adminApiPlusBlogQuery, crawlDelay: 10 },
      { userAgent: 'Bytespider', allow: '/', disallow: adminApiPlusBlogQuery, crawlDelay: 10 },
      { userAgent: 'Amazonbot', allow: '/', disallow: adminApiPlusBlogQuery },
      // 기본 — 미식별 봇도 /blog 무한 조합 차단
      { userAgent: '*', allow: '/', disallow: adminApiPlusBlogQuery },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
