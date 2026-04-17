// AI Place — Blog Markdown 렌더링 + sanitization (T-010d)
// 서버 측 markdown → HTML 변환. react-markdown 과 동일한 rehype-sanitize 사용.
//
// 사용처:
// - 블로그 글 상세 페이지 본문 렌더 (서버 컴포넌트)
// - 테스트에서 XSS 패턴 차단 검증

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

/**
 * Markdown → 안전한 HTML 문자열.
 * rehype-sanitize 의 default schema 사용 (script/iframe/on* 핸들러/javascript: 차단).
 */
export async function renderMarkdownToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(md)
  return String(file)
}
