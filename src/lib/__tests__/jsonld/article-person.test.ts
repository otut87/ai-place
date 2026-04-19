// T-124 / T-116 — Article + Person + inLanguage 검증.
// 철학: "콘텐츠 페이지에는 반드시 Article + Person(저자) 스키마 + Article.headline ≡ H1"

import { describe, it, expect } from 'vitest'
import { generateArticle } from '@/lib/jsonld'
import { getDefaultAuthor, authorToPersonJsonLd } from '@/lib/authors'

describe('T-124 generateArticle', () => {
  it('Article + author Person 세트 + inLanguage ko-KR', () => {
    const a = generateArticle({
      title: '천안 여드름 피부과 4곳 — 리뷰 2,127건 분석 (2026)',
      description: '테스트 요약',
      lastUpdated: '2026-04-10',
      url: 'https://aiplace.kr/blog/cheonan/medical/acne',
    })
    expect(a['@type']).toBe('Article')
    expect(a.headline).toBe('천안 여드름 피부과 4곳 — 리뷰 2,127건 분석 (2026)')
    expect(a.inLanguage).toBe('ko-KR')
    expect(a.author['@type']).toBe('Person')
    expect(a.author.name).toBeTruthy()
    expect(a.author['@id']).toBeTruthy()
    expect(a.publisher['@type']).toBe('Organization')
  })

  it('Article.headline 은 opts.title 과 정확히 일치 (철학: H1 ≡ headline)', () => {
    const title = '테스트 제목'
    const a = generateArticle({ title, description: '', lastUpdated: '2026-04-10', url: 'x' })
    expect(a.headline).toBe(title)
  })
})

describe('T-124 authors.ts', () => {
  it('getDefaultAuthor 는 이지수 큐레이터', () => {
    const a = getDefaultAuthor()
    expect(a.name).toBe('이지수')
    expect(a.jobTitle).toContain('큐레이터')
    expect(a.id).toContain('#person')
  })

  it('authorToPersonJsonLd 는 Schema.org Person', () => {
    const p = authorToPersonJsonLd(getDefaultAuthor())
    expect(p['@type']).toBe('Person')
    expect(p['@id']).toBe('https://aiplace.kr/about#person')
    expect(p.name).toBe('이지수')
  })
})
