import type { MetadataRoute } from 'next'

const BASE_URL = 'https://aiplace.kr'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // AI 검색·답변 크롤러 (GEO 딥리서치 §5.1)
      { userAgent: 'OAI-SearchBot', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'ChatGPT-User', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'PerplexityBot', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Claude-User', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Claude-SearchBot', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Googlebot', allow: '/', disallow: ['/admin', '/api'] },
      // 한국 검색엔진 (Naver/Daum) + MS Bing (T-032)
      { userAgent: 'Yeti', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Daumoa', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Bingbot', allow: '/', disallow: ['/admin', '/api'] },
      // 학습용 크롤러
      { userAgent: 'GPTBot', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'ClaudeBot', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Google-Extended', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'Applebot-Extended', allow: '/', disallow: ['/admin', '/api'] },
      { userAgent: 'CCBot', allow: '/', disallow: ['/admin', '/api'] },
      // 기본
      { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
