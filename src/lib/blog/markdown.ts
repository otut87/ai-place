// AI Place — Blog Markdown 렌더링 + sanitization (T-010d)
// 서버 측 markdown → HTML 변환. react-markdown 과 동일한 rehype-sanitize 사용.
//
// T-099: 페이지 헤더에 이미 H1 이 있으므로 본문 markdown 의 모든 heading 을 한 단계씩
//        강등한다 (h1→h2, h2→h3, ..., h6 유지). 철학의 "H1은 페이지당 1개" 준수.
//
// 사용처:
// - 블로그 글 상세 페이지 본문 렌더 (서버 컴포넌트)
// - 테스트에서 XSS 패턴 차단 검증

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { visit } from 'unist-util-visit'
import type { Element, Root } from 'hast'

/**
 * rehype 플러그인 — 본문 heading 을 한 단계 강등.
 * h1→h2, h2→h3, h3→h4, h4→h5, h5→h6, h6→h6 (유지).
 */
function rehypeDemoteHeadings() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const tag = node.tagName
      if (tag === 'h1') node.tagName = 'h2'
      else if (tag === 'h2') node.tagName = 'h3'
      else if (tag === 'h3') node.tagName = 'h4'
      else if (tag === 'h4') node.tagName = 'h5'
      else if (tag === 'h5') node.tagName = 'h6'
    })
  }
}

/**
 * Markdown → 안전한 HTML 문자열.
 * rehype-sanitize 의 default schema 사용 (script/iframe/on* 핸들러/javascript: 차단).
 * T-099: heading 한 단계 강등.
 */
// T-115: rehype-sanitize 가 table 요소를 허용하도록 스키마 확장.
const tableSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  attributes: {
    ...defaultSchema.attributes,
    th: [...(defaultSchema.attributes?.th ?? []), 'align'],
    td: [...(defaultSchema.attributes?.td ?? []), 'align'],
  },
}

export async function renderMarkdownToHtml(md: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm) // T-115: Markdown 테이블 → <table> 강제
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeDemoteHeadings)
    .use(rehypeSanitize, tableSchema)
    .use(rehypeStringify)
    .process(md)
  return String(file)
}
