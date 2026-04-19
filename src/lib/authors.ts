// T-124 — 저자 프로필 단일 소스.
// 철학: "콘텐츠 페이지에는 반드시 Article + Person(저자) 스키마를 적용한다."

export interface Author {
  id: string
  name: string
  jobTitle: string
  description: string
  url: string
}

const CURATOR_LEE_JISOO: Author = {
  id: 'https://aiplace.kr/about#person',
  name: '이지수',
  jobTitle: 'AI Place 큐레이터',
  description: '천안 지역 로컬 업체의 AI 검색 노출을 돕고 있습니다.',
  url: 'https://aiplace.kr/about',
}

/** 기본 저자 — 블로그/가이드/비교/키워드 콘텐츠 공통. */
export function getDefaultAuthor(): Author {
  return CURATOR_LEE_JISOO
}

/** Schema.org Person 객체로 변환. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authorToPersonJsonLd(author: Author): Record<string, any> {
  return {
    '@type': 'Person',
    '@id': author.id,
    name: author.name,
    jobTitle: author.jobTitle,
    url: author.url,
  }
}
