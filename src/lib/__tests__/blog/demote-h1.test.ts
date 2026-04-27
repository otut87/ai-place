// T-099 (최초) — 본문 H1 을 H2 로 강등 (페이지당 H1 하나 보장).
// T-195 (수정) — 기존 구현이 모든 헤딩을 +1 강등시켜 LLM 의 H2 가 H3 로 떠밀려
//                헤딩 위계가 H1 → H3 점프하는 부작용 발생. H1 만 H2 로 변환하도록 좁힘.

import { describe, it, expect } from 'vitest'
import { renderMarkdownToHtml } from '@/lib/blog/markdown'

describe('renderMarkdownToHtml — H1 만 H2 로 강등 (T-195)', () => {
  it('본문 첫 줄의 # 는 <h2> 로 렌더된다 (페이지 H1 중복 방지)', async () => {
    const md = '# 본문 제목\n\n본문 문단.'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h2>본문 제목</h2>')
    expect(html).not.toContain('<h1>')
  })

  it('## 는 <h2> 로 그대로 보존된다 (LLM 의 H2 위계 보존)', async () => {
    const md = '## 섹션 제목'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h2>섹션 제목</h2>')
  })

  it('### 는 <h3> 로 그대로 보존된다', async () => {
    const md = '### 소제목'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h3>소제목</h3>')
  })

  it('#### / ##### / ###### 도 그대로 유지된다', async () => {
    const md = '#### 네단계\n\n##### 다섯단계\n\n###### 여섯단계'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h4>네단계</h4>')
    expect(html).toContain('<h5>다섯단계</h5>')
    expect(html).toContain('<h6>여섯단계</h6>')
  })

  it('여러 개의 # 도 모두 H2 로 변환 — 본문에 H1 절대 남지 않는다', async () => {
    const md = '# 첫\n\n# 둘\n\n## 셋'
    const html = await renderMarkdownToHtml(md)
    expect(html).not.toContain('<h1>')
    expect(html).toContain('<h2>첫</h2>')
    expect(html).toContain('<h2>둘</h2>')
    expect(html).toContain('<h2>셋</h2>')
  })

  it('LLM 7블록 시나리오 — H2 위계가 보존된다 (T-195 회귀 방지)', async () => {
    const md = [
      '## 결론',
      '본문 ...',
      '',
      '## 분석 방법',
      '...',
      '',
      '## 업체별 상세',
      '',
      '### 업체 A',
      '- 항목',
    ].join('\n')
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<h2>결론</h2>')
    expect(html).toContain('<h2>분석 방법</h2>')
    expect(html).toContain('<h2>업체별 상세</h2>')
    expect(html).toContain('<h3>업체 A</h3>')
  })

  it('헤딩이 아닌 p/ul/strong 등은 영향 받지 않는다', async () => {
    const md = '일반 문단\n\n- 리스트\n- 항목\n\n**굵게**'
    const html = await renderMarkdownToHtml(md)
    expect(html).toContain('<p>일반 문단</p>')
    expect(html).toContain('<li>리스트</li>')
    expect(html).toContain('<strong>굵게</strong>')
  })
})
