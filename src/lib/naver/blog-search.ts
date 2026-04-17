// Naver Blog Search API 클라이언트 (T-021)
// https://openapi.naver.com/v1/search/blog.json
//
// 인증 헤더: X-Naver-Client-Id, X-Naver-Client-Secret
// display: 1~100, start: 1~1000, sort: 'sim'(정확도) | 'date'(최신)
// 본문에 <b> 태그/HTML 엔티티가 포함되어 있어 stripHtml 필요.

export interface BlogPost {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string // YYYYMMDD
  raw: unknown
}

interface BlogItem {
  title: string
  link: string
  description: string
  bloggername: string
  bloggerlink: string
  postdate: string
}

const ENDPOINT = 'https://openapi.naver.com/v1/search/blog.json'

export function stripHtml(s: string): string {
  return s
    .replace(/<\/?b>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

export async function searchBlog(
  query: string,
  opts: { display?: number; sort?: 'sim' | 'date' } = {},
): Promise<BlogPost[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.warn('[naver-blog] NAVER_CLIENT_ID/SECRET 미설정 — 검색 스킵')
    return []
  }

  const display = Math.max(1, Math.min(100, opts.display ?? 30))
  const sort = opts.sort ?? 'sim'
  const url = `${ENDPOINT}?query=${encodeURIComponent(trimmed)}&display=${display}&sort=${sort}`

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    })
    if (!res.ok) {
      console.error(`[naver-blog] HTTP ${res.status} ${res.statusText}`)
      return []
    }
    const data = (await res.json()) as { items?: BlogItem[] }
    const items = data.items ?? []
    return items.map(it => ({
      title: stripHtml(it.title ?? ''),
      link: it.link,
      description: stripHtml(it.description ?? ''),
      bloggername: it.bloggername ?? '',
      bloggerlink: it.bloggerlink ?? '',
      postdate: it.postdate ?? '',
      raw: it,
    }))
  } catch (err) {
    console.error('[naver-blog] 요청 실패:', err)
    return []
  }
}
