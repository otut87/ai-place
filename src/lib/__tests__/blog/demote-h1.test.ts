// T-099 — 블로그 본문 markdown 의 첫 H1 을 H2 로 강등.
// 문제: 블로그 글 페이지의 헤더에 이미 H1 이 있는데 본문 markdown 에도 `#` 이 있어
//       페이지당 H1 2개 → 철학의 "H1은 페이지당 1개, 반드시 고유" 위배.
// 해법: 본문의 모든 h1 을 h2 로, h2->h3, h3->h4 등 레벨 전체 +1 하는 rehype 플러그인.

import { describe, it, expect } from 'vitest'
import { renderMarkdownToHtml } from '@/lib/blog/markdown'

describe('renderMarkdownToHtml (T-099 H1 강등)', () => {
  it('본문 첫 줄의 # 는 <h2> 로 렌더된다', async () => {
    const md = '# 본문 제목\n\n본문 문단.'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h2>본문 제목</h2>')
    expect(html).not.toContain('<h1>')
  })

  it('## 는 <h3> 로 한 단계 강등된다', async () => {
    const md = '## 섹션 제목'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h3>섹션 제목</h3>')
  })

  it('### 는 <h4> 로 강등된다', async () => {
    const md = '### 소제목'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h4>소제목</h4>')
  })

  it('#### 는 <h5>, ##### 는 <h6> 로 강등된다', async () => {
    const md = '#### 네단계\n\n##### 다섯단계'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h5>네단계</h5>')
    expect(html).toContain('<h6>다섯단계</h6>')
  })

  it('###### (h6) 는 그대로 h6 유지 (더 강등할 레벨 없음)', async () => {
    const md = '###### 최하위'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h6>최하위</h6>')
  })

  it('여러 개의 # 도 모두 강등된다 — H1 이 본문에 절대 남지 않는다', async () => {
    const md = '# 첫\n\n# 둘\n\n## 셋'
    const html = await renderMarkdownToHtml(md)
    expect(html).not.toContain('<h1>')
    expect(html).toContain('<h2>첫</h2>')
    expect(html).toContain('<h2>둘</h2>')
    expect(html).toContain('<h3>셋</h3>')
  })

  it('헤딩이 아닌 p/ul/strong 등은 영향 받지 않는다', async () => {
    const md = '일반 문단\n\n- 리스트\n- 항목\n\n**굵게**'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<p>일반 문단</p>')
    expect(html).toContain('<li>리스트</li>')
    expect(html).toContain('<strong>굵게</strong>')
  })
})
