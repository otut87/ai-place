// T-239 — extractTocFromMarkdown 단위 검증 (h2/h3 슬러그 정합성).

import { describe, it, expect } from 'vitest'
import { extractTocFromMarkdown } from '@/lib/blog/markdown'

describe('extractTocFromMarkdown', () => {
  it('## 와 ### 만 추출, # 는 본문 H1 이라 무시 (BlogToc 영역 외)', () => {
    const md = '# 페이지 제목\n\n## 섹션 A\n\n### 하위 a\n\n## 섹션 B'
    const toc = extractTocFromMarkdown(md)
    expect(toc).toEqual([
      { depth: 2, id: '섹션-a', text: '섹션 A' },
      { depth: 3, id: '하위-a', text: '하위 a' },
      { depth: 2, id: '섹션-b', text: '섹션 B' },
    ])
  })

  it('한글 헤딩의 slug 는 한글 그대로 보존, 공백은 하이픈', () => {
    const md = '## 천안 피부과 비교\n\n### 가격 정보'
    const toc = extractTocFromMarkdown(md)
    expect(toc[0]).toEqual({ depth: 2, id: '천안-피부과-비교', text: '천안 피부과 비교' })
    expect(toc[1]).toEqual({ depth: 3, id: '가격-정보', text: '가격 정보' })
  })

  it('같은 이름 헤딩이 반복되면 -2, -3 식으로 disambiguate', () => {
    const md = '## 결론\n\n## 결론\n\n## 결론'
    const toc = extractTocFromMarkdown(md)
    expect(toc.map(t => t.id)).toEqual(['결론', '결론-2', '결론-3'])
  })

  it('``` 코드 블록 안의 ## 는 헤딩으로 인식하지 않는다', () => {
    const md = '## 진짜 헤딩\n\n```\n## 코드 안 헤딩 풍\n```\n\n## 또 다른 헤딩'
    const toc = extractTocFromMarkdown(md)
    expect(toc.map(t => t.text)).toEqual(['진짜 헤딩', '또 다른 헤딩'])
  })

  it('헤딩 텍스트의 ** 와 ` 는 제거된다', () => {
    const md = '## **굵은** 제목 `code`'
    const toc = extractTocFromMarkdown(md)
    expect(toc[0].text).toBe('굵은 제목 code')
  })

  it('빈 문자열 입력 → 빈 배열', () => {
    expect(extractTocFromMarkdown('')).toEqual([])
  })

  it('H4 이상은 무시 (h2/h3 만 TOC 에)', () => {
    const md = '## 보임\n\n#### 안 보임\n\n##### 안 보임'
    const toc = extractTocFromMarkdown(md)
    expect(toc).toHaveLength(1)
    expect(toc[0].text).toBe('보임')
  })

  it('빈 헤딩 텍스트는 스킵', () => {
    const md = '## \n\n## 진짜 제목'
    const toc = extractTocFromMarkdown(md)
    expect(toc).toHaveLength(1)
    expect(toc[0].text).toBe('진짜 제목')
  })
})

describe('extractTocFromMarkdown — slugify edge cases', () => {
  it('특수문자 제거 (한글/숫자/공백/하이픈만 유지)', () => {
    const md = '## 가격! @ 안내?'
    const toc = extractTocFromMarkdown(md)
    expect(toc[0].id).toBe('가격-안내')
  })

  it('80자 초과는 컷 (slug 안정성 보장)', () => {
    const long = 'a'.repeat(120)
    const md = `## ${long}`
    const toc = extractTocFromMarkdown(md)
    expect(toc[0].id.length).toBeLessThanOrEqual(80)
  })
})
