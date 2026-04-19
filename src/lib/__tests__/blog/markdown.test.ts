/**
 * blog/markdown.ts — XSS sanitization 검증 (T-010d)
 *
 * 페이지에서 사용하는 react-markdown 의 rehype-sanitize 와 동일한 schema 로
 * 서버 측에서도 sanitize 한다. 테스트는 서버 헬퍼를 이용해 위험 패턴 차단을 검증.
 */
import { describe, it, expect } from 'vitest'
import { renderMarkdownToHtml } from '@/lib/blog/markdown'

describe('renderMarkdownToHtml — basic rendering', () => {
  it('일반 markdown → HTML 변환 (T-099: # 는 <h2> 로 강등, H1 은 페이지 헤더에만)', async () => {
    const html = await renderMarkdownToHtml('# 천안 피부과\n\n본문 내용')
    expect(html).not.toContain('<h1>')
    expect(html).toContain('<h2>천안 피부과</h2>')
    expect(html).toContain('<p>')
  })

  it('list / blockquote 렌더링', async () => {
    const html = await renderMarkdownToHtml('> 인용\n\n- a\n- b')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>a</li>')
  })
})

describe('renderMarkdownToHtml — XSS sanitization', () => {
  it('<script> 태그 제거 (텍스트로만 남음, 실행 X)', async () => {
    const html = await renderMarkdownToHtml('Hello <script>doEvil()</script> World')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('</script')
    // textContent 로 남는 건 harmless (실행되지 않음)
  })

  it('on* 이벤트 핸들러 제거', async () => {
    const html = await renderMarkdownToHtml('<a href="x" onclick="alert(1)">click</a>')
    expect(html).not.toMatch(/onclick/i)
    expect(html).not.toMatch(/alert/i)
  })

  it('javascript: 프로토콜 URL 제거', async () => {
    const html = await renderMarkdownToHtml('[click](javascript:alert(1))')
    expect(html).not.toContain('javascript:')
  })

  it('iframe 제거', async () => {
    const html = await renderMarkdownToHtml('<iframe src="https://evil.com"></iframe>')
    expect(html).not.toContain('<iframe')
  })

  it('style 속성 제거 (CSS injection 차단)', async () => {
    const html = await renderMarkdownToHtml('<p style="background:url(x)">x</p>')
    expect(html).not.toMatch(/style=/i)
  })

  it('img onerror 제거', async () => {
    const html = await renderMarkdownToHtml('<img src=x onerror="alert(1)">')
    expect(html).not.toMatch(/onerror/i)
  })

  it('일반 링크는 보존', async () => {
    const html = await renderMarkdownToHtml('[home](https://example.com)')
    expect(html).toContain('href="https://example.com"')
  })
})
