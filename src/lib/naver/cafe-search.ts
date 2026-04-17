// Naver Cafe Article Search API 클라이언트 (T-022)
// https://openapi.naver.com/v1/search/cafearticle.json
//
// 인증 헤더: X-Naver-Client-Id, X-Naver-Client-Secret
// display: 1~100, start: 1~1000, sort: 'sim' | 'date'
// 스팸 1차 필터 포함 (광고성 키워드·URL 도배).

import { stripHtml } from './blog-search'

export interface CafePost {
  title: string
  link: string
  description: string
  cafename: string
  cafeurl: string
  raw: unknown
}

interface CafeItem {
  title: string
  link: string
  description: string
  cafename: string
  cafeurl: string
}

const ENDPOINT = 'https://openapi.naver.com/v1/search/cafearticle.json'

// 스팸·광고성 신호 — title/description 어디든 3개 이상이면 제외.
const SPAM_KEYWORDS = [
  '할인쿠폰',
  '이벤트문의',
  '카톡상담',
  '카톡문의',
  '무료상담',
  '문의환영',
  '다이렉트',
  '문자문의',
  '급처',
  '광고문의',
  '대출문의',
  '토토',
  '바카라',
  '슬롯',
  '카지노',
]

export function isSpam(post: { title: string; description: string }): boolean {
  const text = `${post.title}\n${post.description}`.toLowerCase()
  let hits = 0
  for (const kw of SPAM_KEYWORDS) {
    if (text.includes(kw.toLowerCase())) hits += 1
    if (hits >= 3) return true
  }
  // URL 도배 — description 에 http 3개 이상
  const urlCount = (post.description.match(/https?:\/\//g) ?? []).length
  if (urlCount >= 3) return true
  return false
}

export async function searchCafe(
  query: string,
  opts: { display?: number; sort?: 'sim' | 'date' } = {},
): Promise<CafePost[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    console.warn('[naver-cafe] NAVER_CLIENT_ID/SECRET 미설정 — 검색 스킵')
    return []
  }

  const display = Math.max(1, Math.min(100, opts.display ?? 20))
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
      console.error(`[naver-cafe] HTTP ${res.status} ${res.statusText}`)
      return []
    }
    const data = (await res.json()) as { items?: CafeItem[] }
    const items = data.items ?? []
    const posts: CafePost[] = items.map(it => ({
      title: stripHtml(it.title ?? ''),
      link: it.link,
      description: stripHtml(it.description ?? ''),
      cafename: it.cafename ?? '',
      cafeurl: it.cafeurl ?? '',
      raw: it,
    }))
    return posts.filter(p => !isSpam(p))
  } catch (err) {
    console.error('[naver-cafe] 요청 실패:', err)
    return []
  }
}
